# Phase 2: Prescriptive Implementation Plan

## Purpose

Turn the high-level spec + your research into an ordered list of concrete steps
that can be executed mechanically. Each step should be small enough to implement,
test, and verify independently.

The plan is the critical artifact. A good plan means Phase 3 is just execution.
A vague plan means Phase 3 will be full of guessing and wrong turns.

## What Makes a Step "Prescriptive"

Bad step (vague):
> "Add presence tracking to the Partykit server"

Good step (prescriptive):
> "In `packages/partykit/src/matchmaking.ts`, inside the `Server` class:
> 1. Add a `presenceMap: Map<string, { status: string, connectedAt: number }>` property
> 2. In the existing `onConnect` handler, after the current logic, add:
>    `this.presenceMap.set(connection.id, { status: 'menu', connectedAt: Date.now() })`
> 3. In the existing `onClose` handler, add a 10-second setTimeout that calls
>    `this.presenceMap.delete(connection.id)` if they haven't reconnected
> 4. Add a new case in `onMessage` for type `'presence_subscribe'` that sends
>    back `{ type: 'presence_update', ... }` for each requested userId"

The difference: the good step tells you exactly which file, which class, which
method, what data structure, and what the code should roughly do. You don't need
to think — you just write it.

## Procedure

### Step 1: Read Your Research

Open `.spec-implementer/research.md`. Everything in the plan must be consistent
with the patterns you documented.

### Step 2: Order the Work

Break the spec into implementation steps ordered by dependency:

1. **Schema/data first** — Database migrations, type definitions, interfaces
2. **Pure logic second** — Service functions, utilities, algorithms (no UI, no IO)
3. **Integration third** — Server handlers, API routes, WebSocket messages
4. **State management fourth** — Stores, state updates, subscriptions
5. **UI last** — Components, styling, user interactions

This order means each step can build on tested foundations.

### Step 3: Write Each Step

For each step, specify:

```markdown
### Step N: [Short Title]

**Files to create:**
- `path/to/new/file.ts` — [what it contains]

**Files to modify:**
- `path/to/existing/file.ts` — [what changes, where in the file]

**Implementation details:**
[Prescriptive description using patterns from research.md.
Include the data structures, function signatures, and message formats
to use. Reference existing code: "follow the same pattern as X in Y.ts"]

**Test:**
- Create `path/to/test.test.ts`
- Test cases: [list specific scenarios]
- Run: `[exact test command]`

**Verify:**
- [How to confirm this step worked before moving on]
```

### Step 4: Map Spec Verification Criteria to Steps

The original spec has verification criteria. Map each one to the step(s) that
satisfy it. This ensures nothing falls through the cracks.

```markdown
## Verification Mapping

| Spec Criterion | Covered by Step(s) |
|---------------|-------------------|
| "Unit test: sendFriendRequest with valid username" | Step 3 |
| "Integration: challenge flow happy path" | Steps 5, 6, 7 |
| "UI: main menu shows Friends button" | Step 9 |
```

If any criterion isn't covered by a step, add a step.

### Step 5: Write the Plan

Save to `.spec-implementer/plan.md`:

```markdown
# Implementation Plan for [Spec Name]

## Overview
- Total steps: [N]
- Estimated new files: [N]
- Estimated modified files: [N]

## Steps
[All steps in order]

## Verification Mapping
[Criteria → steps table]

## Build/Test Commands
- Build: [command]
- Test all: [command]
- Test specific: [pattern]
```

## Completion Criteria

Phase 2 is done when:
- Every step has exact file paths, not just module names
- Every step references patterns from the research (not invented conventions)
- Every step has a test or verification method
- Every spec verification criterion maps to at least one step
- Steps are ordered so no step depends on a later step

Update the work log and move to Phase 3.
