# Blackbox Protocol

> "One file. Any backend. Any device. Zero glue code."

**The missing orchestration layer for APIs.**

## What is Blackbox?

Blackbox Protocol solves the fundamental problem in distributed systems: **business logic scattered across clients**.

When you have a backend with APIs, the *orchestration* of those APIs—what to call, in what order, with what error handling—lives in the UI code. This leads to:

- 🔴 Duplicated logic across web, mobile, etc.
- 🔴 No single source of truth for business flows
- 🔴 "How do I use this API?" documentation hell
- 🔴 Brittle, hard-to-change journeys

**Blackbox fixes this.** You define your business journey once in a `.blackbox.ts` file, and it runs anywhere—web, mobile, CLI, AI agents—orchestrating your APIs automatically.

## The 3 Primitives

```typescript
blackbox.can()      // → ['SEARCH', 'ADD_TO_CART', 'PAY']
blackbox.do('PAY')  // → triggers orchestration, calls APIs
blackbox.where()    // → { phase: 'paying', data: {...}, loading: true }
```

That's it. Forever.

## Project Structure

```
blackbox/
├── packages/
│   ├── protocol/          # @blackbox/protocol - The runtime library
│   │   └── src/
│   │       ├── types.ts
│   │       ├── runtime.ts
│   │       ├── plugs.ts
│   │       └── index.ts
│   └── cli/               # blackbox-cli - Terminal demo app
│       └── src/
│           ├── shopping.blackbox.ts
│           └── index.ts
```

## Quick Start

### Install dependencies
```bash
pnpm install
```

### Build the library
```bash
pnpm build
```

### Run the CLI demo
```bash
pnpm cli
```

Or in dev mode:
```bash
pnpm dev
```

## How It Works

### 1. Define Your Recipe (`.blackbox.ts`)

A recipe is a declarative config that describes your business journey:

```typescript
import { createBlackbox, http, mock } from '@blackbox/protocol';

export default createBlackbox({
  id: 'shopping-journey',
  version: '1.0.0',

  // Define your data shape
  data: {
    cart: { type: 'array', default: [] },
    orderId: { type: 'string' }
  },

  // Define phases (states) and transitions
  phases: {
    browsing: {
      on: { SEARCH: 'searching' }
    },
    searching: {
      invoke: {
        src: 'searchProducts',  // Calls your API
        onDone: { target: 'viewing', actions: 'storeResults' },
        onError: 'error'
      }
    },
    viewing: {
      on: { ADD_TO_CART: 'addingToCart' }
    },
    // ... more phases
  },

  // Discoverable actions with metadata
  actions: {
    SEARCH: { label: 'Search products', params: { query: 'string' } },
    ADD_TO_CART: { label: 'Add to cart' }
  },

  // Pluggable interactions - swap anytime
  plugs: {
    searchProducts: http('/api/products', 'GET'),
    // or: mock([{ id: 1, name: 'Laptop' }])
    // or: graphql(SEARCH_QUERY)
  }
});
```

### 2. Use It Anywhere

```typescript
import shopping from './shopping.blackbox';

const session = shopping.start({ userId: 'user-123' });

// What can I do right now?
session.can(); // → ['SEARCH', 'VIEW_CART', 'QUIT']

// Do something
session.do('SEARCH', { query: 'laptops' });

// Where am I?
session.where(); // → { phase: 'searching', loading: true, data: {...} }

// React to changes
session.on('change', (state) => {
  console.log('Now in phase:', state.phase);
});
```

### 3. It Orchestrates Everything

The blackbox:
- ✅ Calls your APIs automatically when entering phases
- ✅ Handles async operations and loading states
- ✅ Manages errors and retries
- ✅ Validates transitions with guards
- ✅ Keeps data in sync

**You never write API glue code again.**

## Why Not Just Use XState?

| Feature | XState | Blackbox Protocol |
|---------|--------|-------------------|
| Mental Model | State machines | Business phase orchestration |
| API Discovery | Read the machine definition | `blackbox.can()` |
| UI Integration | Manual event mapping | Auto-rendered from actions |
| Backend Orchestration | Services are functions | `invoke: { src: 'fetchProducts' }` auto-executes |
| Pluggability | Services in config | `plugs:` - swappable at runtime |
| Data Schema | Context is `any` | Typed, migratable schema |
| Loading/Error | Manual state branches | Built-in: `where().loading`, `on('error')` |

**XState is a tool. Blackbox is a protocol.**

We use state machine concepts under the hood, but expose a developer experience built for API orchestration, not generic state management.

## The Terminal Demo

The CLI app ([packages/cli](packages/cli)) is a full shopping journey orchestrator:

- 🔍 Search products
- 🛒 Add to cart
- 💳 Checkout & pay
- ✅ Order confirmation

All orchestrated through the blackbox. Zero manual API calls. Pure conversational flow (Leisure Suit Larry vibes, but for 2025).

## Built-in Plugs

```typescript
import { http, mock, memory, localStorage, log } from '@blackbox/protocol';

plugs: {
  fetchData: http('/api/data', 'GET'),
  mockData: mock({ items: [] }, 500),  // 500ms delay
  storeLocal: localStorage('cart', 'set'),
  logEvent: log('Action executed')
}
```

## Next Steps

- [ ] Add module composition (`use: cartModule`)
- [ ] Visual editor (Stately-style)
- [ ] Auto-UI generators (`<BlackboxRouter />`)
- [ ] Public registry: `blackbox.market`
- [ ] AI agent mode

## Philosophy

**"Don't document your API. Delete it. Ship a blackbox."**

The blackbox IS the documentation. It's runnable, discoverable, and self-describing.

---

**The day APIs died: November 7, 2025** 🚀

## License

MIT
