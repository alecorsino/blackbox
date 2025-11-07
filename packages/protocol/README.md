# @blackbox/protocol

The runtime library for Blackbox Protocol.

## Installation

```bash
pnpm add @blackbox/protocol
```

## Usage

```typescript
import { createBlackbox, http, mock } from '@blackbox/protocol';

const myFlow = createBlackbox({
  id: 'my-flow',
  version: '1.0.0',
  phases: { /* ... */ },
  actions: { /* ... */ },
  plugs: { /* ... */ }
});

const session = myFlow.start();
session.can();  // → ['ACTION1', 'ACTION2']
session.do('ACTION1');
```

See the [main README](../../README.md) for full documentation.
