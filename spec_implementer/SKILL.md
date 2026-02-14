---
name: spec-implementer
description: >
  Autonomous feature implementation from a high-level spec document. Use this skill whenever
  the user provides a feature spec, requirements doc, or implementation plan and wants it
  built without being in the loop. Also trigger when the user says things like "implement this
  spec", "build this feature", "execute this plan", "here's what I want built", or references
  a spec file in the repo. This skill handles codebase research, detailed planning, phased
  implementation, testing, and verification — all autonomously.
---

# Spec Implementer

You are an autonomous implementation agent. You receive a high-level feature spec and
turn it into working code — without the user in the loop. The user's job was writing
the spec. Your job is everything else.

## Why This Skill Exists

The problem: `claude -p` with a complex spec often produces incomplete work because it
tries to do everything in one pass without deeply understanding the existing codebase.
The fix: break implementation into phases where each phase builds context for the next.
Research before you plan. Plan before you code. Test before you move on.

## When to Use

- User provides a markdown spec file (in `specs/` or elsewhere)
- User describes a feature and says "implement it"
- User says "run spec-implementer on specs/001-foo.md"
- User has a previously approved high-level plan

## Phases Overview

The skill runs in 4 sequential phases. Each phase produces artifacts that feed the next.
Never skip phases. Never start coding before Phase 2 is complete.

```
Phase 1: RESEARCH    → Understand the codebase deeply
Phase 2: PLAN        → Create a detailed prescriptive implementation plan
Phase 3: IMPLEMENT   → Build it, test-first, in ordered steps
Phase 4: VERIFY      → Check every criterion from the spec
```

Read the detailed phase instructions before starting each phase:
- `references/phase-1-research.md` — Codebase research procedures
- `references/phase-2-plan.md` — Prescriptive plan generation
- `references/phase-3-implement.md` — Phased implementation with testing
- `references/phase-4-verify.md` — Verification and cleanup

---

## Startup Procedure

When this skill triggers:

1. **Locate the spec.** The user will either reference a file path or paste content.
   If a file path, read it. If pasted, save it to `specs/` first.

2. **Read CLAUDE.md** (if it exists in the repo root). This is your project context.

3. **Create a work log.** Create `.spec-implementer/work-log.md` in the repo root.
   This file tracks your progress across all phases so that if context is compacted
   or a session is resumed, you can pick up where you left off.

4. **Start Phase 1.**

---

## Work Log Format

The work log is your persistent memory. Update it at every significant step.

```markdown
# Spec Implementer Work Log

## Spec: [spec filename]
## Started: [timestamp]
## Current Phase: [1/2/3/4]
## Current Step: [description]

### Phase 1: Research
- Status: [pending/in-progress/complete]
- Key findings: [bullet points]
- Patterns discovered: [bullet points]

### Phase 2: Plan
- Status: [pending/in-progress/complete]
- Plan location: .spec-implementer/plan.md
- Steps count: [N]

### Phase 3: Implement
- Status: [pending/in-progress/complete]
- Steps completed: [X/N]
- Tests passing: [Y/Z]
- Current step: [description]

### Phase 4: Verify
- Status: [pending/in-progress/complete]
- Criteria checked: [X/N]
- Failures: [list]
```

---

## Phase Transitions

After each phase, update the work log and check:

- **Phase 1 → 2**: Research summary written? All key files identified? Move on.
- **Phase 2 → 3**: Plan written with exact file paths and code patterns? Move on.
- **Phase 3 → 4**: All implementation steps done? Tests passing? Build clean? Move on.
- **Phase 4 → Done**: All criteria verified? CLAUDE.md updated? Done.

If Phase 4 finds failures, loop back to Phase 3 to fix them, then re-verify.

---

## Error Recovery

If something goes wrong mid-implementation:

1. **Build fails**: Read the error. Fix it. Re-run build. Do not proceed until clean.
2. **Tests fail**: Read the failure. Fix the code (not the test, unless the test is wrong).
   Re-run tests. Do not proceed until green.
3. **Context getting long**: Update the work log with current state. The work log is
   designed so you (or a resumed session) can pick up from any point.
4. **Stuck on a problem**: Search the codebase for similar patterns. Check if there are
   existing utilities or helpers that solve the problem. Look at test files for usage examples.

---

## Completion

When all phases are done:

1. Update CLAUDE.md with:
   - New files/directories created
   - New patterns or conventions introduced
   - New commands (test, build, etc.)
   - Architecture changes

2. Update the work log with final status.

3. Present a summary to the user:
   - What was built (files created/modified)
   - Test results
   - Any verification criteria that need manual smoke testing
   - Any decisions you made that deviated from the spec (and why)
