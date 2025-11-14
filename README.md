# Blackbox Protocol - Vision & Philosophy V0.1

> **"Don't document your API. Delete it. Ship a blackbox."**

**Date**: November 6-7, 2025  
**Status**: The day APIs died

---

## 🎯 The Problem

### What We Saw

In IT systems, we have backends with APIs, but the **actual logic of workflows lives scattered** across the systems using those APIs—usually frontends. There's **no way to make sense** of what order to call things or what to call to accomplish something as a whole.

**Example**: A shopping site

- First retrieve products
- Add them to cart
- Submit order
- Process payment
- Get confirmation

This orchestration logic ends up:

- ❌ Duplicated across web, mobile, and other clients
- ❌ Hardcoded in UI components
- ❌ Undocumented (just "look at the API")
- ❌ Brittle when workflows change
- ❌ Impossible to reuse

### The Root Cause

**APIs don't tell you how to use them.** They're just endpoints. No one knows:

- What order to call them in
- What depends on what
- How to handle errors
- When human intervention is needed
- What the complete journey looks like

**Result**: Every team reinvents orchestration. Every app scatters business logic. Every workflow is a mystery.

---

## 💡 The Insight

What if workflows were **first-class citizens**?

What if instead of:

```
Backend: Here are 47 API endpoints
Frontend: Good luck figuring out how to use them
```

We had:

```
Backend: Here's a workflow file that orchestrates everything
Frontend: Just poke it and it tells you what's possible
```

The workflow IS the documentation.  
The workflow IS the orchestration.  
The workflow IS the API.

---

## 🚀 The Solution: Blackbox Protocol

A **protocol for API orchestration** where:

1. **Programs declare workflows** (the "what")

   - States/phases in the journey
   - Events that trigger transitions
   - Operations needed (search, pay, etc.)
   - Data that flows through

2. **Plugs implement backends** (the "how")

   - Swappable at runtime
   - REST, GraphQL, gRPC, mock—doesn't matter
   - No transport in the program

3. **UIs discover actions dynamically**
   - `blackbox.can()` → ["SEARCH", "ADD_TO_CART"]
   - Auto-generate buttons, forms, flows
   - No hardcoded navigation

### The 3 Primitives

```typescript
blackbox.can(); // What can I do right now?
blackbox.do(); // Do it
blackbox.where(); // Where am I?
```

**That's the entire API.**

---

## 🎸 Design Philosophy

### 1. Discovery Over Documentation

**Traditional**:

- Write API docs
- Hope developers read them
- Hope they implement correctly
- Hope they keep up with changes

**Blackbox**:

- Ship a `.program.json` file
- UIs query: "what can I do?"
- Actions appear automatically
- Changes propagate instantly

### 2. Protocol Over Implementation

**Traditional**: Mix "what" and "how"

```javascript
// API orchestration mixed with implementation
const products = await fetch('/api/products?q=' + query);
const cart = await fetch('/api/cart', { method: 'POST', ... });
```

**Blackbox**: Separate concerns

```typescript
// Program (pure protocol - what)
operations: {
  searchProducts: {
    input: { query: 'string' },
    output: { products: 'Product[]' }
  }
}

// Plug (pure implementation - how)
plugs: {
  searchProducts: async (data, input) => {
    return fetch('/api/products?q=' + input.query).then(r => r.json());
  }
}
```

### 3. Orchestration Over Endpoints

**Traditional**: Expose 50 endpoints, let clients figure it out

**Blackbox**: Ship one workflow that knows the journey

### 4. Evolution Over Breaking Changes

**Traditional**:

- Change API
- Update docs
- Notify clients
- Hope they update

**Blackbox**:

- Update workflow
- Clients auto-discover new actions
- Old clients still work (guards protect)
- Gradual migration built-in

### 5. Simplicity Over Power

We could have built all of XState's features.  
We didn't.

**What we kept**:

- ✅ Event-driven transitions
- ✅ Guards (conditions)
- ✅ Actions (side effects)
- ✅ Async services
- ✅ Entry/exit hooks

**What we left out**:

- ❌ Actors & spawning (use multiple blackboxes)
- ❌ Hierarchical states (use flat phases + tags)
- ❌ Parallel states (compose blackboxes)
- ❌ History states (use snapshot/restore)

**Why**: 80% of use cases need 20% of features. We built the 20%.
But they will come in the future when the library evolves more

---

## 🆚 Why Not Just Use State Machine?

We love State Machines. But it wasn't built for our use case.

