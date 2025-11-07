// Core types for Blackbox Protocol v1.0

export type DataType = 'string' | 'number' | 'boolean' | 'array' | 'object';

export interface DataSchemaField {
  type: DataType;
  required?: boolean;
  default?: any;
  // Validation rules
  pattern?: string;        // Regex for strings
  min?: number;           // Min value for numbers, min length for strings/arrays
  max?: number;           // Max value for numbers, max length for strings/arrays
  minLength?: number;     // Min length for strings/arrays
  maxLength?: number;     // Max length for strings/arrays
  items?: DataSchemaField; // Schema for array items
  properties?: DataSchema; // Schema for object properties
}

export interface DataSchema {
  [key: string]: DataSchemaField;
}

export interface PhaseTransition {
  target: string;
  actions?: string | string[];
  cond?: string;
}

export type InputComputer = (data: any, event: any) => any;

export interface PhaseInvoke {
  src: string;
  input?: InputComputer;  // Compute input for the service
  onDone?: string | PhaseTransition;
  onError?: string | PhaseTransition;
}

export interface Phase {
  entry?: string | string[];  // Plugs to run when entering phase
  exit?: string | string[];   // Plugs to run when exiting phase
  on?: Record<string, string | PhaseTransition | PhaseTransition[]>;  // Support multiple guarded transitions
  invoke?: PhaseInvoke;
  use?: BlackboxModule;
  type?: 'final';
  tags?: string[];
}

export interface ActionMeta {
  label: string;
  description?: string;
  params?: Record<string, string>;
  icon?: string;
}

export type PlugFunction = (data: any, event: any, blackbox?: any) => any | Promise<any>;
export type GuardFunction = (data: any, event: any) => boolean;
export type AssignFunction = (data: any, event: any) => Partial<any>;

// Plug metadata for introspection and runtime behavior
export interface PlugMetadata {
  fn: PlugFunction;
  description?: string;
  cacheable?: boolean;
  ttl?: number;          // Cache TTL in milliseconds
  timeout?: number;      // Timeout in milliseconds
  retries?: number;      // Number of retry attempts
}

export type Plug = PlugFunction | PlugMetadata;

export interface BlackboxConfig {
  id: string;
  version: string;
  initial?: string;
  data?: DataSchema;
  phases: Record<string, Phase>;
  actions: Record<string, ActionMeta>;
  plugs: Record<string, Plug>;
}

export interface BlackboxModule extends BlackboxConfig {}

export interface BlackboxState {
  phase: string;
  data: any;
  loading: boolean;
  error?: {
    message: string;
    code?: number;
  };
}

// Event history entry
export interface HistoryEntry {
  type: string;
  payload?: any;
  phase: string;
  timestamp: number;
}

// Snapshot for save/restore
export interface Snapshot {
  version: string;
  phase: string;
  data: any;
  timestamp: number;
}

// Introspection API
export interface Introspection {
  allPaths(): string[][];
  allActions(): Array<{ name: string; phase: string; label: string; params?: Record<string, string> }>;
  getPhase(name: string): Phase | undefined;
  canReach(from: string, to: string): boolean;
  pathExists(path: string[]): boolean;
}

export interface Blackbox {
  can(): string[];
  do(action: string, payload?: any): void;
  where(): BlackboxState;
  isBusy(): boolean;
  hasTag(tag: string): boolean;
  on(event: 'error' | 'done' | 'change', callback: (data: any) => void): void;
  use(plugs: Record<string, Plug>): void;

  // New features from spec
  introspect(): Introspection;
  history(): HistoryEntry[];
  replay(history: HistoryEntry[]): void;
  clearHistory(): void;
  snapshot(): Snapshot;
}
