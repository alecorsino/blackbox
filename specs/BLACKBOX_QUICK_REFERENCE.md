# Blackbox Program Protocol v2.0 - Quick Reference

## The 30-Second Overview

A Blackbox program has **4 required parts** and **4 optional parts**:

### Required (Core Protocol)
```typescript
{
  id: "my-workflow",              // Unique identifier
  version: "1.0.0",               // Semantic version
  phases: { ... },                // State machine
  operations: { ... }             // What plugs must do
}
```

### Optional (Enhanced)
```typescript
{
  initial: "startPhase",          // Starting phase (or use first)
  models: { ... },                // Domain types (Product, User, etc.)
  data: { ... },                  // Machine state schema
  events: { ... }                 // Event metadata for discovery
}
```

---

## The Three Data Layers

```
STATIC → models     (Product, User, Order)
           ↓ $ref
DYNAMIC → data      (products[], cart[], showPromo)
           ↓ session.do()
TRANSIENT → event   ({ query: "laptop" })
```

- **models**: Reusable type definitions
- **data**: Living session memory
- **event**: One-time user input

---

## Operation Types

### 1. `service` - Async Work
```typescript
{
  type: 'service',
  input: { query: { type: 'string' } },
  output: { products: { type: 'array' } }
}
```
**Used in**: `invoke.src`
**Plug**: `async (data, input) => { ... }`

### 2. `action` - Sync Updates
```typescript
{
  type: 'action',
  input: { event: { type: 'object' } },
  output: { type: 'object' }
}
```
**Used in**: `entry`, `exit`, `transition.actions`
**Plug**: `assign((data, event) => ({ ... }))`

### 3. `guard` - Conditions
```typescript
{
  type: 'guard',
  input: { event: { type: 'object' } },
  output: { type: 'boolean' }
}
```
**Used in**: `transition.guard`
**Plug**: `(data, event) => boolean`

---

## Phase Structure

```typescript
"phaseName": {
  // Lifecycle
  entry: "operationName",           // or ["op1", "op2"]
  exit: "operationName",
  
  // Transitions
  on: {
    EVENT: "targetPhase",           // Simple
    EVENT: {                        // With guard
      target: "targetPhase",
      guard: "guardOp",
      actions: ["action1", "action2"]
    },
    EVENT: [                        // Multiple guards
      { target: "phase1", guard: "guard1" },
      { target: "phase2", guard: "guard2" },
      { target: "phase3" }          // Fallback
    ]
  },
  
  // Async operation
  invoke: {
    src: "serviceOp",
    input: "(data, event) => ({ ... })",
    onDone: { target: "success", actions: "saveResult" },
    onError: { target: "error", actions: "logError" }
  },
  
  // Metadata
  tags: ["loading", "error"],
  type: "final"                     // Terminal state
}
```

---

## $ref Usage

```typescript
// Define model
models: {
  Product: {
    type: 'object',
    properties: {
      id: { type: 'string' },
      name: { type: 'string' }
    }
  }
}

// Reference in data
data: {
  products: {
    type: 'array',
    items: { $ref: '#/models/Product' }  // ← Reference
  }
}

// Reference in operations
operations: {
  searchProducts: {
    output: {
      products: {
        type: 'array',
        items: { $ref: '#/models/Product' }  // ← Same model
      }
    }
  }
}
```

---

## Minimal Example

```typescript
{
  id: "counter",
  version: "1.0.0",
  
  data: {
    count: { type: 'number', default: 0 }
  },
  
  operations: {
    increment: {
      type: 'action',
      input: { type: 'object' },
      output: { type: 'object' }
    }
  },
  
  phases: {
    counting: {
      on: {
        INCREMENT: {
          target: 'counting',
          actions: 'increment'
        }
      }
    }
  }
}
```

**Plug**:
```typescript
{
  increment: assign((data) => ({ count: data.count + 1 }))
}
```

---

## Complete Feature Checklist

Use this to ensure you're using all available features:

### Identity
- [ ] `id` - Unique workflow identifier
- [ ] `version` - Semantic version string
- [ ] `initial` - Starting phase name

### Domain Types
- [ ] `models` - Reusable type definitions
- [ ] `models[name].type` - object/array/string/number/boolean
- [ ] `models[name].properties` - Object fields
- [ ] `models[name].required` - Required fields

### Machine State
- [ ] `data` - State schema
- [ ] `data[field].type` - Field type
- [ ] `data[field].$ref` - Reference to model
- [ ] `data[field].default` - Default value
- [ ] `data[field].required` - Required field
- [ ] Validation: min/max, minLength/maxLength, pattern

### User Events
- [ ] `events` - Event metadata
- [ ] `events[name].label` - Display name
- [ ] `events[name].description` - Help text
- [ ] `events[name].params` - Parameter schema
- [ ] `params[field].$ref` - Reference model in params

