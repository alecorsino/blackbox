// shopping.blackbox.ts
// A complete shopping journey orchestration

import { createBlackbox, mock, assign, type BlackboxConfig } from '@blackbox/protocol';

const shoppingConfig: BlackboxConfig = {
  id: 'shopping-journey',
  version: '1.0.0',
  initial: 'idle',

  data: {
    query: { type: 'string', default: '' },
    products: { type: 'array', default: [] },
    cart: { type: 'array', default: [] },
    orderId: { type: 'string', default: '' },
    userId: { type: 'string', required: true }
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

  actions: {
    START: {
      label: 'Start shopping',
      description: 'Begin your shopping journey'
    },
    SEARCH: {
      label: 'Search products',
      description: 'Search for products in the catalog',
      params: { query: 'string' }
    },
    SEARCH_AGAIN: {
      label: 'Search again',
      description: 'Try a different search'
    },
    ADD_TO_CART: {
      label: 'Add to cart',
      description: 'Add this product to your cart',
      params: { productId: 'string' }
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
      params: { itemId: 'string' }
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

  plugs: {
    // Mock API calls for demo
    searchProducts: mock(
      {
        products: [
          { id: '1', name: 'Laptop Pro', price: 1299 },
          { id: '2', name: 'Wireless Mouse', price: 29 },
          { id: '3', name: 'Mechanical Keyboard', price: 149 },
          { id: '4', name: 'USB-C Hub', price: 79 }
        ]
      },
      500
    ),

    addToCart: async (data: any, input: any) => {
      await new Promise(resolve => setTimeout(resolve, 300));
      // input contains { productId, products } from invoke.input
      const product = input.products.find((p: any) => p.id === input.productId);
      if (!product) throw new Error('Product not found');
      return { item: { ...product, cartItemId: `cart-${Date.now()}` } };
    },

    removeFromCart: async (ctx: any, event: any) => {
      await new Promise(resolve => setTimeout(resolve, 300));
      return { itemId: event.itemId };
    },

    processPayment: mock(
      { orderId: `ORDER-${Math.random().toString(36).substring(7).toUpperCase()}`, success: true },
      1000
    ),

    // Actions (immutable data updates using assign)
    storeProducts: assign((data, event) => ({
      products: event.data.products
    })),

    addItemToCart: assign((data, event) => ({
      cart: [...data.cart, event.data.item]
    })),

    removeItemFromCart: assign((data, event) => ({
      cart: data.cart.filter((item: any) => item.cartItemId !== event.data.itemId)
    })),

    storeOrderId: assign((data, event) => ({
      orderId: event.data.orderId
    })),

    logError: (ctx: any, event: any) => {
      console.error('❌ Error:', event.error?.message || 'Unknown error');
    },

    // Guards
    hasProductId: (ctx: any, event: any) => {
      return !!event.productId;
    }
  }
};

export default createBlackbox(shoppingConfig);
