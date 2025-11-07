// Behavioral tests for Blackbox Protocol Runtime
// These tests validate the behaviors specified in STATE_MACHINE_SPEC.md

import { describe, it, expect, vi } from 'vitest';
import { createBlackbox } from './runtime';
import { assign } from './helpers';
import type { BlackboxConfig } from './types';

describe('Blackbox Protocol - Behavioral Specifications', () => {
  describe('Spec 1: Event Payload in Guards', () => {
    it('should pass full event payload to guards', async () => {
      const guardSpy = vi.fn((data, event) => {
        expect(event.type).toBe('ADD_TO_CART');
        expect(event.productId).toBe('1');
        expect(event.quantity).toBe(2);
        return true;
      });

      const config: BlackboxConfig = {
        id: 'test',
        version: '1.0.0',
        phases: {
          browsing: {
            on: {
              ADD_TO_CART: {
                target: 'cart',
                cond: 'canAdd'
              }
            }
          },
          cart: { type: 'final' }
        },
        actions: {
          ADD_TO_CART: { label: 'Add to cart' }
        },
        operations: {
          canAdd: {
            type: 'guard',
            input: { event: { type: 'object' } },
            output: {}
          }
        }
      };

      const blackbox = createBlackbox(config).start();
      blackbox.use({ canAdd: guardSpy });
      blackbox.do('ADD_TO_CART', { productId: '1', quantity: 2 });

      await new Promise(resolve => setTimeout(resolve, 10));
      expect(guardSpy).toHaveBeenCalled();
    });
  });

  describe('Spec 2: Invoke with Input', () => {
    it('should compute input and pass it to service', async () => {
      const serviceSpy = vi.fn(async (data, input) => {
        // input should be the computed value, not raw event
        expect(input).toEqual({
          query: 'laptop',
          userId: 'user-123',
          filters: { category: 'electronics' }
        });
        return { results: [] };
      });

      const config: BlackboxConfig = {
        id: 'test',
        version: '1.0.0',
        data: {
          userId: { type: 'string', default: 'user-123' },
          filters: { type: 'object', default: { category: 'electronics' } }
        },
        phases: {
          idle: {
            on: { SEARCH: 'searching' }
          },
          searching: {
            invoke: {
              src: 'searchAPI',
              input: (data, event) => ({
                query: event.query,
                userId: data.userId,
                filters: data.filters
              }),
              onDone: 'results'
            }
          },
          results: { type: 'final' }
        },
        actions: {
          SEARCH: { label: 'Search' }
        },
        operations: {
          searchAPI: {
            type: 'service',
            input: {
              query: { type: 'string' },
              userId: { type: 'string' },
              filters: { type: 'object' }
            },
            output: {
              results: { type: 'array' }
            }
          }
        }
      };

      const blackbox = createBlackbox(config).start();
      blackbox.use({ searchAPI: serviceSpy });
      blackbox.do('SEARCH', { query: 'laptop' });

      await new Promise(resolve => setTimeout(resolve, 10));
      expect(serviceSpy).toHaveBeenCalled();
    });
  });

  describe('Spec 3: Multiple Actions Execute in Order', () => {
    it('should execute actions sequentially with each seeing previous updates', async () => {
      const executionOrder: string[] = [];

      const config: BlackboxConfig = {
        id: 'test',
        version: '1.0.0',
        data: {
          cart: { type: 'array', default: [{ id: '1', price: 100 }] },
          total: { type: 'number', default: 0 }
        },
        phases: {
          cart: {
            on: {
              CHECKOUT: {
                target: 'payment',
                actions: ['calculateTotal', 'applyTax']
              }
            }
          },
          payment: { type: 'final' }
        },
        actions: {
          CHECKOUT: { label: 'Checkout' }
        },
        operations: {
          calculateTotal: {
            type: 'action',
            input: { event: { type: 'object' } },
            output: {}
          },
          applyTax: {
            type: 'action',
            input: { event: { type: 'object' } },
            output: {}
          }
        }
      };

      const plugs = {
        calculateTotal: assign((data) => {
          executionOrder.push('calculateTotal');
          return {
            total: data.cart.reduce((sum: number, item: any) => sum + item.price, 0)
          };
        }),
        applyTax: assign((data) => {
          executionOrder.push('applyTax');
          // Should see the total from calculateTotal
          expect(data.total).toBe(100);
          return {
            total: data.total * 1.08
          };
        })
      };

      const blackbox = createBlackbox(config).start();
      blackbox.use(plugs);
      blackbox.do('CHECKOUT');

      await new Promise(resolve => setTimeout(resolve, 10));

      expect(executionOrder).toEqual(['calculateTotal', 'applyTax']);
      expect(blackbox.where().data.total).toBe(108);
    });
  });

  describe('Spec 4: Entry/Exit Lifecycle', () => {
    it('should execute exit, then entry plugs in correct order', async () => {
      const executionOrder: string[] = [];

      const config: BlackboxConfig = {
        id: 'test',
        version: '1.0.0',
        phases: {
          browsing: {
            exit: 'saveScroll',
            on: { SEARCH: 'searching' }
          },
          searching: {
            entry: 'startLoading',
            type: 'final'
          }
        },
        actions: {
          SEARCH: { label: 'Search' }
        },
        operations: {
          saveScroll: {
            type: 'action',
            input: { event: { type: 'object' } },
            output: {}
          },
          startLoading: {
            type: 'action',
            input: { event: { type: 'object' } },
            output: {}
          }
        }
      };

      const plugs = {
        saveScroll: () => {
          executionOrder.push('exit:saveScroll');
          return {};
        },
        startLoading: () => {
          executionOrder.push('entry:startLoading');
          return {};
        }
      };

      const blackbox = createBlackbox(config).start();
      blackbox.use(plugs);
      blackbox.do('SEARCH');

      await new Promise(resolve => setTimeout(resolve, 10));

      expect(executionOrder).toEqual([
        'exit:saveScroll',
        'entry:startLoading'
      ]);
    });
  });

  describe('Spec 5: Assign Returns Immutable Data', () => {
    it('should not mutate original data', () => {
      const config: BlackboxConfig = {
        id: 'test',
        version: '1.0.0',
        data: {
          cart: { type: 'array', default: [{ id: '1' }] }
        },
        phases: {
          cart: {
            on: {
              ADD: {
                target: 'cart',
                actions: 'addItem'
              }
            }
          }
        },
        actions: {
          ADD: { label: 'Add' }
        },
        operations: {
          addItem: {
            type: 'action',
            input: { event: { type: 'object' } },
            output: {}
          }
        }
      };

      const plugs = {
        addItem: assign((data, event) => ({
          cart: [...data.cart, event.item]
        }))
      };

      const blackbox = createBlackbox(config).start();
      blackbox.use(plugs);
      const originalData = blackbox.where().data;
      const originalCart = originalData.cart;

      blackbox.do('ADD', { item: { id: '2' } });

      const newData = blackbox.where().data;

      // Original should be unchanged (immutability)
      expect(originalCart).toEqual([{ id: '1' }]);
      // New data should have both items
      expect(newData.cart).toEqual([{ id: '1' }, { id: '2' }]);
    });
  });

  describe('Spec 6: onDone Receives Service Result', () => {
    it('should pass service result to onDone transition', async () => {
      const actionSpy = vi.fn();

      const config: BlackboxConfig = {
        id: 'test',
        version: '1.0.0',
        phases: {
          idle: {
            on: { SEARCH: 'searching' }
          },
          searching: {
            invoke: {
              src: 'searchAPI',
              onDone: {
                target: 'results',
                actions: 'storeResults'
              }
            }
          },
          results: { type: 'final' }
        },
        actions: {
          SEARCH: { label: 'Search' }
        },
        operations: {
          searchAPI: {
            type: 'service',
            input: {},
            output: {
              products: { type: 'array' }
            }
          },
          storeResults: {
            type: 'action',
            input: { event: { type: 'object' } },
            output: {}
          }
        }
      };

      const plugs = {
        searchAPI: async () => {
          return { products: [{ id: '1', name: 'Laptop' }] };
        },
        storeResults: (data: any, event: any) => {
          actionSpy(event);
          expect(event.type).toBe('DONE');
          expect(event.data.products).toEqual([{ id: '1', name: 'Laptop' }]);
          return {};
        }
      };

      const blackbox = createBlackbox(config).start();
      blackbox.use(plugs);
      blackbox.do('SEARCH');

      await new Promise(resolve => setTimeout(resolve, 50));

      expect(actionSpy).toHaveBeenCalled();
    });
  });

  describe('Spec 7: Multiple Guarded Transitions', () => {
    it('should evaluate guards in order and take first match', async () => {
      const isVIPSpy = vi.fn(() => true);
      const isLargeSpy = vi.fn(() => true);

      const config: BlackboxConfig = {
        id: 'test',
        version: '1.0.0',
        data: {
          amount: { type: 'number', default: 15000 },
          user: { type: 'object', default: { tier: 'VIP' } }
        },
        phases: {
          reviewing: {
            on: {
              SUBMIT: [
                { target: 'autoApproved', cond: 'isVIP' },
                { target: 'manualReview', cond: 'isLargeAmount' },
                { target: 'rejected' }
              ]
            }
          },
          autoApproved: { type: 'final' },
          manualReview: { type: 'final' },
          rejected: { type: 'final' }
        },
        actions: {
          SUBMIT: { label: 'Submit' }
        },
        operations: {
          isVIP: {
            type: 'guard',
            input: { event: { type: 'object' } },
            output: {}
          },
          isLargeAmount: {
            type: 'guard',
            input: { event: { type: 'object' } },
            output: {}
          }
        }
      };

      const plugs = {
        isVIP: isVIPSpy,
        isLargeAmount: isLargeSpy
      };

      const blackbox = createBlackbox(config).start();
      blackbox.use(plugs);
      blackbox.do('SUBMIT');

      await new Promise(resolve => setTimeout(resolve, 10));

      expect(isVIPSpy).toHaveBeenCalled();
      expect(isLargeSpy).not.toHaveBeenCalled(); // Short-circuit
      expect(blackbox.where().phase).toBe('autoApproved');
    });
  });

  describe('Spec 8: Error Handling in Invoke', () => {
    it('should trigger onError on service failure', async () => {
      const errorHandlerSpy = vi.fn();

      const config: BlackboxConfig = {
        id: 'test',
        version: '1.0.0',
        phases: {
          checkout: {
            on: { PAY: 'paying' }
          },
          paying: {
            invoke: {
              src: 'processPayment',
              onDone: 'completed',
              onError: {
                target: 'failed',
                actions: 'logError'
              }
            }
          },
          completed: { type: 'final' },
          failed: { type: 'final' }
        },
        actions: {
          PAY: { label: 'Pay' }
        },
        operations: {
          processPayment: {
            type: 'service',
            input: {},
            output: {}
          },
          logError: {
            type: 'action',
            input: { event: { type: 'object' } },
            output: {}
          }
        }
      };

      const plugs = {
        processPayment: async () => {
          throw new Error('Payment declined');
        },
        logError: (data: any, event: any) => {
          errorHandlerSpy(event);
          expect(event.type).toBe('ERROR');
          expect(event.error.message).toBe('Payment declined');
          return {};
        }
      };

      const blackbox = createBlackbox(config).start();
      blackbox.use(plugs);
      blackbox.do('PAY');

      await new Promise(resolve => setTimeout(resolve, 50));

      expect(errorHandlerSpy).toHaveBeenCalled();
      expect(blackbox.where().phase).toBe('failed');
    });
  });

  describe('Introspection API', () => {
    it('should provide recipe introspection', () => {
      const config: BlackboxConfig = {
        id: 'test',
        version: '1.0.0',
        phases: {
          browsing: { on: { SEARCH: 'results' } },
          results: { on: { ADD: 'cart' } },
          cart: { on: { CHECKOUT: 'payment' } },
          payment: { type: 'final' }
        },
        actions: {
          SEARCH: { label: 'Search' },
          ADD: { label: 'Add' },
          CHECKOUT: { label: 'Checkout' }
        },
        operations: {}
      };

      const blackbox = createBlackbox(config).start();
      const intro = blackbox.introspect();

      // Test allPaths
      const paths = intro.allPaths();
      expect(paths.length).toBeGreaterThan(0);
      expect(paths[0]).toContain('browsing');

      // Test allActions
      const actions = intro.allActions();
      expect(actions).toContainEqual({
        name: 'SEARCH',
        phase: 'browsing',
        label: 'Search',
        params: undefined
      });

      // Test canReach
      expect(intro.canReach('browsing', 'payment')).toBe(true);
      expect(intro.canReach('payment', 'browsing')).toBe(false);

      // Test pathExists
      expect(intro.pathExists(['browsing', 'results', 'cart'])).toBe(true);
      expect(intro.pathExists(['browsing', 'payment'])).toBe(false);
    });
  });

  describe('History & Replay', () => {
    it('should track event history and support replay', async () => {
      const config: BlackboxConfig = {
        id: 'test',
        version: '1.0.0',
        phases: {
          idle: { on: { START: 'active' } },
          active: { on: { STOP: 'idle' } }
        },
        actions: {
          START: { label: 'Start' },
          STOP: { label: 'Stop' }
        },
        operations: {}
      };

      const blackbox = createBlackbox(config).start();

      blackbox.do('START');
      blackbox.do('STOP');

      const history = blackbox.history();

      expect(history).toHaveLength(2);
      expect(history[0].type).toBe('START');
      expect(history[1].type).toBe('STOP');

      // Clear and replay
      const blackbox2 = createBlackbox(config).start();
      blackbox2.replay(history);

      await new Promise(resolve => setTimeout(resolve, 10));

      expect(blackbox2.where().phase).toBe(blackbox.where().phase);
    });
  });

  describe('Snapshot & Restore', () => {
    it('should create and restore snapshots', () => {
      const config: BlackboxConfig = {
        id: 'test',
        version: '1.0.0',
        data: {
          count: { type: 'number', default: 0 }
        },
        phases: {
          idle: { on: { INC: { target: 'idle', actions: 'increment' } } }
        },
        actions: {
          INC: { label: 'Increment' }
        },
        operations: {
          increment: {
            type: 'action',
            input: { event: { type: 'object' } },
            output: {}
          }
        }
      };

      const plugs = {
        increment: assign((data) => ({
          count: data.count + 1
        }))
      };

      const blackbox = createBlackbox(config).start();
      blackbox.use(plugs);
      blackbox.do('INC');
      blackbox.do('INC');

      const snapshot = blackbox.snapshot();

      expect(snapshot.version).toBe('1.0.0');
      expect(snapshot.phase).toBe('idle');
      expect(snapshot.data.count).toBe(2);
      expect(snapshot.timestamp).toBeDefined();

      // Restore
      const restored = createBlackbox(config).restore(snapshot);
      expect(restored.where().data.count).toBe(2);
    });
  });
});
