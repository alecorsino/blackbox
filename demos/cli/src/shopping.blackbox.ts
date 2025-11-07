// shopping.blackbox.ts - v1.3
// A complete shopping journey orchestration - PURE PROTOCOL (no implementation)

import type { BlackboxConfig } from '@blackbox/protocol';

// v1.3: Program is PURE PROTOCOL - no plugs, no URLs, no implementation
export const shoppingProgram: BlackboxConfig = {
  id: 'shopping-journey',
  version: '1.3.0',
  initial: 'idle',

  // Layer 1: Domain Types (static, reusable)
  models: {
    Product: {
      id: { type: 'string', required: true },
      name: { type: 'string', required: true },
      price: { type: 'number', required: true }
    },
    CartItem: {
      id: { type: 'string', required: true },
      name: { type: 'string', required: true },
      price: { type: 'number', required: true },
      cartItemId: { type: 'string', required: true }
    }
  },

  // Layer 2: Machine State (dynamic, can $ref models, can be anything typed)
  data: {
    query: { type: 'string', default: '' },
    products: {
      type: 'array',
      items: { $ref: '#/models/Product' },  // References model!
      default: []
    },
    cart: {
      type: 'array',
      items: { $ref: '#/models/CartItem' },
      default: []
    },
    orderId: { type: 'string', default: '' },
    userId: { type: 'string', required: true },

    // Free-form app state (not domain models, but still typed!)
    showPromo: { type: 'boolean', default: false },
    currentStep: { type: 'number', default: 1 }
  },

  phases: {
    idle: {
      on: {
        START: 'browsing'
      }
    },

    browsing: {
      on: {
        SEARCH: { target: 'searching' },
        VIEW_CART: 'viewingCart',
        QUIT: 'done'
      }
    },

    searching: {
      invoke: {
        src: 'searchProducts',
        input: (data, event) => ({
          query: event.query
        }),
        onDone: { target: 'viewingProducts', actions: 'storeProducts' },
        onError: { target: 'error', actions: 'logError' }
      },
      tags: ['loading']
    },

    viewingProducts: {
      on: {
        ADD_TO_CART: {
          target: 'addingToCart',
          cond: 'hasProductId'
        },
        SEARCH_AGAIN: 'browsing',
        VIEW_CART: 'viewingCart',
        QUIT: 'done'
      }
    },

    addingToCart: {
      invoke: {
        src: 'addToCart',
        input: (data, event) => ({
          productId: event.productId,
          products: data.products
        }),
        onDone: { target: 'viewingProducts', actions: 'addItemToCart' },
        onError: 'error'
      },
      tags: ['loading']
    },

    viewingCart: {
      on: {
        CHECKOUT: 'checkout',
        CONTINUE_SHOPPING: 'browsing',
        REMOVE_ITEM: { target: 'removingItem' },
        QUIT: 'done'
      }
    },

    removingItem: {
      invoke: {
        src: 'removeFromCart',
        input: (data, event) => ({
          itemId: event.itemId,
          cart: data.cart
        }),
        onDone: { target: 'viewingCart', actions: 'removeItemFromCart' },
        onError: 'error'
      },
      tags: ['loading']
    },

    checkout: {
      on: {
        PAY: 'paying',
        CANCEL: 'viewingCart'
      }
    },

    paying: {
      invoke: {
        src: 'processPayment',
        input: (data, event) => ({
          cart: data.cart,
          userId: data.userId
        }),
        onDone: { target: 'completed', actions: 'storeOrderId' },
        onError: 'error'
      },
      tags: ['loading']
    },

    completed: {
      type: 'final'
    },

    error: {
      on: {
        RETRY: 'browsing',
        QUIT: 'done'
      }
    },

    done: {
      type: 'final'
    }
  },

  // Layer 3: User Actions (transient events)
  actions: {
    START: {
      label: 'Start shopping',
      description: 'Begin your shopping journey'
    },
    SEARCH: {
      label: 'Search products',
      description: 'Search for products in the catalog',
      params: {
        query: { type: 'string', minLength: 1 }
      }
    },
    SEARCH_AGAIN: {
      label: 'Search again',
      description: 'Try a different search'
    },
    ADD_TO_CART: {
      label: 'Add to cart',
      description: 'Add this product to your cart',
      params: {
        productId: { type: 'string' }
      }
    },
    VIEW_CART: {
      label: 'View cart',
      description: 'See what\'s in your cart'
    },
    CONTINUE_SHOPPING: {
      label: 'Continue shopping',
      description: 'Go back to browsing'
    },
    REMOVE_ITEM: {
      label: 'Remove item',
      description: 'Remove an item from cart',
      params: {
        itemId: { type: 'string' }
      }
    },
    CHECKOUT: {
      label: 'Checkout',
      description: 'Proceed to payment'
    },
    PAY: {
      label: 'Pay now',
      description: 'Complete your purchase'
    },
    CANCEL: {
      label: 'Cancel',
      description: 'Go back'
    },
    RETRY: {
      label: 'Retry',
      description: 'Try again'
    },
    QUIT: {
      label: 'Quit',
      description: 'Exit the app'
    }
  },

  // v1.3: Operation Contracts (WHAT APIs this workflow needs)
  operations: {
    searchProducts: {
      type: 'service',
      description: 'Search product catalog by keyword',
      input: {
        query: { type: 'string', minLength: 1, maxLength: 100 }
      },
      output: {
        products: {
          type: 'array',
          items: { $ref: '#/models/Product' }
        }
      },
      metadata: {
        intent: 'product-search',
        service: 'ProductService',
        operation: 'search',
        specRef: 'specs/shopping-api.yaml#/paths/~1products~1search/get'
      }
    },

    addToCart: {
      type: 'service',
      description: 'Add product to shopping cart',
      input: {
        productId: { type: 'string' },
        products: {
          type: 'array',
          items: { $ref: '#/models/Product' }
        }
      },
      output: {
        item: { $ref: '#/models/CartItem' }
      },
      metadata: {
        intent: 'cart-add',
        service: 'CartService',
        operation: 'addItem'
      }
    },

    removeFromCart: {
      type: 'service',
      description: 'Remove item from shopping cart',
      input: {
        itemId: { type: 'string' },
        cart: {
          type: 'array',
          items: { $ref: '#/models/CartItem' }
        }
      },
      output: {
        itemId: { type: 'string' }
      },
      metadata: {
        intent: 'cart-remove',
        service: 'CartService',
        operation: 'removeItem'
      }
    },

    processPayment: {
      type: 'service',
      description: 'Process payment for cart items',
      input: {
        cart: {
          type: 'array',
          items: { $ref: '#/models/CartItem' }
        },
        userId: { type: 'string' }
      },
      output: {
        orderId: { type: 'string' },
        success: { type: 'boolean' }
      },
      metadata: {
        intent: 'payment-process',
        service: 'PaymentService',
        operation: 'process',
        specRef: 'specs/payment-api.yaml#/paths/~1payment/post'
      }
    },

    storeProducts: {
      type: 'action',
      description: 'Store search results in machine state',
      input: {
        event: { type: 'object' }  // DONE event with data
      },
      output: {}  // Partial state updates (dynamic)
    },

    addItemToCart: {
      type: 'action',
      description: 'Add cart item to state',
      input: {
        event: { type: 'object' }
      },
      output: {}  // Partial state updates (dynamic)
    },

    removeItemFromCart: {
      type: 'action',
      description: 'Remove item from cart in state',
      input: {
        event: { type: 'object' }
      },
      output: {}  // Partial state updates (dynamic)
    },

    storeOrderId: {
      type: 'action',
      description: 'Store order ID in state',
      input: {
        event: { type: 'object' }
      },
      output: {}  // Partial state updates (dynamic)
    },

    logError: {
      type: 'action',
      description: 'Log error to console',
      input: {
        event: { type: 'object' }
      },
      output: {}  // No state updates
    },

    hasProductId: {
      type: 'guard',
      description: 'Check if event has productId',
      input: {
        event: { type: 'object' }
      },
      output: {}  // Guards return boolean (primitive, not an object schema)
    }
  }

  // NO PLUGS IN PROGRAM! Provided at runtime via session.use()
};

export default shoppingProgram;
