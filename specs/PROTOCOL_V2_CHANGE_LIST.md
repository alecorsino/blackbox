# Blackbox Protocol v2.0 - Change List

**Status**: Design & Review Phase
**Date**: November 2025

This document captures design questions and proposed changes for the Blackbox Protocol v2.0 specification. Each item will be addressed in separate sessions.

---

## 1. Remove `icon` from EventDefinition

**What**: Remove `icon?: string;` property from EventDefinition

**Why**: Superfluous for terminal use; we're building something terminal-capable, not just GUI

**Where**:
- EventDefinition interface definition
- All examples showing events
- JSON Schema definition

**Status**: 🟢 Completed

---

## 2. Clarify/Unify: Event params vs Operation input/output

**Question**: Are we inventing different concepts for the same purpose?

**Observation**: Both use DataSchemaField, both define structure and validation

**Current state**:
- `events.SEARCH.params` - validates what user sends via `do()`
- `operations.searchProducts.input` - validates what plug receives
- Often these are the same or very similar schemas

**Need to decide**:
- Should these be unified (one concept)?
- Or do they serve genuinely different purposes?
- If different: what's the clear distinction and when would they differ?
- If same: how to simplify without losing functionality?

**Status**: 🔴 Not Started

---

## 3. Better naming conventions for Phase properties

**Goal**: Make properties self-documenting - understand what they do and when WITHOUT reading documentation

**Current state** (Phase interface):
```typescript
interface Phase {
  on?: Record<string, Transition>;  // Event handlers
  invoke?: InvokeConfig;            // Async operation on entry
  entry?: string | string[];        // Action(s) on entry
  exit?: string | string[];         // Action(s) on exit
  tags?: string[];                  // For grouping/filtering
  type?: 'final';                   // Mark as terminal state
}
```

**Problems**:
- `on` - handles events, but not intuitive
- `invoke` - when does it run? (on entry, but not clear)
- `invoke.src` - doesn't follow `on*` pattern like `onDone`, `onError`
- `entry`/`exit` - clear, but inconsistent with `on*` pattern
- Mix of patterns: `on`, `invoke`, `entry/exit`

**Need to decide**:
- Consistent naming pattern that's self-documenting
- When does each thing run?
- Should everything follow `on*` pattern? (onEvent, onEntry, onExit, onInvoke?)
- Or different pattern entirely?

**Status**: 🔴 Not Started

---

## 4. Better naming for guard/cond relationship

**Goal**: Make it intuitive how guards and conditions work together

**Current state**:
- Operation with `type: 'guard'` (returns boolean)
- Referenced in transition with `cond: 'hasCartItems'`

**Example**:
```typescript
operations: {
  hasCartItems: { type: 'guard', ... }  // Define the guard
}
phases: {
  on: {
    CHECKOUT: {
      target: 'payment',
      cond: 'hasCartItems'  // Reference the guard
    }
  }
}
```

**Problems**:
- Not obvious that `cond` references a `guard` operation
- "cond" is abbreviation (condition)
- "guard" is state machine jargon
- Connection between the two isn't intuitive

**Need to decide**:
- Better names that make the relationship obvious
- Should operation type match the property name? (`guard` vs `cond`)
- More intuitive naming pattern that doesn't require state machine knowledge

**Status**: 🔴 Not Started

---

## 5. Program composition - workflows within workflows

**Goal**: Break down large workflows into smaller, reusable programs and compose them

**Current state**: No composition mechanism defined

**Questions**:
- Can we have a "program" within a "program"?
- How to break down large workflows into smaller ones?
- How to combine/compose them?
- How would they be defined in the protocol?

**Use cases**:
- Checkout flow that uses separate "payment-processing" program
- Authentication flow reused across multiple programs
- Multi-step forms broken into smaller sub-flows

**Need to decide**:
- Is this an `invoke` a sub-program? (new operation type: 'program'?)
- Reference external programs by ID/path?
- How does data flow between parent and child programs?
- How do events bubble up/down?
- Does child program run in same session or separate?
- How to handle child completion (success/error/cancel)?

**Status**: 🔴 Not Started

---

## 6. Move `required` from array to inline property

**Goal**: Simplify and make it more intuitive where required is declared

**Current state**:
```typescript
models: {
  Product: {
    type: 'object',
    properties: {
      id: { type: 'string' },
      name: { type: 'string' },
      price: { type: 'number' }
    },
    required: ['id', 'name', 'price']  // Array at schema level
  }
}
```

**Proposed**:
```typescript
models: {
  Product: {
    type: 'object',
    properties: {
      id: { type: 'string', required: true },
      name: { type: 'string', required: true },
      price: { type: 'number', required: true }
    }
    // No required array needed
  }
}
```

**Benefits**:
- More intuitive - see required status next to the field
- Less duplication (don't repeat field names)
- Easier to maintain
- Consistent with how `DataSchemaField` already works

**Note**: This affects `models`, `operations.input`, `operations.output` schemas

**Status**: 🔴 Not Started

---

## 7. Extract Complete Example to separate file

**What**: Move section 11 "Complete Example" from BLACKBOX_PROTOCOL_V2.md to its own file

**Why**:
- Easier to update independently
- Keep spec doc focused on specification
- Example might have errors and will change as we iterate
- Better maintainability

**Action**:
- Create new file: `specs/examples/shopping-checkout.program.json` (or `.ts`)
- Replace section 11 in spec with link to the example file
- Keep example up to date with protocol changes separately

**Status**: 🟢 Completed

---

## 8. Action operations should explicitly relate to `data` schema

**Goal**: Make it clear what state fields actions modify and validate state mutations

**Current state** (too generic):
```typescript
operations: {
  storeSearchResults: {
    type: 'action',
    input: { type: 'object' },      // Generic - no relation to data
    output: { type: 'object' }      // Generic - what does it change?
  }
}
```

**Problems**:
- No connection between action and `data` schema
- Can't validate that action updates are valid for the data model
- No way to know which data fields this action modifies
- How do we know what the new state shape will be?
- Runtime can't verify action is updating state correctly

**Questions to decide**:
- Should `output` reference specific fields from `data`?
- Should actions declare which data fields they modify?

**Example possibilities**:
```typescript
// Option A: Explicit data field references
storeSearchResults: {
  type: 'action',
  updates: ['products', 'query'],  // Declares what it modifies
  output: {
    products: { $ref: '#/data/products' },
    query: { $ref: '#/data/query' }
  }
}

// Option B: Output must match subset of data
storeSearchResults: {
  type: 'action',
  output: {  // Must be valid partial update to data
    products: { type: 'array', items: { $ref: '#/models/Product' } },
    query: { type: 'string' }
  }
}
```

**Additional questions**:
- How to validate that action outputs are compatible with data schema?
- Should runtime enforce that actions only modify declared fields?

**Status**: 🔴 Not Started

---

## Session Plan

Each item should be tackled in a separate focused session:

1. **Session 1**: Item #1 (Quick win - simple removal)
2. **Session 2**: Item #7 (Quick win - file organization)
3. **Session 3**: Item #6 (Medium - schema restructuring)
4. **Session 4**: Item #2 (Design - event params vs operation input)
5. **Session 5**: Item #8 (Design - action operations and data)
6. **Session 6**: Item #4 (Design - guard/cond naming)
7. **Session 7**: Item #3 (Design - Phase property naming)
8. **Session 8**: Item #5 (Major design - program composition)

---

## Notes

- Items marked 🔴 Not Started
- Items marked 🟡 In Progress
- Items marked 🟢 Completed

After each session, update the status and document decisions made.