| Aspect           | State Machine          | Blackbox                 |
| ---------------- | ---------------------- | ------------------------ |
| **Built For**    | UI state management    | API orchestration        |
| **Mental Model** | Generic state machines | Business journeys        |
| **Discovery**    | Read docs manually     | `can()` + introspection  |
| **Backend**      | Services in config     | Plugs at runtime         |
| **Transport**    | Coupled                | Completely agnostic      |
| **Focus**        | Correctness            | Simplicity + portability |

**Blackbox is a protocol.**

---

## 🎯 Design Goals

### 1. Zero Cognitive Load

A developer should be able to:

1. Open a `.program.json` file
2. Understand the entire workflow in 30 seconds
3. Start using it in 2 minutes

No manuals. No tutorials. Just read the program.

### 2. UI-Agnostic

The same workflow file should work:

- ✅ In a React app
- ✅ In a Vue app
- ✅ In a terminal (CLI)
- ✅ In a mobile app
- ✅ In an AI agent
- ✅ In a test suite

No framework lock-in. No platform assumptions.

### 3. Backend-Agnostic

The same workflow should run against:

- ✅ REST APIs
- ✅ GraphQL APIs
- ✅ gRPC services
- ✅ SOAP services (yes, really)
- ✅ Mocked data (for testing)
- ✅ Local storage (offline-first)
- ✅ AI models (prompt → response)

Swap plugs at runtime. Zero changes to the program.

### 4. Self-Documenting

The program **is** the documentation.

Want to know:

- What actions are available? → `introspect().allActions()`
- What paths are possible? → `introspect().allPaths()`
- What operations are needed? → `introspect().getAllOperations()`
- Can I reach checkout from here? → `introspect().canReach('browsing', 'checkout')`

No separate docs. The program answers everything.

### 5. Evolution-Friendly

Workflows change. Requirements change. APIs change.

**Built-in**:

- ✅ Semantic versioning
- ✅ Migration support
- ✅ Backward compatibility
- ✅ Gradual rollouts

Old clients work. New clients discover new features. No "big bang" deployments.

---

## 🌟 Unique Differentiators

### 1. The 3-Layer Data Model

Most state machines have one blob of "state" or "context".

We have three:

```
models  (static)   → Product, User, Order
  ↓
data    (dynamic)  → products[], cart[], showPromo
  ↓
event   (transient) → { query: "laptop" }
```

**Why**: Clear separation of concerns. Models are reusable. Data is mutable. Events are ephemeral.

### 2. Operations as Contracts

```typescript
operations: {
  searchProducts: {
    type: 'service',
    input: { query: { type: 'string' } },
    output: { products: { type: 'array' } },
    metadata: {
      specRef: 'specs/api.yaml#/paths/~1products/get'
    }
  }
}
```

**Why**: Programs declare **what** they need. Runtime validates. External specs remain source of truth.

### 3. Built-in Introspection

```typescript
blackbox.introspect().allPaths();
// → [['browsing', 'searching', 'results', 'cart', 'payment', 'done']]
```

**Use cases**:

- Auto-generate sitemaps
- Build visual editors
- Generate test cases
- Create documentation

All from the program. No manual work.

### 4. Discoverable Actions

```typescript
session.can();
// → ['SEARCH', 'ADD_TO_CART', 'CHECKOUT']
```

**Result**: UIs auto-generate.

```jsx
{
  actions.map((action) => <button onClick={() => session.do(action)}>{action.label}</button>);
}
```

No hardcoded navigation. No magic strings. Just discovery.

### 5. Protocol-First

**Programs never contain**:

- ❌ URLs
- ❌ HTTP methods
- ❌ GraphQL queries
- ❌ gRPC service names
- ❌ Database queries
- ❌ File paths

**Programs only contain**:

- ✅ What operations are needed
- ✅ What data flows through
- ✅ What transitions are possible
- ✅ What validations are required

**Implementation lives in plugs**. Protocol lives in programs.

---

## 🎭 The Elevator Pitch

### 30-Second Version

**Blackbox Protocol** is a way to ship workflows as portable, self-documenting files. Instead of documenting your API, ship a `.program.json` that orchestrates it. UIs discover actions automatically. Backends are swappable. Everything just works.

### 5-Minute Version

**The Problem**: APIs don't tell you how to use them. Every app reinvents orchestration. Business logic scatters everywhere.

**The Solution**: Workflows become first-class. One program file orchestrates everything. UIs query "what can I do?" and auto-generate. Backend implementation is pluggable.

**The Magic**:

- Programs are pure protocol (no transport)
- Plugs are pure implementation (swap at will)
- UIs are pure discovery (no hardcoding)

**The Result**: Zero glue code. Zero documentation. Zero coupling. Just workflows that run anywhere.

