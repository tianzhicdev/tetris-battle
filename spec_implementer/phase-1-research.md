# Phase 1: Codebase Research

## Purpose

Before you write a single line of code, you need to deeply understand the existing
codebase. The #1 reason autonomous implementations fail is that the agent doesn't
understand existing patterns and creates code that doesn't integrate properly.

This phase is pure reading. You create nothing except the research summary.

## Procedure

### Step 1: Map the Project Structure

Run a directory listing of the entire project:
```bash
find . -type f -name '*.ts' -o -name '*.tsx' -o -name '*.js' -o -name '*.json' | head -200
```

Read the project's package.json (root and any workspace packages) to understand:
- What packages exist in the monorepo
- What dependencies are used
- What scripts are available (build, test, dev, lint)

### Step 2: Understand the Build System

Run the build command and note:
- Does it succeed?
- What build tool is used (vite, tsc, webpack, etc.)?
- What's the build output structure?
- Are there any existing test frameworks configured?

If tests exist, run them and note what framework is used (vitest, jest, etc.)
and what the test patterns look like.

### Step 3: Read Files Referenced by the Spec

For every file the spec mentions (creating or modifying), read the existing version
if it exists. For new files, read sibling files in the same directory to understand
conventions.

Pay attention to:
- Import patterns (relative vs absolute, barrel exports)
- Naming conventions (camelCase, PascalCase, kebab-case for files)
- Type definition patterns (interfaces vs types, where they live)
- State management patterns (how stores are structured, how actions work)
- Component patterns (functional vs class, hooks used, styling approach)
- Error handling patterns (try/catch, Result types, error boundaries)
- Test patterns (describe/it structure, mocking approach, test utilities)

### Step 4: Trace Key Flows

For the feature you're implementing, trace the closest existing analogous flow
end-to-end. For example, if implementing a "friend challenge" system:

1. Find the existing matchmaking flow
2. Read how a player joins the queue (client → server message)
3. Read how the server pairs players (server logic)
4. Read how the match starts (server → client message)
5. Read how the client renders the match

This gives you the exact message formats, handler patterns, and state update
patterns you need to follow.

### Step 5: Identify Integration Points

List every place your new feature needs to touch existing code:
- New imports needed in existing files
- New cases in switch statements or message handlers
- New routes, menu items, or UI entry points
- New database tables or schema changes
- New environment variables or configuration

### Step 6: Write the Research Summary

Create `.spec-implementer/research.md` with:

```markdown
# Research Summary for [Spec Name]

## Project Structure
- Monorepo: [yes/no, tool used]
- Packages: [list]
- Build: [tool and command]
- Tests: [framework and command]

## Existing Patterns

### Imports
[How this project does imports — examples]

### State Management
[How stores work — example from an existing store]

### Components
[How components are structured — example pattern]

### Server Messages
[Message format — example from existing code]

### Database
[Schema patterns — example from existing migration]

### Tests
[Test patterns — example from existing test]

## Analogous Flow
[End-to-end trace of the closest existing feature]

## Integration Points
[List of every existing file that needs modification and what changes]

## Key Files to Reference During Implementation
[List of files that should be open/referenced while coding]
```

This document is your reference for all of Phase 2 and 3. If you find yourself
guessing about a pattern during implementation, you missed something here.

## Completion Criteria

Phase 1 is done when:
- You've read every file the spec references (existing or sibling)
- You've traced at least one analogous flow end-to-end
- The research summary is written with concrete code examples (not vague descriptions)
- Integration points are identified with specific line numbers or function names

Update the work log and move to Phase 2.