### Operations
- [ ] `operations` - Protocol contracts
- [ ] `operations[name].type` - service/action/guard
- [ ] `operations[name].input` - Input schema
- [ ] `operations[name].output` - Output schema
- [ ] `operations[name].description` - Documentation
- [ ] `metadata.intent` - Semantic purpose
- [ ] `metadata.service` - Logical service name
- [ ] `metadata.operation` - Logical method name
- [ ] `metadata.specRef` - External spec reference
- [ ] `metadata.timeout` - Timeout in ms
- [ ] `metadata.retries` - Auto-retry count
- [ ] `metadata.cacheable` - Enable caching
- [ ] `metadata.ttl` - Cache TTL in ms

### State Machine
- [ ] `phases` - State definitions
- [ ] `phases[name].on` - Event transitions
- [ ] Simple transition: `EVENT: "target"`
- [ ] Guarded transition: `{ target, guard, actions }`
- [ ] Multiple guards: `[{...}, {...}]`
- [ ] `phases[name].invoke` - Async operation
- [ ] `invoke.src` - Operation name
- [ ] `invoke.input` - Input computer function
- [ ] `invoke.onDone` - Success transition
- [ ] `invoke.onError` - Error transition
- [ ] `phases[name].entry` - Entry actions
- [ ] `phases[name].exit` - Exit actions
- [ ] `phases[name].tags` - Metadata tags
- [ ] `phases[name].type` - Mark as 'final'

---

## Common Patterns

### Pattern 1: API Call with Result Storage
```typescript
phases: {
  loading: {
    invoke: {
      src: 'fetchData',
      input: '(data, event) => ({ id: event.id })',
      onDone: { target: 'success', actions: 'storeData' }
    }
  }
}

operations: {
  fetchData: { type: 'service', input: {...}, output: {...} },
  storeData: { type: 'action', input: {...}, output: {...} }
}
```

### Pattern 2: Multiple Guards (First Match)
```typescript
on: {
  SUBMIT: [
    { target: 'fastTrack', guard: 'isVIP' },
    { target: 'review', guard: 'isLarge' },
    { target: 'autoApprove' }  // Default
  ]
}
```

### Pattern 3: Retry Logic
```typescript
phases: {
  processing: {
    invoke: {
      src: 'apiCall',
      onDone: 'success',
      onError: 'failed'
    }
  },
  failed: {
    on: {
      RETRY: [
        { target: 'processing', guard: 'canRetry' },
        { target: 'maxRetries' }
      ]
    }
  }
}
```

### Pattern 4: Sequential Actions
```typescript
on: {
  CHECKOUT: {
    target: 'payment',
    actions: ['validateCart', 'calculateTotal', 'applyTax']
  }
}
```

### Pattern 5: Lifecycle Hooks
```typescript
phases: {
  myPhase: {
    entry: 'onEnter',   // Runs when entering
    exit: 'onExit',     // Runs when leaving
    on: { ... }
  }
}
```

---

## Validation Cheat Sheet

### Runtime Validates
1. ✅ Event params → `events[name].params`
2. ✅ Invoke input → `operations[name].input` (with $ref)
3. ✅ Plug output → `operations[name].output` (with $ref)
4. ✅ Assign updates → `data` schema (with $ref)

### Common Errors
```
ValidationError: Operation 'searchProducts' input.query: required field missing
ValidationError: Operation 'searchProducts' output: expected array, got object
ValidationError: $ref '#/models/Product' not found in models
ValidationError: Circular $ref detected: Product → Category → Product
```

---

## TypeScript vs JSON

### TypeScript Program
```typescript
// .program.ts
export default {
  invoke: {
    input: (data, event) => ({ query: event.query })  // Function
  }
}
```

### JSON Program
```json
{
  "invoke": {
    "input": "(data, event) => ({ query: event.query })"  // String
  }
}
```

Runtime parses strings into functions.

---

## Key Design Rules

1. **Programs = Protocol Only**
   - ❌ No plugs in program
   - ❌ No URLs, HTTP methods, GraphQL queries
   - ✅ Only contracts (what, not how)

2. **Models are Static**
   - ❌ Never mutate model definitions
   - ✅ Reference via `$ref`
   - ✅ Reuse across data/operations/actions

3. **Data is Dynamic**
   - ❌ Don't mutate directly
   - ✅ Update via `assign()`
   - ✅ Can contain anything typed

4. **Events are Transient**
   - ❌ Don't persist unless assigned
   - ✅ Validate against events.params
   - ✅ Flow into operations

5. **Operations Define Contracts**
   - ✅ Always specify input/output
   - ✅ Use $ref to reference models
   - ✅ Add specRef for external APIs

---

## Next Steps

1. **Read**: Full spec in `BLACKBOX_PROGRAM_SPEC.md`
2. **Copy**: Complete example from spec
3. **Modify**: Change IDs, phases, operations
4. **Validate**: Check against rules above
5. **Implement**: Create plugs at runtime

---

**The Golden Rule**: The program is pure protocol. Plugs are pure implementation. Never mix them.