### Taglines

- "Don't document your API. Delete it. Ship a blackbox."
- "One file. Any backend. Zero glue."
- "The workflow is the API."
- "Discovery over documentation."
- "Protocol over implementation."

---

## 🎪 The Larry Mode (UX Philosophy)

Remember Leisure Suit Larry? Text adventures?

```
> look
You are in the hotel lobby.

> possible actions
- Go to elevator
- Talk to receptionist
- Check inventory

> go to elevator
```

**That's Blackbox.**

Replace "look" with `where()`.  
Replace "possible actions" with `can()`.  
Replace "go to elevator" with `do('GO_ELEVATOR')`.

**Why this matters**:

- No assumptions about UI
- Works in terminal, web, mobile, AI
- Conversational by default
- Discoverable by design

Modern UIs are just fancy Larry games.

---

## 📊 Comparison Matrix

| Concern            | Traditional API      | BPM Tools (Temporal)   | XState           | Blackbox         |
| ------------------ | -------------------- | ---------------------- | ---------------- | ---------------- |
| **Orchestration**  | Manual in client     | Server-side workflow   | UI state machine | Protocol-first   |
| **Discovery**      | Read docs            | Dashboard UI           | Manual code      | `can()` built-in |
| **Backend Swap**   | Rewrite code         | Reconfigure activities | Change services  | Swap plugs       |
| **Portability**    | Coupled to transport | Server-bound           | Framework-bound  | 100% portable    |
| **Learning Curve** | Per-API              | Days                   | Steep            | 30 seconds       |
| **Bundle Size**    | N/A                  | MB+                    | 50KB+            | 5KB              |
| **Setup**          | None                 | Complex infra          | npm install      | Drop file        |

---

## 🏆 Success Metrics

We'll know we succeeded when:

1. **Developers stop writing API docs**

   - They ship programs instead
   - UIs auto-discover everything

2. **UIs stop hardcoding workflows**

   - No more `if (step === 1) ...`
   - Just `can()` and `do()`

3. **Backend changes don't break clients**

   - Swap REST → GraphQL: works
   - Add new step: clients discover
   - Change validation: runtime enforces

4. **Onboarding takes 2 minutes**

   - Open program file
   - Read it
   - Start using it

5. **One program runs everywhere**
   - Web, mobile, CLI, AI agent
   - REST, GraphQL, mock, local
   - React, Vue, Svelte, vanilla

---

## 🌍 The Bigger Vision

### Phase 1: Protocol (✅ Done)

- Spec v1.3
- Reference runtime
- Proof of concept

### Phase 4: Standards (Dream)

- W3C consideration
- OpenAPI integration
- Industry adoption
- "npm for workflows"

---

## 💭 Philosophical Musings

### On Simplicity

> "Perfection is achieved not when there is nothing more to add, but when there is nothing left to take away."  
> — Antoine de Saint-Exupéry

We took away:

- Actors
- Spawning
- Hierarchies
- Parallel states
- History modes
- Activities

What remains: Pure workflow orchestration.

### On Discovery

> "The best API documentation is no documentation."

If developers have to read docs, we failed.  
If UIs have to hardcode flows, we failed.  
If backends can't swap, we failed.

Discovery over documentation.

### On Protocols

> "Libraries come and go. Protocols last forever."

Blackbox isn't a library.  
It's a way to describe workflows.  
The protocol is language-agnostic.  
The files are portable.  
The ideas are eternal.

---

## 🎉 The Day APIs Died

**November 7, 2025**

On this day, we stopped thinking about:

- "What endpoints do I call?"
- "What order do I call them in?"
- "How do I handle errors?"
- "What if requirements change?"

We started thinking about:

- "What workflow do I need?"
- "What operations does it require?"
- "Can I swap the backend?"
- "Will it evolve gracefully?"

**APIs didn't disappear.**  
**They just became implementation details.**

The workflow is the new API.

---

## 🎸 Credits

**Conceived**: November 6, 2025  
**Designed**: November 6-7, 2025  
**Shipped**: POC November 7, 2025

**Philosophy**: Discovery over documentation. Protocol over implementation.

**Inspiration**:

- XState (state machines done right)
- Leisure Suit Larry (conversational UX)
- Unix philosophy (do one thing well)
- REST (constraints enable freedom)

---

**The future is discoverable.**  
**The future is portable.**  
**The future is a blackbox.**

---

_"We are done guessing how to use systems. We just ask the blackbox what's possible right now."_

— The Blackbox Manifesto, November 2025

**_Alejandro Corsino_** 13/11/25
