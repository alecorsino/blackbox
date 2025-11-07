# Blackbox Protocol - Quick Start

**Your project is ready to run!** 🚀

## What You Built

A complete monorepo with:
- **`@blackbox/protocol`** - The core runtime library
- **`blackbox-cli`** - A terminal shopping app demonstrating the protocol

## Run It Now

```bash
# From the project root
pnpm cli
```

This starts an interactive shopping journey where you can:
1. Search for products
2. Add items to cart
3. Checkout and pay
4. Get order confirmation

**All orchestrated automatically** - no manual API calls, just pure conversational flow.

## How to Use It

When you run `pnpm cli`, you'll see:

```
┌─────────────────────────────────────────┐
│       🎮 BLACKBOX PROTOCOL v1.0        │
│      Shopping Journey Orchestrator      │
└─────────────────────────────────────────┘

Phase: browsing

What do you want to do?

  1. Search products (needs: query)
  2. View cart
  3. Quit

>
```

Just type a number and press Enter. The blackbox handles everything else.

## Project Structure

```
blackbox/
├── packages/
│   ├── protocol/          # The library
│   │   ├── src/
│   │   │   ├── types.ts      # TypeScript types
│   │   │   ├── runtime.ts    # The interpreter
│   │   │   ├── plugs.ts      # Built-in plugs (http, mock, etc.)
│   │   │   └── index.ts      # Public API
│   │   └── dist/             # Built library
│   │
│   └── cli/               # The demo app
│       ├── src/
│       │   ├── shopping.blackbox.ts  # The recipe/flow
│       │   └── index.ts              # Terminal UI
│       └── dist/          # Built app
│
├── README.md              # Full documentation
├── SETUP.md              # Setup instructions
└── pnpm-workspace.yaml   # Workspace config
```

## Development Mode

Want to modify the code and see changes live?

```bash
# Terminal 1: Watch the library
pnpm --filter @blackbox/protocol dev

# Terminal 2: Rebuild CLI when needed
pnpm --filter blackbox-cli build
pnpm cli
```

## Next Steps

1. **Explore the Recipe**: Check out `demos/cli/src/shopping.blackbox.ts` to see how phases, actions, and plugs work together
2. **Modify the Flow**: Add new phases, change transitions, swap plugs
3. **Create Your Own**: Copy the shopping recipe and adapt it to your own business journey
4. **Use the Library**: Import `@blackbox/protocol` in any TypeScript project

## Key Files to Look At

- **`packages/protocol/src/runtime.ts`** - The core interpreter that runs blackbox recipes
- **`packages/protocol/src/types.ts`** - All TypeScript interfaces
- **`demos/cli/src/shopping.blackbox.ts`** - A complete example recipe
- **`demos/cli/src/index.ts`** - How to consume the protocol in a real app

## The Developer Experience

```typescript
import { createBlackbox, mock } from '@blackbox/protocol';

const myFlow = createBlackbox({
  id: 'my-flow',
  phases: { /* ... */ },
  actions: { /* ... */ },
  plugs: { /* ... */ }
});

const session = myFlow.start();

// Discover what's possible
session.can(); // → ['ACTION1', 'ACTION2']

// Do something
session.do('ACTION1', { param: 'value' });

// Check state
session.where(); // → { phase: 'active', loading: false, data: {...} }
```

## Why This Matters

Before Blackbox:
```typescript
// Manual API orchestration (scattered, brittle)
const products = await fetch('/api/products');
if (products.ok) {
  const data = await products.json();
  setProducts(data);
  const cart = await fetch('/api/cart', { method: 'POST', body: JSON.stringify(selected) });
  // ... 50 more lines of glue code
}
```

With Blackbox:
```typescript
// Just ask what's possible and do it
session.do('SEARCH', { query: 'laptops' });
// Everything else is orchestrated automatically
```

## Commands Reference

```bash
# Install everything
pnpm install

# Build all packages
pnpm build

# Run the CLI demo
pnpm cli

# Build just the library
pnpm --filter @blackbox/protocol build

# Build just the CLI
pnpm --filter blackbox-cli build
```

---

**You just shipped the future of API orchestration.** 🎸

The protocol is yours. The recipes are yours. Now go build something nobody's seen before.
