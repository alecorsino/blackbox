# blackbox-cli

Terminal demo for Blackbox Protocol - A complete shopping journey orchestrator.

## Run it

From the project root:

```bash
pnpm cli
```

Or from this directory:

```bash
pnpm start
```

## What it does

This CLI demonstrates the Blackbox Protocol in action:

1. **Pure API Orchestration** - No manual API calls, the blackbox handles everything
2. **Conversational UX** - Larry-style interaction (list actions → pick → execute)
3. **Real-time State** - See loading indicators, cart updates, errors
4. **Discoverable** - The app doesn't hardcode flows, it asks the blackbox "what can I do?"

## The Recipe

See [shopping.blackbox.ts](src/shopping.blackbox.ts) for the complete journey definition.

It orchestrates:
- Product search
- Cart management
- Checkout flow
- Payment processing
- Order confirmation

All in ~200 lines of declarative config.
