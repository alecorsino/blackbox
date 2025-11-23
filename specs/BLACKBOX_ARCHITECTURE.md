# Blackbox Architecture

**Version**: 2.0
**Date**: November 2025
**Status**: Foundational Document

---

## Table of Contents

1. [Introduction](#introduction)
2. [The Dual Nature of Blackbox](#the-dual-nature-of-blackbox)
3. [The Three-Layer Architecture](#the-three-layer-architecture)
4. [Core Architectural Principles](#core-architectural-principles)
5. [The Protocol: What & Why](#the-protocol-what--why)
6. [The Runtime: How & When](#the-runtime-how--when)
7. [Use Cases Enabled by This Architecture](#use-cases-enabled-by-this-architecture)
8. [Design Decision Framework](#design-decision-framework)
9. [Open Questions & Future Work](#open-questions--future-work)

---

## Introduction

### What is Blackbox?

Blackbox is **both** a protocol and a runtime:

- **The Protocol**: A declarative JSON specification for describing workflow orchestration
- **The Runtime**: An execution engine that interprets and runs protocol programs

This document establishes the architectural foundation that separates these concerns while enabling them to work together seamlessly.

### Why This Document Exists

During the design of Blackbox Protocol v2.0, we discovered a fundamental tension: some design decisions felt "stretched" because we were conflating protocol concerns with runtime concerns.

**Example**: "Should actions declare which data fields they modify?"

- **Protocol perspective**: Yes, for discoverability and visual tooling
- **Runtime perspective**: Maybe not needed if runtime can infer it
- **Result**: The decision felt arbitrary without architectural clarity

This document provides that clarity by:

1. Defining what belongs in the protocol vs the runtime
2. Establishing design principles for making architectural decisions
3. Documenting the vision for how Blackbox enables new patterns
4. Creating a foundation for the runtime specification

### How to Use This Document

**For protocol designers**: Use this to decide what features belong in the protocol specification.

**For runtime implementers**: Use this to understand what the runtime must provide and what it can optimize.

**For decision-makers**: Use the Design Decision Framework (Section 8) to resolve architectural questions.

---

## The Dual Nature of Blackbox

### Two Faces, One System

```
┌─────────────────────────────────────────────────────────┐
│                  BLACKBOX PROTOCOL                       │
│              (Declarative Specification)                 │
│                                                          │
│  • JSON/TypeScript format                               │
│  • Describes behavior, not implementation               │
│  • Platform-agnostic, transport-agnostic                │
│  • Can be validated, visualized, analyzed               │
│  • "The sheet music"                                    │
└─────────────────────────────────────────────────────────┘
                           ▼
┌─────────────────────────────────────────────────────────┐
│                   BLACKBOX RUNTIME                       │
│                 (Execution Engine)                       │
│                                                          │
│  • State machine interpreter                            │
│  • Session and state management                         │
│  • Plug orchestration and validation                    │
│  • Platform-specific (JS/TS, but could be Python, Rust) │
│  • "The orchestra playing the music"                    │
└─────────────────────────────────────────────────────────┘
                           ▼
┌─────────────────────────────────────────────────────────┐
│                  PLUGS (Implementation)                  │
│                                                          │
│  • REST, GraphQL, gRPC, mock services                   │
│  • Database queries, file I/O, external APIs            │
│  • Pure implementation, swappable at runtime            │
│  • "The instruments in the orchestra"                   │
└─────────────────────────────────────────────────────────┘
```

### The Key Insight

**The protocol is the source of truth. The runtime interprets it. Plugs implement it.**

This separation enables:

- **Portability**: Same program, different runtimes (web, mobile, server, CLI)
- **Flexibility**: Same program, different backends (REST, GraphQL, mocks)
- **Tooling**: Visual editors, validators, analyzers work on pure protocol
- **Reusability**: Business logic lives in protocol, UI is just a thin rendering layer

---

## The Three-Layer Architecture

### Layer 1: Protocol (Specification)

**Responsibility**: Define the structure, contracts, and rules

**Contents**:

- Program structure (phases, events, operations, models, data, metadata)
- Data schemas (models, data fields, event input, operation input/output)
- State machine definition (phases, transitions, guards, actions, invocations)
- Validation rules (what makes a program valid)
- Type system ($ref resolution, schema inheritance)

**Format**: JSON or TypeScript (for type hints), but must be serializable

**Key characteristic**: 100% declarative, no implementation details

**Analogy**: The protocol is like a REST API specification (OpenAPI/Swagger) - it describes what's possible, not how it works.

### Layer 2: Runtime (Execution)

**Responsibility**: Execute programs and manage sessions

**Contents**:

- Session management (create, destroy, pause, resume)
- State management (current phase, data layer, history)
- Event dispatch and validation
- Transition evaluation (guards, actions)
- Async operation orchestration (invoke, onDone, onError)
- Plug loading and contract enforcement
- Discovery API (`can()`, `do()`, `where()`)

**Format**: JavaScript/TypeScript library (currently), but could be implemented in any language

**Key characteristic**: Interprets protocol, enforces contracts, manages state

**Analogy**: The runtime is like an Express server or GraphQL engine - it executes the specification.

### Layer 3: Implementation (Plugs)

**Responsibility**: Provide concrete implementations of operations

**Contents**:

- Service plugs: REST clients, GraphQL clients, database adapters, file I/O
- Action plugs: State transformation functions (assign, merge, delete)
- Guard plugs: Boolean predicates (validation, authorization, business rules)

**Format**: JavaScript functions that match operation contracts

**Key characteristic**: Pure implementation, swappable without changing protocol

**Analogy**: Plugs are like route handlers in Express or resolvers in GraphQL - they do the actual work.

---

## Core Architectural Principles

These principles (from [BLACKBOX_VISION_V2.md](BLACKBOX_VISION_V2.md)) guide all design decisions:

### 1. Discovery Over Documentation

**What it means**: Programs should be self-describing. UIs and tools should introspect the program to discover capabilities, not rely on external documentation.

**Protocol implication**: Every aspect of the protocol should be queryable:

- `can('CHECKOUT')` - can this event be dispatched now?
- `where().data.cart` - what's the current cart state?
- `where().phase` - what phase are we in?

**Design impact**: The protocol must be complete enough to answer these questions without external context.

### 2. Protocol Over Implementation

**What it means**: The "what" lives in the protocol. The "how" lives in plugs.

**Protocol implication**: Programs declare:

- "I need a searchProducts operation that takes { query: string } and returns Product[]"
- They do NOT declare: "Call GET /api/products?q={query}"

**Design impact**: The protocol must be expressive enough to describe contracts without prescribing implementation.

### 3. Orchestration Over Endpoints

**What it means**: Ship one workflow (program), not 50 REST endpoints.

**Protocol implication**: Programs describe entire business processes as state machines, not individual API calls.

**Design impact**: The protocol must support complex orchestration: sequential operations, conditional logic, error handling, state management.

### 4. Evolution Over Breaking Changes

**What it means**: Programs should evolve gracefully. Guards protect invalid transitions. New phases can be added without breaking old clients.

**Protocol implication**: Programs have built-in versioning and migration paths.

**Design impact**: The protocol must support guards, conditional transitions, and gradual feature rollout.

### 5. Simplicity Over Power

**What it means**: Build 20% of features for 80% of use cases.

**Protocol implication**: The protocol should be learnable in an afternoon.

**Design impact**: Resist feature creep. Prefer composition over built-in complexity.

---

## The Protocol: What & Why

### What the Protocol IS

The Blackbox Protocol is a **declarative specification** for workflow orchestration. It's a JSON/TypeScript file that describes:

1. **What the workflow needs** (operations with contracts)
2. **When things happen** (state machine with phases and events)
3. **What's possible at each step** (guards and conditional transitions)
4. **What data flows through** (models, session data, event input)

### What the Protocol IS NOT

The protocol is **not**:

- ❌ URLs, HTTP methods, GraphQL queries, database queries
- ❌ Environment-specific configuration (production vs staging)
- ❌ Implementation code (how to fetch data, how to transform state)
- ❌ UI components or rendering logic

### The Three-Layer Data Model

A critical architectural pattern in Blackbox is the separation of data into three layers:

#### Layer 1: Models (Static)

**Purpose**: Domain types that don't change during execution

**Example**:

```typescript
models: {
  Product: {
    type: 'object',
    properties: {
      id: { type: 'string', required: true },
      name: { type: 'string', required: true },
      price: { type: 'number', required: true }
    }
  }
}
```

**Lifecycle**: Defined at program creation, immutable during execution

**Mutated by**: Never (referenced via `$ref`)

#### Layer 2: Data (Dynamic)

**Purpose**: Session state - the living memory of the workflow

**Example**:

```typescript
data: {
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
  total: {
    type: 'number',
    default: 0,
    min: 0
  }
}
```

**Lifecycle**: Initialized at session start, persists across phases, can be saved/restored

**Mutated by**: Operations with `type: 'action'` via the assign pattern

#### Layer 3: Event Input (Transient)

**Purpose**: One-time stimuli from the user

**Example**:

```typescript
events: {
  SEARCH: {
    input: {
      query: { type: 'string', required: true, maxLength: 100 }
    }
  }
}
```

**Lifecycle**: Validated when event is dispatched, available during transition, discarded after

**Mutated by**: Never (read-only during transition evaluation)

### Operations as Contracts

Operations are the bridge between protocol and implementation:

```typescript
operations: {
  searchProducts: {
    type: 'service',      // Contract: this is async
    input: {              // Contract: what the plug receives
      query: { type: 'string', required: true }
    },
    output: {             // Contract: what the plug returns
      type: 'array',
      items: { $ref: '#/models/Product' }
    }
  }
}
```

**Protocol declares**: "I need an operation with this signature"

**Runtime enforces**: Input/output validation, type checking

**Plug provides**: The actual implementation (REST call, GraphQL query, mock data)

### Why This Matters

This architecture enables:

1. **Visual Programming**: Tools like React Flow can render programs as graphs
2. **Static Analysis**: Validators can check programs without running them
3. **Cross-Platform**: Same program runs on web, mobile, server, CLI
4. **Testability**: Mock plugs for testing, real plugs for production
5. **Evolution**: Change implementation (REST → GraphQL) without changing program

---

## The Runtime: How & When

### What the Runtime Provides

The runtime is the execution engine that brings protocol programs to life:

#### 1. Discovery API

The runtime exposes three primitives for introspecting the current state:

```typescript
// Can I dispatch this event right now?
session.can('CHECKOUT'); // → boolean

// Dispatch an event and transition
session.do('ADD_TO_CART', { productId: '123', quantity: 2 });

// Where am I in the workflow?
session.where(); // → { phase: 'cart', data: { ... }, events: ['CHECKOUT', 'CONTINUE_SHOPPING'] }
```

These primitives enable **discovery-driven UIs** that don't need to know the workflow structure in advance.

#### 2. Session Management

The runtime manages session lifecycle:

- **Create**: Initialize from program + plugs
- **Execute**: Run state machine, handle transitions
- **Persist**: Save/restore session state
- **Destroy**: Clean up resources

#### 3. State Management

The runtime maintains:

- **Current phase**: Where we are in the state machine
- **Data layer**: Current session state (the dynamic data)
- **Event queue**: Pending events (if async)
- **History**: Past phases and transitions (for debugging/undo)

#### 4. Contract Enforcement

The runtime validates:

- **Event input**: Does the data match the event's input schema?
- **Operation input**: Does the invocation match the operation's input contract?
- **Operation output**: Does the result match the operation's output contract?
- **State mutations**: Do actions return valid partial updates to data?

#### 5. Plug Orchestration

The runtime:

- Loads plugs and maps them to operations
- Validates plug signatures match operation contracts
- Invokes plugs with validated input
- Handles async operations (invoke, onDone, onError)
- Manages plug lifecycle (setup, teardown)

### What the Runtime Does NOT Specify

The protocol intentionally does not specify:

- How sessions are persisted (localStorage, database, memory)
- How plugs are loaded (import, require, dependency injection)
- How state updates are propagated (observers, subscriptions, polling)
- How errors are logged or reported

These are **implementation details** left to specific runtime implementations.

### Runtime Specification (To Be Written)

The full runtime specification will be documented in:

- **BLACKBOX_RUNTIME_API_V2.md** (in progress)

This will define:

- TypeScript interfaces for Session, SessionConfig, SessionState
- Plug interface and registration
- Event dispatch and transition evaluation algorithms
- State mutation and validation rules
- Error handling and recovery

---

## Use Cases Enabled by This Architecture

The separation of protocol, runtime, and implementation enables several powerful patterns:

### Use Case 1: API Orchestration Tool

**Scenario**: Coordinate multiple backend services in a complex workflow

```typescript
// Protocol describes the orchestration
program: {
  operations: {
    searchProducts: { type: 'service', ... },      // Service A
    getUserPreferences: { type: 'service', ... },  // Service B
    logEvent: { type: 'service', ... }             // Service C
  },
  phases: {
    idle: {
      on: {
        SEARCH: {
          target: 'searching',
          invoke: {
            src: 'searchProducts',
            onDone: { target: 'results', actions: ['storeResults', 'logEvent'] }
          }
        }
      }
    }
  }
}

// Plugs provide the actual API calls
plugs: {
  searchProducts: async (input) => fetch('/api/products', { ... }),
  getUserPreferences: async (input) => fetch('/api/users/me/preferences', { ... }),
  logEvent: async (input) => analytics.track(...)
}
```

**Benefits**:

- One program orchestrates multiple services
- Swap implementations (REST → GraphQL) without changing program
- Visual tools can diagram the service dependencies
- Testing uses mock plugs instead of real APIs

### Use Case 2: State Management Library

**Scenario**: Use Blackbox as a Redux/Zustand alternative with built-in orchestration

```typescript
// Protocol defines state shape and mutations
program: {
  data: {
    cart: { type: 'array', default: [] },
    total: { type: 'number', default: 0 }
  },
  operations: {
    addItem: { type: 'action', ... },
    calculateTotal: { type: 'action', ... }
  }
}

// React component subscribes to state
function CartComponent() {
  const session = useBlackbox(program, plugs);
  const { cart, total } = session.where().data;

  return (
    <div>
      {cart.map(item => <CartItem {...item} />)}
      <button onClick={() => session.do('CHECKOUT')}>
        Checkout - ${total}
      </button>
    </div>
  );
}
```

**Benefits**:

- Type-safe state management
- Built-in orchestration (no separate saga/thunk library)
- State machine prevents invalid states (can't checkout with empty cart)
- Same business logic works in React, Vue, Svelte, terminal UI

### Use Case 3: Visual Programming Platform

**Scenario**: Use React Flow to design workflows visually, export to Blackbox programs

```
┌─────────────────────────────────────────┐
│      React Flow Editor (Browser)        │
│                                         │
│  ┌─────┐       ┌─────┐      ┌─────┐   │
│  │Idle │──────>│Search│─────>│Results│  │
│  └─────┘       └─────┘      └─────┘   │
│     │              │                    │
│     └──────────────┘                    │
│                                         │
│  [Export to JSON] [Import from JSON]   │
└─────────────────────────────────────────┘
                  │
                  ▼
        shopping-checkout.program.json
```

**Benefits**:

- Non-developers can design workflows
- Visual representation makes complex logic understandable
- Export to pure protocol (JSON) for version control
- Import back to visual editor for modifications
- What you see is what you get - no code generation

### Use Case 4: Universal Business Logic

**Scenario**: Write business logic once, run it anywhere

```
┌──────────────────────────────────────────┐
│  checkout.program.json (Business Logic)  │
│  • State machine (phases, events)        │
│  • Data schema (cart, total, address)    │
│  • Operations (payment, shipping)        │
└──────────────────────────────────────────┘
                  │
       ┌──────────┼──────────┬──────────┐
       ▼          ▼          ▼          ▼
   Web App   Mobile App   CLI Tool   AI Agent
   (React)    (React      (Node.js)  (LLM)
              Native)
       │          │          │          │
       ▼          ▼          ▼          ▼
   Thin UI    Thin UI    Thin UI    Natural
   (just      (just      (prompts)   Language
   render     render                 Interface
   state)     state)
```

**Benefits**:

- Business logic is 100% portable
- No duplication between platforms
- UI is just a thin rendering layer
- Each UI can optimize for its platform (touch, keyboard, voice)
- Testing the program tests ALL platforms

### Use Case 5: Thin UI Architecture

**Scenario**: Decouple business logic from presentation

**Traditional approach**:

```typescript
// Business logic mixed with React
function CheckoutComponent() {
  const [step, setStep] = useState('cart');
  const [cart, setCart] = useState([]);
  const [total, setTotal] = useState(0);

  // 200 lines of business logic here
  // Tightly coupled to React
}
```

**Blackbox approach**:

```typescript
// Business logic in protocol
const program = {
  /* state machine, data, operations */
};

// React component is just a thin renderer
function CheckoutComponent() {
  const session = useBlackbox(program, plugs);
  const { phase, data } = session.where();

  // Just render based on state
  return <div>{renderPhase(phase, data)}</div>;
}
```

**Benefits**:

- Business logic can be tested without React
- Same logic works in Vue, Svelte, Angular, terminal UI
- UI framework migration is just swapping the renderer
- Non-developers can modify business logic (via visual tool)

---

## Design Decision Framework

When faced with a design decision, use this framework to determine if it's a protocol concern, runtime concern, or both.

### Decision Tree

```
┌─────────────────────────────────────────────────────────┐
│  Is this about the STRUCTURE of the workflow?           │
│  (what phases exist, what events trigger transitions)   │
└─────────────────────────────────────────────────────────┘
         │ YES                              │ NO
         ▼                                  ▼
    PROTOCOL CONCERN              ┌─────────────────────┐
                                  │ Is this about HOW   │
                                  │ the workflow runs?  │
                                  └─────────────────────┘
                                       │ YES      │ NO
                                       ▼          ▼
                                  RUNTIME      IMPLEMENTATION
                                  CONCERN      CONCERN (Plug)
```

### Examples from Change List

#### Example 1: Item #4 - Guard Naming

**Question**: Should we rename `cond` to `guard` in transitions?

**Analysis**:

- Is this about structure? YES - transitions reference guards
- Is this about discovery? YES - name should be self-documenting
- Is this about execution? NO - runtime doesn't care about the name

**Decision**: PROTOCOL CONCERN → Rename `cond` to `guard` for clarity

**Rationale**: The protocol should be self-documenting. Matching the property name (`guard`) to the operation type (`guard`) reduces cognitive load.

#### Example 2: Item #8 - Actions and Data Schema

**Question**: Should actions declare which data fields they modify?

**Analysis**:

- Is this about structure? MAYBE - actions are declared in protocol
- Is this about discovery? YES - visual tools need to know what changes
- Is this about execution? YES - runtime could validate state mutations
- Is this about safety? YES - prevent actions from modifying invalid fields

**Decision**: BOTH protocol and runtime concern

**Protocol side**: Actions should have explicit output schemas that reference data fields

**Runtime side**: Runtime should validate that action outputs match data schema

**Rationale**: The protocol needs explicitness for discoverability and tooling. The runtime needs it for validation and safety. This is a case where protocol and runtime concerns align.

#### Example 3: Item #5 - Program Composition

**Question**: Can programs invoke other programs? How?

**Analysis**:

- Is this about structure? YES - programs could reference other programs
- Is this about execution? YES - runtime must manage sub-sessions
- Is this about implementation? MAYBE - sub-programs might need different plugs

**Decision**: BOTH protocol and runtime concern (complex)

**Protocol side**:

- Programs can reference other programs (by ID or path)
- Reference is declarative: `invoke: { src: 'sub-program-id' }`

**Runtime side**:

- Runtime decides: new session or same session?
- Runtime manages: data flow, event bubbling, lifecycle
- Runtime provides: composition primitives

**Rationale**: The protocol defines the "what" (reference another program). The runtime defines the "how" (execute the sub-program). This is a clear separation that allows multiple runtime strategies.

### Guidelines

**Make it a PROTOCOL concern if**:

- ✅ It affects discoverability (`can()`, `do()`, `where()`)
- ✅ It affects visual representation (React Flow, diagrams)
- ✅ It affects static analysis (validators, linters)
- ✅ It affects portability (cross-platform, cross-runtime)
- ✅ It affects self-documentation

**Make it a RUNTIME concern if**:

- ✅ It affects execution strategy (parallelism, caching)
- ✅ It affects optimization (performance, memory)
- ✅ It affects session management (persistence, recovery)
- ✅ It's platform-specific (browser vs Node.js)

**Make it an IMPLEMENTATION concern (Plug) if**:

- ✅ It's about transport (REST, GraphQL, gRPC)
- ✅ It's about external systems (databases, APIs, file systems)
- ✅ It's environment-specific (dev vs prod URLs)
- ✅ It's swappable without changing the program

**Make it BOTH if**:

- ✅ The protocol needs to declare it for discoverability
- ✅ The runtime needs to enforce it for correctness
- ✅ They work together: protocol declares, runtime validates

---

## Open Questions & Future Work

### 1. Runtime API Specification

**Status**: In progress

**What's needed**:

- Formal specification of runtime interfaces (Session, SessionConfig, SessionState)
- Plug interface and registration API
- Event dispatch and transition evaluation algorithms
- State mutation and validation rules
- Error handling and recovery patterns

**Document**: `BLACKBOX_RUNTIME_API_V2.md` (to be written)

### 2. Visual Tooling Integration

**Status**: Conceptual

**Questions**:

- How should visual tools (React Flow) map to protocol?
- What metadata helps visual representation?
- Can we define a "visual schema" extension?

**Example needs**:

- Node positions in visual editor
- UI hints (colors, icons, grouping)
- Annotations and comments

**Possible approach**: Use `metadata` field for tool-specific data

### 3. Program Composition Patterns

**Status**: Not started (Change List Item #5)

**Questions**:

- Should sub-programs run in the same session or separate sessions?
- How does data flow between parent and child?
- How do events bubble up/down?
- Can programs be composed in parallel?

**Architectural implications**:

- Protocol: How to reference other programs
- Runtime: How to execute and manage sub-sessions
- Implementation: How to load external programs

### 4. Multi-Runtime Ecosystem

**Status**: Vision

**Goal**: Multiple runtime implementations in different languages

**Possible runtimes**:

- **JavaScript/TypeScript**: Browser and Node.js (current focus)
- **Python**: Data science and ML workflows
- **Rust**: High-performance, embedded systems
- **Go**: Server-side, CLI tools

**Requirements**:

- All runtimes must implement the same protocol spec
- Programs should be 100% portable across runtimes
- Runtime-specific optimizations are allowed

**Benefit**: Write once (protocol), run anywhere (runtime)

### 5. Validation Boundaries

**Status**: Needs clarification

**Question**: What validation happens where?

**Current understanding**:

- **Static validation** (protocol): Program structure, schema validity, $ref resolution
- **Contract validation** (runtime): Operation input/output, event input
- **State validation** (runtime): Data mutations, guard evaluation

**Needs work**: Formal specification of validation rules at each layer

### 6. Execution Model Clarity

**Status**: Partially addressed in Change List Item #3

**Question**: When does each phase lifecycle hook run?

**Current state**: `on`, `invoke`, `entry`, `exit` - timing not always clear

**Needed**: Clear execution model documentation:

- What happens when entering a phase?
- What order do entry actions run?
- When does invoke trigger?
- What happens on transition?

---

## Appendix: Related Documents

### Core Specifications

- **[BLACKBOX_PROTOCOL_V2.md](BLACKBOX_PROTOCOL_V2.md)**: The main protocol specification
- **[BLACKBOX_VISION_V2.md](BLACKBOX_VISION_V2.md)**: Vision and philosophy
- **[PROTOCOL_V2_CHANGE_LIST.md](PROTOCOL_V2_CHANGE_LIST.md)**: Design decisions and changes

### Examples & References

- **[examples/shopping-checkout.program.json](examples/shopping-checkout.program.json)**: Complete working example
- **[BLACKBOX_QUICK_REFERENCE.md](BLACKBOX_QUICK_REFERENCE.md)**: Quick reference guide
- **[schema/blackbox-program-v2.schema.json](schema/blackbox-program-v2.schema.json)**: JSON Schema for validation

### Legacy

- **[legacy/BLACKBOX_PROGRAM_SPEC_v1_legacy.md](legacy/BLACKBOX_PROGRAM_SPEC_v1_legacy.md)**: v1.3 specification (reference only)

---

## Revision History

- **2025-11**: Initial version - establishes protocol/runtime separation and architectural vision
