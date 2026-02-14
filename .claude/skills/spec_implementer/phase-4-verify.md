# Phase 4: Verification and Cleanup

## Purpose

Go through every verification criterion from the original spec and confirm it's met.
This is separate from the step-level testing in Phase 3 — here you verify against
the spec's acceptance criteria, not your plan's steps.

## Procedure

### Step 1: Re-read the Original Spec

Open the original spec file. Go to the verification/acceptance criteria section.
List every single criterion.

### Step 2: Check Each Criterion

For each criterion, do one of:

**If it's a test criterion** (e.g., "Unit test: X should return Y"):
- Find the test that covers it
- Run it specifically and confirm it passes
- Note: PASS

**If it's a build/compile criterion** (e.g., "No TypeScript errors"):
- Run the build
- Confirm clean output
- Note: PASS

**If it's an integration criterion** (e.g., "Match ends → history record exists"):
- Trace the code path to confirm the logic is implemented
- Check that the relevant test covers this flow
- Note: PASS or NEEDS_MANUAL_TEST

**If it's a UI/visual criterion** (e.g., "Main menu shows Friends button"):
- Confirm the component exists and is rendered
- Note: NEEDS_MANUAL_TEST (flag for user)

**If it's a runtime criterion** (e.g., "AI opponent board shows piece movement"):
- Confirm the code path exists
- Note: NEEDS_MANUAL_TEST (flag for user)

### Step 3: Handle Failures

If any criterion fails:
1. Identify what's missing or broken
2. Go back to Phase 3 — implement the fix
3. Return to Phase 4 — re-verify that criterion AND re-run the full suite

### Step 4: Write Verification Report

Create `.spec-implementer/verification.md`:

```markdown
# Verification Report for [Spec Name]

## Summary
- Total criteria: [N]
- Passed: [N]
- Needs manual test: [N]
- Failed: [N]

## Results

| # | Criterion | Status | Evidence |
|---|-----------|--------|----------|
| 1 | [criterion text] | PASS | [test name or command] |
| 2 | [criterion text] | NEEDS_MANUAL_TEST | [what to check] |
| 3 | [criterion text] | FAIL | [what's wrong] |

## Manual Test Checklist
For the user to verify after running the dev server:
- [ ] [criterion]: [how to test it]
- [ ] [criterion]: [how to test it]
```

### Step 5: Update CLAUDE.md

Read the existing CLAUDE.md (or create one if it doesn't exist). Add:

```markdown
## Recent Changes: [Feature Name]

### New Files
- `path/to/file.ts` — [brief description]

### Modified Files
- `path/to/file.ts` — [what changed]

### New Patterns
- [Any new patterns introduced, e.g., "Friend challenges use the same
  Partykit message format as matchmaking"]

### New Commands
- `pnpm test -- --grep "friend"` — Run friend system tests
- [other relevant commands]
```

### Step 6: Final Build + Test Run

One last time:
```bash
[build command]
[test command]
```

Both must be clean.

## Completion Criteria

Phase 4 is done when:
- Every spec criterion has been checked and is either PASS or NEEDS_MANUAL_TEST
- Zero FAIL criteria remain
- CLAUDE.md has been updated
- Final build and test run are clean
- Verification report is written

Update the work log with final status. You're done.

## Summary Output

Present to the user:

```markdown
## Implementation Complete: [Spec Name]

### Files Created: [N]
[list]

### Files Modified: [N]
[list]

### Tests: [N] passing
[test command and output summary]

### Verification: [N]/[M] auto-verified, [K] need manual testing

### Manual Test Checklist:
[list of things the user should verify by running the dev server]

### Deviations from Spec:
[any decisions you made that differ from the original spec, with reasoning]
```
