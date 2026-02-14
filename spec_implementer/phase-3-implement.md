# Phase 3: Phased Implementation

## Purpose

Execute the plan from Phase 2 step by step. Each step is: write test → write code
→ run test → verify → commit logically → move on. Do not skip ahead. Do not batch
multiple steps without testing between them.

## Procedure

### Before Starting

1. Read `.spec-implementer/plan.md` — this is your instruction set
2. Read `.spec-implementer/research.md` — this is your pattern reference
3. Run the build to confirm a clean starting state: `[build command from plan]`
4. Run existing tests to confirm green: `[test command from plan]`
5. If either fails, fix before proceeding. Do not start implementation on a broken base.

### For Each Step

Follow this exact loop:

#### 1. Write the Test First (when the step has tests)

Create the test file specified in the plan. Write tests for the expected behavior
before writing the implementation. Tests should initially fail — that's correct.

If the step doesn't specify tests (e.g., a database migration step), skip to
writing the implementation.

#### 2. Write the Implementation

Create or modify files exactly as specified in the plan. Follow the patterns
from research.md. When the plan says "follow the same pattern as X", actually
open X and copy the structure.

Key discipline:
- Do NOT add things not in the plan (scope creep kills autonomous runs)
- Do NOT refactor existing code unless the plan says to
- Do NOT skip error handling — follow existing error patterns
- Do NOT invent new patterns — use what the codebase already does

#### 3. Run Tests

Run the specific test command for this step. If tests fail:

1. Read the error message carefully
2. Check if the test is wrong (typo, wrong expectation) — fix if so
3. Check if the implementation is wrong — fix if so
4. Re-run until green

Do not move to the next step with failing tests.

#### 4. Run the Full Build

After each step, run the full build command. This catches:
- TypeScript errors in other files caused by your changes
- Import resolution issues
- Missing exports

If the build fails, fix before moving on.

#### 5. Run All Tests

Run the full test suite (not just your new tests). This catches regressions.
If any existing test broke, you introduced a regression — fix it.

#### 6. Update the Work Log

In `.spec-implementer/work-log.md`, update:
- Current step number
- Tests passing count
- Any deviations from the plan (and why)

#### 7. Move to Next Step

### Handling Deviations

Sometimes the plan won't perfectly match reality. When you discover something
during implementation that contradicts the plan:

1. **Minor deviation** (different function name, slightly different data shape):
   Adapt and note in the work log. Keep going.

2. **Medium deviation** (file doesn't exist where expected, different message format):
   Re-read the relevant source files. Update your approach to match reality.
   Note in the work log what changed and why.

3. **Major deviation** (the entire approach won't work, missing dependency):
   Stop. Document the blocker in the work log. Note what you've learned and what
   needs to change in the plan. Then revise the plan for remaining steps and continue.

### Managing Context Window

For long implementations (10+ steps), your context may get large. To stay effective:

- The work log tracks your progress — you can always re-read it to know where you are
- The plan tells you what to do next — you don't need to keep everything in memory
- Close mental tabs on completed steps — they're done and tested

If you notice yourself losing track, re-read the work log and the current step
in the plan. That's all you need.

## Completion Criteria

Phase 3 is done when:
- Every step in the plan has been implemented
- All tests pass (both new and existing)
- The build is clean (no TypeScript errors, no warnings)
- The work log reflects all completed steps and any deviations

Update the work log and move to Phase 4.
