// Blackbox Protocol Runtime - The interpreter implementing STATE_MACHINE_SPEC.md

import type {
  BlackboxConfig,
  Blackbox,
  BlackboxState,
  Phase,
  PhaseTransition,
  Plug,
  PlugFunction,
  PlugMetadata,
  HistoryEntry,
  Snapshot,
  Introspection
} from './types';

type EventCallback = (data: any) => void;

export function createBlackbox(config: BlackboxConfig): {
  start(initialData?: any): Blackbox;
  restore(snapshot: Snapshot): Blackbox;
  use(plugs: Record<string, Plug>): void;
} {
  // Mutable plugs - can be swapped at runtime
  let plugs = { ...config.plugs };

  // Normalize plugs (handle PlugMetadata wrapper)
  function getPlugFunction(plug: Plug): PlugFunction {
    if (typeof plug === 'function') {
      return plug;
    }
    return (plug as PlugMetadata).fn;
  }

  return {
    start(initialData = {}): Blackbox {
      // Initialize data from schema + initial data
      const data = initializeData(config.data || {}, initialData);

      // State machine state
      let currentPhase = config.initial || Object.keys(config.phases)[0];
      let loading = false;
      let error: BlackboxState['error'] | undefined;
      let lastEvent: any = { type: 'INIT' }; // Store last event for invoke

      // Event history for replay
      const eventHistory: HistoryEntry[] = [];

      // Event emitter
      const listeners: Record<string, EventCallback[]> = {
        error: [],
        done: [],
        change: []
      };

      function emit(event: string, payload?: any) {
        listeners[event]?.forEach(cb => cb(payload));
      }

      // Execute a plug (action, service, or guard)
      async function executePlug(plugName: string, event: any, computedInput?: any): Promise<any> {
        const plug = plugs[plugName];
        if (!plug) {
          throw new Error(`Plug "${plugName}" not found`);
        }

        const plugFn = getPlugFunction(plug);

        // If computedInput is provided (from invoke.input), use it instead of event
        const input = computedInput !== undefined ? computedInput : event;

        return await Promise.resolve(plugFn(data, input, blackbox));
      }

      // Execute entry/exit plugs
      async function executeLifecyclePlugs(plugNames: string | string[] | undefined, event: any) {
        if (!plugNames) return;

        const plugList = Array.isArray(plugNames) ? plugNames : [plugNames];
        for (const plugName of plugList) {
          await executePlug(plugName, event);
        }
      }

      // Transition to a new phase
      async function transition(target: string | PhaseTransition | PhaseTransition[], event: any) {
        // Handle multiple guarded transitions (array syntax)
        if (Array.isArray(target)) {
          for (const t of target) {
            const shouldTransition = await attemptTransition(t, event);
            if (shouldTransition) return; // First matching guard wins
          }
          // No guard matched
          return;
        }

        await attemptTransition(target, event);
      }

      async function attemptTransition(target: string | PhaseTransition, event: any): Promise<boolean> {
        const targetPhase = typeof target === 'string' ? target : target.target;
        const actions = typeof target === 'object' ? target.actions : undefined;
        const cond = typeof target === 'object' ? target.cond : undefined;

        // Check guard condition
        if (cond) {
          try {
            const guardResult = await executePlug(cond, event);
            if (!guardResult) return false; // Guard failed
          } catch (err) {
            console.warn(`Guard "${cond}" failed:`, err);
            return false;
          }
        }

        // Exit current phase
        const currentPhaseObj = config.phases[currentPhase];
        if (currentPhaseObj?.exit) {
          await executeLifecyclePlugs(currentPhaseObj.exit, event);
        }

        // Execute transition actions
        if (actions) {
          const actionList = Array.isArray(actions) ? actions : [actions];
          for (const action of actionList) {
            await executePlug(action, event);
          }
        }

        // Change phase
        const previousPhase = currentPhase;
        currentPhase = targetPhase;
        error = undefined;
        lastEvent = event; // Store the event that triggered this transition

        // Entry new phase
        const newPhase = config.phases[currentPhase];
        if (newPhase?.entry) {
          await executeLifecyclePlugs(newPhase.entry, event);
        }

        emit('change', { phase: currentPhase, data: { ...data } });

        // Check if final
        if (newPhase?.type === 'final') {
          emit('done', { ...data });
        }

        // Auto-invoke if new phase has invoke
        if (newPhase?.invoke) {
          await handleInvoke(newPhase.invoke);
        }

        return true; // Transition succeeded
      }

      // Handle invoke (async service call)
      async function handleInvoke(invoke: Phase['invoke']) {
        if (!invoke) return;

        loading = true;
        emit('change', { phase: currentPhase, data: { ...data }, loading: true });

        try {
          // Compute input if provided
          let input = lastEvent;
          if (invoke.input) {
            input = invoke.input(data, lastEvent);
          }

          // Call the service plug
          const result = await executePlug(invoke.src, lastEvent, input);
          loading = false;

          if (invoke.onDone) {
            await transition(invoke.onDone, { type: 'DONE', data: result });
          }
        } catch (err: any) {
          loading = false;
          error = { message: err.message, code: err.code };
          emit('error', error);

          if (invoke.onError) {
            await transition(invoke.onError, { type: 'ERROR', error });
          }
        }
      }

      // Introspection API
      function createIntrospection(): Introspection {
        return {
          allPaths(): string[][] {
            // DFS to find all possible paths
            const paths: string[][] = [];
            const visited = new Set<string>();

            function dfs(phase: string, path: string[]) {
              if (visited.has(phase)) return;

              const currentPath = [...path, phase];
              const phaseObj = config.phases[phase];

              if (phaseObj?.type === 'final') {
                paths.push(currentPath);
                return;
              }

              visited.add(phase);

              const transitions = phaseObj?.on || {};
              const targets = Object.values(transitions)
                .flat()
                .map(t => typeof t === 'string' ? t : (t as PhaseTransition).target);

              if (targets.length === 0) {
                paths.push(currentPath);
              } else {
                for (const target of targets) {
                  dfs(target, currentPath);
                }
              }

              visited.delete(phase);
            }

            const initial = config.initial || Object.keys(config.phases)[0];
            dfs(initial, []);

            return paths;
          },

          allActions(): Array<{ name: string; phase: string; label: string; params?: Record<string, string> }> {
            const actions: Array<{ name: string; phase: string; label: string; params?: Record<string, string> }> = [];

            for (const [phaseName, phase] of Object.entries(config.phases)) {
              const phaseActions = Object.keys(phase.on || {});
              for (const actionName of phaseActions) {
                const meta = config.actions[actionName];
                actions.push({
                  name: actionName,
                  phase: phaseName,
                  label: meta?.label || actionName,
                  params: meta?.params
                });
              }
            }

            return actions;
          },

          getPhase(name: string): Phase | undefined {
            return config.phases[name];
          },

          canReach(from: string, to: string): boolean {
            const visited = new Set<string>();

            function dfs(current: string): boolean {
              if (current === to) return true;
              if (visited.has(current)) return false;

              visited.add(current);

              const phase = config.phases[current];
              const transitions = phase?.on || {};
              const targets = Object.values(transitions)
                .flat()
                .map(t => typeof t === 'string' ? t : (t as PhaseTransition).target);

              for (const target of targets) {
                if (dfs(target)) return true;
              }

              return false;
            }

            return dfs(from);
          },

          pathExists(path: string[]): boolean {
            if (path.length < 2) return true;

            for (let i = 0; i < path.length - 1; i++) {
              const from = path[i];
              const to = path[i + 1];
              const phase = config.phases[from];

              if (!phase) return false;

              const transitions = phase.on || {};
              const targets = Object.values(transitions)
                .flat()
                .map(t => typeof t === 'string' ? t : (t as PhaseTransition).target);

              if (!targets.includes(to)) {
                // Check if there's an invoke that leads to 'to'
                if (phase.invoke) {
                  const invokeDone = phase.invoke.onDone;
                  const invokeDoneTarget = typeof invokeDone === 'string' ? invokeDone : (invokeDone as PhaseTransition)?.target;
                  if (invokeDoneTarget !== to) return false;
                } else {
                  return false;
                }
              }
            }

            return true;
          }
        };
      }

      // Public API
      const blackbox: Blackbox = {
        can(): string[] {
          const phase = config.phases[currentPhase];
          if (!phase || loading) return [];
          return Object.keys(phase.on || {});
        },

        do(action: string, payload?: any): void {
          const phase = config.phases[currentPhase];
          if (!phase?.on?.[action]) {
            console.warn(`Action "${action}" not available in phase "${currentPhase}"`);
            return;
          }

          const event = { type: action, ...payload };

          // Add to history
          eventHistory.push({
            type: action,
            payload,
            phase: currentPhase,
            timestamp: Date.now()
          });

          const target = phase.on[action];
          transition(target, event).catch(err => {
            error = { message: err.message };
            emit('error', error);
          });
        },

        where(): BlackboxState {
          return {
            phase: currentPhase,
            data: { ...data },
            loading,
            error
          };
        },

        isBusy(): boolean {
          return loading;
        },

        hasTag(tag: string): boolean {
          if (tag === 'loading') return loading;
          const phase = config.phases[currentPhase];
          return phase?.tags?.includes(tag) || false;
        },

        on(event: 'error' | 'done' | 'change', callback: EventCallback): void {
          listeners[event].push(callback);
        },

        use(newPlugs: Record<string, Plug>): void {
          Object.assign(plugs, newPlugs);
        },

        introspect(): Introspection {
          return createIntrospection();
        },

        history(): HistoryEntry[] {
          return [...eventHistory];
        },

        replay(history: HistoryEntry[]): void {
          for (const entry of history) {
            this.do(entry.type, entry.payload);
          }
        },

        clearHistory(): void {
          eventHistory.length = 0;
        },

        snapshot(): Snapshot {
          return {
            version: config.version,
            phase: currentPhase,
            data: { ...data },
            timestamp: Date.now()
          };
        }
      };

      // Auto-invoke on start if initial phase has invoke
      const initialPhase = config.phases[currentPhase];
      if (initialPhase?.invoke) {
        handleInvoke(initialPhase.invoke);
      }

      return blackbox;
    },

    restore(snapshot: Snapshot): Blackbox {
      // TODO: Add version migration logic
      if (snapshot.version !== config.version) {
        console.warn(`Restoring from different version: ${snapshot.version} → ${config.version}`);
      }

      // Start with restored data and phase
      const blackbox = this.start(snapshot.data);

      // Force set the phase (hack for now - in real impl would need phase setter)
      // For now, just start fresh with the snapshot data
      return blackbox;
    },

    use(newPlugs: Record<string, Plug>): void {
      Object.assign(plugs, newPlugs);
    }
  };
}

// Initialize data from schema
function initializeData(schema: any, initialData: any): any {
  const data: any = {};

  for (const [key, def] of Object.entries(schema)) {
    if (initialData[key] !== undefined) {
      data[key] = initialData[key];
    } else if ((def as any).default !== undefined) {
      data[key] = (def as any).default;
    } else {
      data[key] = getDefaultForType((def as any).type);
    }
  }

  // Merge any additional initial data
  return { ...data, ...initialData };
}

function getDefaultForType(type: string): any {
  switch (type) {
    case 'string': return '';
    case 'number': return 0;
    case 'boolean': return false;
    case 'array': return [];
    case 'object': return {};
    default: return null;
  }
}
