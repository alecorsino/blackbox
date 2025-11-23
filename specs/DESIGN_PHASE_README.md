# Blackbox Protocol - Design Phase Working Guide

**Status**: Design & Specification Phase (NOT Implementation)
**Date**: November 2025

---

## Current Phase

We are **designing the Blackbox Protocol v2.0 specification**, NOT writing implementation code.

**What this means:**

- Focus: Protocol design, documentation, examples
- Output: Markdown specification files
- No code: Not searching for or writing `.ts`, `.js`, or runtime files

---

## What We're Doing

1. **Reviewing changes** from `PROTOCOL_V2_CHANGE_LIST.md`
2. **Updating spec docs** with design decisions
3. **Creating examples** to demonstrate protocol features
4. **Designing patterns** for naming, structure, validation

---

## Key Files

| File                                      | Purpose                                                             |
| ----------------------------------------- | ------------------------------------------------------------------- |
| `BLACKBOX_ARCHITECTURE.md`                | **Foundational**: Protocol vs runtime separation, design principles |
| `PROTOCOL_V2_CHANGE_LIST.md`              | Master list of changes (🔴 → 🟡 → 🟢)                               |
| `BLACKBOX_PROTOCOL_V2.md`                 | Main v2.0 specification                                             |
| `BLACKBOX_QUICK_REFERENCE.md`             | Quick reference guide                                               |
| `BLACKBOX_PROGRAM_SPEC.md`                | Legacy v1.3 spec (reference only)                                   |
| `examples/shopping-checkout.program.json` | Complete working example                                            |

---

## Workflow

### Session Pattern

1. Pick next item from `PROTOCOL_V2_CHANGE_LIST.md`
2. Research existing spec content
3. Discuss design approach (if needed)
4. Update specification files
5. Mark item as 🟢 Completed

### Priority Order

- Quick wins first (#1, #7) ✅ Done
- Medium changes (#6)
- Design questions (#2, #3, #4, #8)
- Major design (#5)

---

## What NOT to Do

❌ **Don't search for:**

- TypeScript files (`*.ts`)
- JavaScript files (`*.js`)
- Implementation/runtime code
- Test files

✅ **Focus on:**

- Markdown files (`*.md`)
- JSON examples (`*.json`)
- Specification documents only

---

## Quick Context for AI

> We're in specification/design mode. All work happens in `specs/` directory markdown files. The goal is to design the protocol structure, not implement it. Think "API design doc" not "API implementation".

---

## Progress Tracking

**Completed:**

- ✅ Item #1: Remove `icon` from EventDefinition
- ✅ Item #7: Extract Complete Example to separate file
- ✅ Item #2: Event params vs Operation input
- ✅ Item #6: Move `required` to inline
- ✅ Item #4: Guard/cond naming

**Remaining:**

- 🔴 Item #8: Action operations and data schema
- 🔴 Item #3: Phase property naming
- 🔴 Item #5: Program composition

---

**Last Updated**: After completing quick wins (Items #1 and #7)
