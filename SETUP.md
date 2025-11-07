# Setup Guide

## Prerequisites

- Node.js 18+
- pnpm (`npm install -g pnpm`)

## Installation

```bash
# Install all dependencies
pnpm install

# Build the protocol library
pnpm --filter @blackbox/protocol build

# Run the CLI demo
pnpm cli
```

## Development

```bash
# Watch mode for library
pnpm --filter @blackbox/protocol dev

# In another terminal, run the CLI
pnpm --filter blackbox-cli dev
```

## Structure

- `packages/protocol/` - The core @blackbox/protocol library
- `packages/cli/` - The terminal demo app

## Troubleshooting

**"Cannot find module @blackbox/protocol"**
- Make sure you ran `pnpm install` from the root
- Build the protocol library: `pnpm --filter @blackbox/protocol build`

**TypeScript errors**
- Try: `pnpm install` again
- Clear cache: `rm -rf node_modules && pnpm install`
