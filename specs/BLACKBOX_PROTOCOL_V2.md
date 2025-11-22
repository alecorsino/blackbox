# Blackbox Protocol Specification v2.0

**Status**: Production Ready
**Date**: November 2025
**Philosophy**: Discovery over documentation. Protocol over implementation.

---

## Table of Contents

1. [Introduction](#1-introduction)
2. [Program Structure Overview](#2-program-structure-overview)
3. [The Three Data Layers](#3-the-three-data-layers)
4. [Events](#4-events)
5. [Operations](#5-operations)
6. [State Machine (Phases)](#6-state-machine-phases)
7. [Type System](#7-type-system)
8. [Models](#8-models)
9. [Data Schema](#9-data-schema)
10. [Validation Rules](#10-validation-rules)
11. [Complete Example](#11-complete-example)
12. [JSON Schema](#12-json-schema)

---

## 1. Introduction

### What is Blackbox Protocol?

Blackbox Protocol is a **specification for describing workflow orchestration as portable, self-documenting files**. Instead of documenting APIs, you ship a program file that declares:

- **What** the workflow needs (operations)
- **When** things happen (state machine phases)
- **What's possible** at each step (discoverable events)
- **What data flows** through the system (typed schemas)

The protocol enables:

- ✅ **Discovery**: UIs query `can()` to see available actions
- ✅ **Orchestration**: State machine drives the workflow
- ✅ **Portability**: Same program runs against any backend
- ✅ **Self-documentation**: The program IS the documentation

### Protocol vs Implementation

**Programs** (`.program.json` or `.program.ts`) contain **pure protocol**:
- ❌ Never contain URLs, HTTP methods, GraphQL queries, database queries
- ✅ Only contain contracts, schemas, and state machine logic

**Plugs** (provided at runtime) contain **pure implementation**:
- Swap REST → GraphQL → Mock without changing the program
- Different environments can use different plugs

### The Runtime API (Conceptual)

While the full Runtime API will be specified separately, programs enable these primitives:

```typescript
session.can()    // → ['SEARCH', 'ADD_TO_CART', 'CHECKOUT']
session.do('SEARCH', { query: 'laptop' })
session.where()  // → { phase: 'browsing', data: {...} }
```

---

## 2. Program Structure Overview

A Blackbox program is a JSON or TypeScript object with **7 core properties**:

```typescript
interface BlackboxProgram {
  // === IDENTITY ===
  id: string;                                    // Unique identifier
  version: string;                               // Semantic version (e.g., "1.0.0")

  // === TYPE SYSTEM ===
  models?: Record<string, DataSchema>;           // Domain type definitions (OPTIONAL)
  data?: Record<string, DataSchemaField>;        // Session state schema (OPTIONAL)

  // === INTERACTION ===
  events?: Record<string, EventDefinition>;      // User-triggerable actions (OPTIONAL)
  operations: Record<string, OperationContract>; // Protocol contracts (REQUIRED)

  // === STATE MACHINE ===
  phases: Record<string, Phase>;                 // Workflow states (REQUIRED)
  initial?: string;                              // Starting phase name (OPTIONAL)
}
```

### Required Properties

| Property | Purpose | Example |
|----------|---------|---------|
| `id` | Unique workflow identifier | `"shopping-checkout"` |
| `version` | Semantic version for evolution | `"2.1.0"` |
| `operations` | Contracts for what plugs must do | `{ searchProducts: {...} }` |
| `phases` | State machine definition | `{ browsing: {...}, checkout: {...} }` |

### Optional Properties

| Property | Purpose | Example |
|----------|---------|---------|
| `initial` | Starting phase (defaults to first phase) | `"browsing"` |
| `models` | Reusable domain types | `{ Product: {...}, User: {...} }` |
| `data` | Session state schema | `{ cart: [], query: "" }` |
| `events` | Discovery metadata + param schemas | `{ SEARCH: { label: "Search", params: {...} } }` |

---

## 3. The Three Data Layers

Blackbox uses three distinct layers for data:

```
┌─────────────────────────────────────────────┐
│ STATIC (models)                             │
│ Domain types: Product, User, Order          │
│ PURPOSE: Reusability, type safety           │
└─────────────────┬───────────────────────────┘
                  │ $ref
┌─────────────────▼───────────────────────────┐
│ DYNAMIC (data)                              │
│ Session state: products[], cart[], query    │
│ PURPOSE: Living memory of the workflow      │
└─────────────────┬───────────────────────────┘
                  │ session.do(event, params)
┌─────────────────▼───────────────────────────┐
│ TRANSIENT (event params)                    │
│ User input: { query: "laptop", qty: 2 }     │
│ PURPOSE: One-time stimuli                   │
└─────────────────────────────────────────────┘
```

### Layer 1: Models (Static)

**PURPOSE**: Define reusable domain types that never change during execution.

```typescript
models: {
  Product: {
    type: 'object',
    properties: {
      id: { type: 'string' },
      name: { type: 'string' },
      price: { type: 'number' }
    }
  }
}
```

**Used by**: Referenced via `$ref` in `data`, `operations`, and `events`.

### Layer 2: Data (Dynamic)

**PURPOSE**: Define the session state that evolves as the workflow progresses.

```typescript
data: {
  products: {
    type: 'array',
    items: { $ref: '#/models/Product' },
    default: []
  },
  query: {
    type: 'string',
    default: ''
  }
}
```

**Mutated by**: Operations with `type: 'action'` via the `assign` pattern.

### Layer 3: Event Params (Transient)

**PURPOSE**: Capture one-time user input that triggers transitions.

```typescript
// User calls: session.do('SEARCH', { query: 'laptop' })
// Event params: { query: 'laptop' }
// Validated against: events.SEARCH.params
```

**Flow**: Event params → validate → trigger transition → may update data via actions → discarded.

---

## 4. Events

**PURPOSE**: Define user-triggerable actions that drive state machine transitions. Enable runtime discovery via `can()`.

### Structure

```typescript
interface EventDefinition {
  label: string;                            // Human-readable name (REQUIRED)
  description?: string;                     // Detailed explanation
  params?: Record<string, DataSchemaField>; // Parameter schema for validation
}
```

### Example

```typescript
events: {
  SEARCH: {
    label: "Search products",
    description: "Search the product catalog by keyword",
    params: {
      query: {
        type: 'string',
        required: true,
        minLength: 1,
        maxLength: 100
      },
      filters: {
        type: 'object',
        required: false,
        properties: {
          category: { type: 'string' }
        }
      }
    }
  },

  ADD_TO_CART: {
    label: "Add to cart",
    params: {
      productId: { type: 'string', required: true },
      quantity: { type: 'number', default: 1, min: 1, max: 99 }
    }
  }
}
```

### How Events Are Used

#### 1. Discovery (can)

```typescript
// Runtime checks current phase's `on` handlers
session.can() // → ['SEARCH', 'ADD_TO_CART', 'CHECKOUT']

// Can return full metadata for UI rendering
session.can({ withMetadata: true })
// → [
//     { event: 'SEARCH', label: 'Search products', params: {...} },
//     ...
//   ]
```

#### 2. Validation (do)

```typescript
// User triggers event
session.do('SEARCH', { query: 'laptop' })

// Runtime validates params against events.SEARCH.params
// If valid → fires event to state machine
// If invalid → throws validation error
```

#### 3. Transitions (phases)

```typescript
phases: {
  browsing: {
    on: {
      SEARCH: {                  // ← Event name matches events.SEARCH
        target: 'searching',
        actions: 'storeQuery'    // Optional: update state
      }
    }
  }
}
```

### Why Events Are Protocol

Events define:
- ✅ **What actions exist** (discoverable via `can()`)
- ✅ **What inputs they need** (params schema)
- ✅ **How to present them** (label, description)
- ✅ **When they're available** (based on current phase)

This enables self-documenting, auto-generating UIs with zero hardcoding.

---

## 5. Operations

**PURPOSE**: Define contracts between the program and plugs. Each operation declares **what** it needs and **what** it returns, without specifying **how** it works.

### The Three Operation Types

#### Type 1: `service` - Async Operations

**PURPOSE**: Perform asynchronous work (API calls, database queries, long-running tasks).

**Signature**: `async (data, input) => output`

**Used in**: `invoke.src`

**Example**:
```typescript
operations: {
  searchProducts: {
    type: 'service',
    description: 'Search product catalog with filters',
    input: {
      type: 'object',
      properties: {
        query: { type: 'string', minLength: 1 },
        filters: { type: 'object' }
      },
      required: ['query']
    },
    output: {
      type: 'object',
      properties: {
        products: {
          type: 'array',
          items: { $ref: '#/models/Product' }
        },
        totalCount: { type: 'number' }
      },
      required: ['products']
    }
  }
}
```

**Plug implementation**:
```typescript
// REST example
plugs: {
  searchProducts: async (data, input) => {
    const response = await fetch(`/api/products?q=${input.query}`);
    return { products: await response.json() };
  }
}

// GraphQL example (same operation, different plug)
plugs: {
  searchProducts: async (data, input) => {
    const result = await graphqlClient.query({
      query: SEARCH_PRODUCTS_QUERY,
      variables: { query: input.query }
    });
    return { products: result.data.products };
  }
}
```

#### Type 2: `action` - State Mutations

**PURPOSE**: Update session state (the `data` layer). Synchronous, pure transformations.

**Signature**: `(data, event) => stateUpdates`

**Used in**: `entry`, `exit`, `transition.actions`

**Example**:
```typescript
operations: {
  storeSearchResults: {
    type: 'action',
    description: 'Store search results in session state',
    input: {
      type: 'object',
      properties: {
        event: { type: 'object' }  // Contains result from service
      }
    },
    output: {
      type: 'object',
      properties: {
        products: { type: 'array' },
        query: { type: 'string' }
      }
    }
  }
}
```

**Plug implementation**:
```typescript
plugs: {
  storeSearchResults: assign((data, event) => ({
    products: event.data.products,  // From service response
    query: event.data.query
  }))
}
```

#### Type 3: `guard` - Boolean Conditions

**PURPOSE**: Control transition flow with boolean logic.

**Signature**: `(data, event) => boolean`

**Used in**: `transition.cond`

**Example**:
```typescript
operations: {
  hasCartItems: {
    type: 'guard',
    description: 'Check if cart has items',
    input: {
      type: 'object',
      properties: {
        data: { type: 'object' }
      }
    },
    output: {
      type: 'boolean'
    }
  }
}
```

**Plug implementation**:
```typescript
plugs: {
  hasCartItems: (data, event) => data.cart && data.cart.length > 0
}
```

### Operation Metadata

**PURPOSE**: Link operations to external specifications and provide runtime hints.

```typescript
operations: {
  searchProducts: {
    type: 'service',
    input: {...},
    output: {...},
    metadata: {
      // External spec integration
      intent: 'product-search',                    // Semantic purpose
      service: 'ProductService',                   // Logical service name
      operation: 'search',                         // Logical method name
      specRef: 'specs/api.yaml#/paths/~1products/get',  // JSON Pointer to OpenAPI spec

      // Runtime hints
      timeout: 5000,                               // Milliseconds
      retries: 3,                                  // Auto-retry count
      cacheable: true,                             // Enable caching
      ttl: 60000                                   // Cache TTL (ms)
    }
  }
}
```

### Where Each Type Is Used

| Operation Type | Used In | Purpose |
|----------------|---------|---------|
| `service` | `invoke.src` | Async work on phase entry |
| `action` | `entry`, `exit`, `transition.actions` | State mutations |
| `guard` | `transition.cond`, `invoke.onDone[].cond` | Conditional logic |

---

## 6. State Machine (Phases)

**PURPOSE**: Define the workflow journey as a state machine. Each phase represents a state in the business process.

### Phase Structure

```typescript
interface Phase {
  // === TRANSITIONS ===
  on?: Record<string, Transition>;  // Event handlers

  // === ASYNC WORK ===
  invoke?: InvokeConfig;            // Async operation on entry

  // === LIFECYCLE ===
  entry?: string | string[];        // Action(s) on entry
  exit?: string | string[];         // Action(s) on exit

  // === METADATA ===
  tags?: string[];                  // For grouping/filtering
  type?: 'final';                   // Mark as terminal state
}
```

### Basic Phase Example

```typescript
phases: {
  browsing: {
    tags: ['interactive'],
    entry: 'trackPageView',        // Run action on entry
    on: {
      SEARCH: 'searching',         // Simple transition
      CHECKOUT: {                  // Guarded transition
        target: 'reviewingCart',
        cond: 'hasCartItems'
      }
    }
  }
}
```

### Transitions

**PURPOSE**: Define how events trigger phase changes.

#### Simple Transition

```typescript
on: {
  CANCEL: 'browsing'  // Event CANCEL → go to browsing
}
```

#### Guarded Transition

```typescript
on: {
  CHECKOUT: {
    target: 'payment',
    cond: 'hasCartItems',           // Guard operation
    actions: ['calculateTotal', 'applyTax']  // Run before transition
  }
}
```

#### Multiple Guards (First Match Wins)

```typescript
on: {
  SUBMIT: [
    { target: 'fastTrack', cond: 'isVIP' },
    { target: 'review', cond: 'isLarge' },
    { target: 'autoApprove' }  // Default if no guards match
  ]
}
```

### Invoke (Async Operations)

**PURPOSE**: Execute async operations on phase entry and handle success/error outcomes.

```typescript
interface InvokeConfig {
  src: string;                   // Service operation name
  input?: InputComputer;         // Compute input from (data, event)
  onDone?: Transition;           // Success transition
  onError?: Transition;          // Error transition
}

type InputComputer = (data: any, event: any) => any;
// In JSON: serialized as string "(data, event) => ({ ... })"
```

**Example**:

```typescript
phases: {
  searching: {
    tags: ['loading'],
    invoke: {
      src: 'searchProducts',                              // Service operation
      input: '(data, event) => ({ query: event.query })', // Compute input
      onDone: {
        target: 'searchResults',
        actions: 'storeSearchResults'  // Save results to state
      },
      onError: {
        target: 'searchError',
        actions: 'logError'
      }
    }
  }
}
```

**Flow**:
1. Phase entered → `invoke.src` operation called
2. Input computed via `invoke.input` function
3. Service executes (async)
4. On success → `onDone` actions run → transition to target
5. On error → `onError` actions run → transition to error target

### Lifecycle Hooks

**PURPOSE**: Execute actions when entering or leaving phases.

```typescript
phases: {
  checkout: {
    entry: ['calculateTotal', 'validateCart'],  // Run on entry
    exit: 'clearTemporaryData',                 // Run on exit
    on: {
      PAY: 'processing'
    }
  }
}
```

**Execution order**:
1. **Exit previous phase**: Run `exit` actions
2. **Transition**: Execute `transition.actions`
3. **Enter new phase**: Run `entry` actions
4. **Invoke** (if present): Start async operation

### Tags

**PURPOSE**: Group phases for querying and filtering (e.g., all loading states, all error states).

```typescript
phases: {
  searching: { tags: ['loading'] },
  addingToCart: { tags: ['loading'] },
  processingPayment: { tags: ['loading'] },
  searchError: { tags: ['error'] },
  paymentFailed: { tags: ['error'] }
}

// Runtime can query:
// session.hasTag('loading') → true/false
// introspect().phasesByTag('error') → ['searchError', 'paymentFailed']
```

### Final States

**PURPOSE**: Mark terminal states where the workflow ends.

```typescript
phases: {
  paymentCompleted: {
    type: 'final',
    entry: 'trackConversion'
    // No 'on' transitions allowed
  }
}
```

---

## 7. Type System

**PURPOSE**: Enable strong typing and validation across the entire program.

### DataSchema

**PURPOSE**: Define complex types (objects, arrays) with validation rules.

```typescript
interface DataSchema {
  type: 'object' | 'array' | 'string' | 'number' | 'boolean';

  // For objects
  properties?: Record<string, DataSchemaField>;
  required?: string[];  // Array of required property names

  // For arrays
  items?: DataSchemaField;

  // Validation constraints
  minLength?: number;  // For strings/arrays
  maxLength?: number;
  min?: number;        // For numbers
  max?: number;
  pattern?: string;    // Regex for strings
}
```

**Example**:

```typescript
models: {
  Product: {
    type: 'object',
    properties: {
      id: { type: 'string' },
      name: { type: 'string' },
      price: { type: 'number', min: 0 },
      tags: { type: 'array', items: { type: 'string' } }
    },
    required: ['id', 'name', 'price']
  }
}
```

### DataSchemaField

**PURPOSE**: Define individual fields with defaults and validation.

```typescript
interface DataSchemaField {
  type: 'string' | 'number' | 'boolean' | 'array' | 'object';

  // Reference
  $ref?: string;  // e.g., "#/models/Product"

  // Default
  default?: any;

  // Validation
  required?: boolean;
  minLength?: number;
  maxLength?: number;
  min?: number;
  max?: number;
  pattern?: string;  // Regex

  // For arrays
  items?: DataSchemaField;

  // For objects
  properties?: Record<string, DataSchemaField>;
}
```

**Example**:

```typescript
data: {
  query: {
    type: 'string',
    default: '',
    maxLength: 100
  },
  products: {
    type: 'array',
    items: { $ref: '#/models/Product' },
    default: []
  },
  priceRange: {
    type: 'object',
    properties: {
      min: { type: 'number', default: 0 },
      max: { type: 'number', default: 1000 }
    }
  }
}
```

### $ref Resolution

**PURPOSE**: Reference model definitions from anywhere in the program for reusability.

#### Syntax

```typescript
{ "$ref": "#/models/ModelName" }
```

#### Where $ref Can Be Used

- ✅ `data` field schemas
- ✅ `operations.input` schemas
- ✅ `operations.output` schemas
- ✅ `events.params` schemas
- ✅ Nested in `items` (array elements)
- ✅ Nested in `properties` (object fields)

#### Resolution Rules

1. `#/models/Product` → looks up `models.Product`
2. Deep resolution (follows nested $refs)
3. Circular refs → validation error
4. Missing ref → validation error

#### Example

```typescript
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
    items: { $ref: '#/models/Product' }
  }
}

// Reference in operations
operations: {
  searchProducts: {
    type: 'service',
    output: {
      type: 'object',
      properties: {
        products: {
          type: 'array',
          items: { $ref: '#/models/Product' }  // Same model
        }
      }
    }
  }
}

// Reference in events
events: {
  VIEW_PRODUCT: {
    label: 'View product',
    params: {
      product: { $ref: '#/models/Product' }
    }
  }
}
```

---

## 8. Models

**PURPOSE**: Define reusable domain types that represent business entities. Models are static - they never change during workflow execution.

### When to Use Models

Use models for:
- ✅ Domain entities (Product, User, Order, Address)
- ✅ Types shared across multiple operations
- ✅ Complex nested structures
- ✅ Types that need to match external API schemas

Don't use models for:
- ❌ One-off inline types
- ❌ Session-specific state (use `data` instead)
- ❌ Temporary computed values

### Structure

```typescript
models: Record<string, DataSchema>
```

### Examples

#### Simple Domain Entity

```typescript
models: {
  User: {
    type: 'object',
    properties: {
      id: { type: 'string' },
      email: { type: 'string', pattern: '^[^@]+@[^@]+\\.[^@]+$' },
      name: { type: 'string' },
      verified: { type: 'boolean' }
    },
    required: ['id', 'email']
  }
}
```

#### Nested Models

```typescript
models: {
  Address: {
    type: 'object',
    properties: {
      street: { type: 'string' },
      city: { type: 'string' },
      zipCode: { type: 'string' },
      country: { type: 'string' }
    },
    required: ['street', 'city', 'zipCode']
  },

  User: {
    type: 'object',
    properties: {
      id: { type: 'string' },
      name: { type: 'string' },
      shippingAddress: { $ref: '#/models/Address' },  // Reference
      billingAddress: { $ref: '#/models/Address' }
    }
  }
}
```

#### Collection Types

```typescript
models: {
  CartItem: {
    type: 'object',
    properties: {
      productId: { type: 'string' },
      quantity: { type: 'number', min: 1 },
      addedAt: { type: 'string' }
    }
  }
}

// Used in data
data: {
  cart: {
    type: 'array',
    items: { $ref: '#/models/CartItem' },
    default: []
  }
}
```

---

## 9. Data Schema

**PURPOSE**: Define the structure of session state - the living memory that evolves as the workflow progresses.

### When to Use Data Schema

Define `data` schema for:
- ✅ Values that persist across phases
- ✅ Accumulated state (cart, search results)
- ✅ User selections and preferences
- ✅ Computed values (totals, counts)
- ✅ UI state (flags, current selections)

### Structure

```typescript
data: Record<string, DataSchemaField>
```

### Examples

#### Domain State

```typescript
data: {
  // Collections
  products: {
    type: 'array',
    items: { $ref: '#/models/Product' },
    default: []
  },

  cart: {
    type: 'array',
    items: { $ref: '#/models/CartItem' },
    default: []
  },

  // Single entities
  selectedProduct: {
    $ref: '#/models/Product',
    required: false  // May not be set yet
  },

  user: {
    $ref: '#/models/User',
    required: false
  }
}
```

#### Computed State

```typescript
data: {
  total: {
    type: 'number',
    default: 0,
    min: 0
  },

  itemCount: {
    type: 'number',
    default: 0,
    min: 0
  },

  discount: {
    type: 'number',
    default: 0,
    min: 0,
    max: 100
  }
}
```

#### UI State

```typescript
data: {
  query: {
    type: 'string',
    default: '',
    maxLength: 100
  },

  filters: {
    type: 'object',
    properties: {
      category: { type: 'string' },
      minPrice: { type: 'number', min: 0 },
      maxPrice: { type: 'number', min: 0 },
      inStockOnly: { type: 'boolean', default: true }
    },
    default: {}
  },

  showPromo: {
    type: 'boolean',
    default: false
  },

  theme: {
    type: 'string',
    default: 'light',
    pattern: '^(light|dark)$'
  }
}
```

#### Counters & Flags

```typescript
data: {
  retryCount: {
    type: 'number',
    default: 0,
    min: 0
  },

  step: {
    type: 'number',
    default: 1,
    min: 1,
    max: 5
  }
}
```

### Default Values

**PURPOSE**: Initialize session state when workflow starts.

```typescript
data: {
  cart: {
    type: 'array',
    default: []  // Starts empty
  },

  theme: {
    type: 'string',
    default: 'light'  // Starts in light mode
  }
}
```

### Validation Constraints

```typescript
data: {
  quantity: {
    type: 'number',
    default: 1,
    min: 1,      // Cannot be less than 1
    max: 99      // Cannot exceed 99
  },

  email: {
    type: 'string',
    pattern: '^[^@]+@[^@]+\\.[^@]+$'  // Must be valid email
  },

  couponCode: {
    type: 'string',
    minLength: 6,
    maxLength: 10,
    pattern: '^[A-Z0-9]+$'  // Uppercase alphanumeric only
  }
}
```

---

## 10. Validation Rules

**PURPOSE**: Ensure program correctness and catch errors early.

### Program-Level Validation

1. ✅ `id` must be non-empty string
2. ✅ `version` must match semver pattern `^\d+\.\d+\.\d+$`
3. ✅ `initial` (if present) must reference existing phase
4. ✅ `phases` must have at least one phase
5. ✅ `operations` must be present and non-empty

### Phase-Level Validation

1. ✅ `on` event names should match `events` keys (warning if not)
2. ✅ `on` targets must reference existing phases
3. ✅ `invoke.src` must reference existing operation
4. ✅ `invoke` operation must be type `service`
5. ✅ `invoke.onDone` can have inline `cond` guards that are valid functions
6. ✅ `entry`/`exit` must reference existing operations
7. ✅ `entry`/`exit` operations should be type `action` (warning if `service`)
8. ✅ `cond` must reference existing operation of type `guard`
9. ✅ `transition.actions` must reference existing operations of type `action`
10. ✅ Final phases (`type: 'final'`) cannot have `on` transitions

### Operation-Level Validation

1. ✅ `type` must be one of: `service`, `action`, `guard`
2. ✅ `input` and `output` are required
3. ✅ `output` for guards must be `{ type: 'boolean' }`
4. ✅ `metadata.specRef` must be valid JSON Pointer format (if present)
5. ✅ `metadata.timeout` must be positive number (if present)
6. ✅ `metadata.retries` must be non-negative integer (if present)

### Event-Level Validation

1. ✅ `label` is required for each event
2. ✅ `params` schemas can use `$ref`
3. ✅ `params` fields with `$ref` must resolve to valid models
4. ✅ Event names used in `phases[].on` should exist in `events` (warning if not)

### Data-Level Validation

1. ✅ `$ref` must start with `#/models/`
2. ✅ Referenced model must exist in `models`
3. ✅ No circular references in `$ref` chains
4. ✅ `default` value must match field `type`
5. ✅ `min` <= `max` (if both present)
6. ✅ `minLength` <= `maxLength` (if both present)
7. ✅ `pattern` must be valid regex (if present)
8. ✅ Array items must have `items` schema defined
9. ✅ Object must have `properties` defined

### Model-Level Validation

1. ✅ Model names must be unique
2. ✅ Model `type` must be valid
3. ✅ Object models must have `properties`
4. ✅ Array models must have `items`
5. ✅ No circular `$ref` chains

---

## 11. Complete Example

A comprehensive example demonstrating **every feature** of the protocol is available in a separate file for easier maintenance and updates:

**→ [examples/shopping-checkout.program.json](examples/shopping-checkout.program.json)**

This shopping checkout workflow demonstrates:
- **4 Models**: Product, CartItem, Address, PaymentMethod
- **9 Data fields**: Session state management
- **9 Events**: User-triggerable actions with parameter validation
- **14 Operations**: Service calls, actions, and guards
- **13 Phases**: Complete state machine with error handling and retries

The example is kept synchronized with protocol changes and serves as a reference implementation.

---

## 12. JSON Schema

The formal JSON Schema definition for Blackbox Protocol v2.0:

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "$id": "https://blackbox.dev/schemas/program-v2.json",
  "title": "Blackbox Program",
  "type": "object",
  "required": ["id", "version", "operations", "phases"],
  "properties": {
    "id": {
      "type": "string",
      "description": "Unique workflow identifier",
      "minLength": 1
    },
    "version": {
      "type": "string",
      "description": "Semantic version",
      "pattern": "^\\d+\\.\\d+\\.\\d+$"
    },
    "initial": {
      "type": "string",
      "description": "Starting phase name"
    },
    "models": {
      "type": "object",
      "description": "Domain type definitions",
      "additionalProperties": {
        "$ref": "#/definitions/DataSchema"
      }
    },
    "data": {
      "type": "object",
      "description": "Session state schema",
      "additionalProperties": {
        "$ref": "#/definitions/DataSchemaField"
      }
    },
    "events": {
      "type": "object",
      "description": "User-triggerable events",
      "additionalProperties": {
        "$ref": "#/definitions/EventDefinition"
      }
    },
    "operations": {
      "type": "object",
      "description": "Operation contracts",
      "minProperties": 1,
      "additionalProperties": {
        "$ref": "#/definitions/OperationContract"
      }
    },
    "phases": {
      "type": "object",
      "description": "State machine phases",
      "minProperties": 1,
      "additionalProperties": {
        "$ref": "#/definitions/Phase"
      }
    }
  },
  "definitions": {
    "DataSchema": {
      "type": "object",
      "required": ["type"],
      "properties": {
        "type": {
          "type": "string",
          "enum": ["object", "array", "string", "number", "boolean"]
        },
        "properties": {
          "type": "object",
          "additionalProperties": {
            "$ref": "#/definitions/DataSchemaField"
          }
        },
        "required": {
          "type": "array",
          "items": { "type": "string" }
        },
        "items": {
          "$ref": "#/definitions/DataSchemaField"
        },
        "minLength": { "type": "number" },
        "maxLength": { "type": "number" },
        "min": { "type": "number" },
        "max": { "type": "number" },
        "pattern": { "type": "string" }
      }
    },
    "DataSchemaField": {
      "type": "object",
      "properties": {
        "type": {
          "type": "string",
          "enum": ["string", "number", "boolean", "array", "object"]
        },
        "$ref": {
          "type": "string",
          "pattern": "^#/models/"
        },
        "default": {},
        "required": { "type": "boolean" },
        "minLength": { "type": "number" },
        "maxLength": { "type": "number" },
        "min": { "type": "number" },
        "max": { "type": "number" },
        "pattern": { "type": "string" },
        "items": {
          "$ref": "#/definitions/DataSchemaField"
        },
        "properties": {
          "type": "object",
          "additionalProperties": {
            "$ref": "#/definitions/DataSchemaField"
          }
        }
      }
    },
    "EventDefinition": {
      "type": "object",
      "required": ["label"],
      "properties": {
        "label": { "type": "string" },
        "description": { "type": "string" },
        "params": {
          "type": "object",
          "additionalProperties": {
            "$ref": "#/definitions/DataSchemaField"
          }
        }
      }
    },
    "OperationContract": {
      "type": "object",
      "required": ["type", "input", "output"],
      "properties": {
        "type": {
          "type": "string",
          "enum": ["service", "action", "guard"]
        },
        "description": { "type": "string" },
        "input": {
          "$ref": "#/definitions/DataSchema"
        },
        "output": {
          "$ref": "#/definitions/DataSchema"
        },
        "metadata": {
          "type": "object",
          "properties": {
            "intent": { "type": "string" },
            "service": { "type": "string" },
            "operation": { "type": "string" },
            "specRef": { "type": "string" },
            "timeout": { "type": "number" },
            "retries": { "type": "number" },
            "cacheable": { "type": "boolean" },
            "ttl": { "type": "number" }
          }
        }
      }
    },
    "Phase": {
      "type": "object",
      "properties": {
        "on": {
          "type": "object",
          "additionalProperties": {
            "oneOf": [
              { "type": "string" },
              { "$ref": "#/definitions/Transition" },
              {
                "type": "array",
                "items": { "$ref": "#/definitions/Transition" }
              }
            ]
          }
        },
        "invoke": {
          "$ref": "#/definitions/InvokeConfig"
        },
        "entry": {
          "oneOf": [
            { "type": "string" },
            { "type": "array", "items": { "type": "string" } }
          ]
        },
        "exit": {
          "oneOf": [
            { "type": "string" },
            { "type": "array", "items": { "type": "string" } }
          ]
        },
        "tags": {
          "type": "array",
          "items": { "type": "string" }
        },
        "type": {
          "type": "string",
          "enum": ["final"]
        }
      }
    },
    "Transition": {
      "type": "object",
      "required": ["target"],
      "properties": {
        "target": { "type": "string" },
        "cond": { "type": "string" },
        "actions": {
          "oneOf": [
            { "type": "string" },
            { "type": "array", "items": { "type": "string" } }
          ]
        }
      }
    },
    "InvokeConfig": {
      "type": "object",
      "required": ["src"],
      "properties": {
        "src": { "type": "string" },
        "input": { "type": "string" },
        "onDone": {
          "oneOf": [
            { "type": "string" },
            { "$ref": "#/definitions/Transition" }
          ]
        },
        "onError": {
          "oneOf": [
            { "type": "string" },
            { "$ref": "#/definitions/Transition" }
          ]
        }
      }
    }
  }
}
```

---

## Appendix A: TypeScript Definitions

For TypeScript programs, use these type definitions:

```typescript
// Available as npm package: @blackbox/types

export interface BlackboxProgram {
  id: string;
  version: string;
  initial?: string;
  models?: Record<string, DataSchema>;
  data?: Record<string, DataSchemaField>;
  events?: Record<string, EventDefinition>;
  operations: Record<string, OperationContract>;
  phases: Record<string, Phase>;
}

export interface DataSchema {
  type: 'object' | 'array' | 'string' | 'number' | 'boolean';
  properties?: Record<string, DataSchemaField>;
  required?: string[];
  items?: DataSchemaField;
  minLength?: number;
  maxLength?: number;
  min?: number;
  max?: number;
  pattern?: string;
}

export interface DataSchemaField {
  type?: 'string' | 'number' | 'boolean' | 'array' | 'object';
  $ref?: string;
  default?: any;
  required?: boolean;
  minLength?: number;
  maxLength?: number;
  min?: number;
  max?: number;
  pattern?: string;
  items?: DataSchemaField;
  properties?: Record<string, DataSchemaField>;
}

export interface EventDefinition {
  label: string;
  description?: string;
  params?: Record<string, DataSchemaField>;
}

export interface OperationContract {
  type: 'service' | 'action' | 'guard';
  description?: string;
  input: DataSchema;
  output: DataSchema;
  metadata?: OperationMetadata;
}

export interface OperationMetadata {
  intent?: string;
  service?: string;
  operation?: string;
  specRef?: string;
  timeout?: number;
  retries?: number;
  cacheable?: boolean;
  ttl?: number;
}

export interface Phase {
  on?: Record<string, Transition | string | Array<Transition>>;
  invoke?: InvokeConfig;
  entry?: string | string[];
  exit?: string | string[];
  tags?: string[];
  type?: 'final';
}

export type Transition =
  | string
  | {
      target: string;
      cond?: string;
      actions?: string | string[];
    };

export interface InvokeConfig {
  src: string;
  input?: InputComputer;
  onDone?: Transition | string;
  onError?: Transition | string;
}

export type InputComputer = (data: any, event: any) => any;
```

---

## Appendix B: Migration from v1.3

### Breaking Changes

1. **Renamed**: `actions` → `events`
   - Update all references in your programs
   - Metadata structure remains the same

### Migration Steps

1. **Find and replace** in all `.program.json` and `.program.ts` files:
   - `"actions":` → `"events":`
   - `actions:` → `events:` (TypeScript)

2. **Verify** no conflicts with operation `type: 'action'` (these remain unchanged)

3. **Update** runtime usage:
   ```typescript
   // Old
   program.actions.SEARCH

   // New
   program.events.SEARCH
   ```

4. **Test** that event discovery still works

---

## Appendix C: Design Principles

### 1. Simplicity Over Completeness

We intentionally omitted features found in other state machine libraries:
- ❌ Hierarchical states (use flat phases + tags)
- ❌ Parallel states (compose multiple programs)
- ❌ History states (use snapshot/restore)
- ❌ Actors/spawning (use separate sessions)

**Why**: 80% of workflows need 20% of features. We built the essential 20%.

### 2. Discovery Over Documentation

Programs are self-documenting:
- Events are discoverable via `can()`
- Parameters have schemas for validation
- Metadata enables auto-generated UIs

**No separate API documentation needed.**

### 3. Protocol Over Implementation

Programs never specify:
- ❌ HTTP methods or URLs
- ❌ GraphQL queries
- ❌ Database queries
- ❌ File paths

**Only contracts.** Plugs provide implementation.

### 4. Evolution Over Breaking Changes

Programs support:
- ✅ Semantic versioning
- ✅ Guards protect against invalid transitions
- ✅ Optional fields enable gradual migration
- ✅ Metadata can reference external specs

**Workflows evolve gracefully.**

---

**End of Specification**

For runtime implementation guidance, see: `BLACKBOX_RUNTIME_API_V2.md` (to be written).

For quick reference, see: `BLACKBOX_QUICK_REFERENCE_V2.md` (to be updated).
