# Spec Implementer — Claude Code Skill

## What It Does

You give it a high-level spec. It reads your codebase, makes a prescriptive plan,
implements everything test-first, and verifies against your acceptance criteria.
You review the diff when it's done.

## Install

Copy the `spec-implementer/` folder into your project's `.claude/skills/` directory:

```bash
# From your project root
mkdir -p .claude/skills
cp -r /path/to/spec-implementer .claude/skills/spec-implementer
```

Claude Code auto-discovers skills in `.claude/skills/`.

## Usage

### Interactive Mode (recommended for first time)

```bash
claude --dangerously-skip-permissions
> Implement specs/001-ai-players.md using the spec-implementer skill
```

You'll see it work through each phase in real-time. Good for building trust
in the process before going fully autonomous.

### Headless Mode (fully autonomous — recommended)

Use the runner script. It auto-resumes when Claude hits the context limit:

```bash
chmod +x .claude/skills/spec-implementer/spec-runner.sh
.claude/skills/spec-implementer/spec-runner.sh specs/001-ai-players.md
```

That's it. Walk away. It will:
- Launch Claude Code against your spec
- Stream progress to your terminal
- Detect when Claude ran out of context (incomplete work log)
- Auto-resume with `--continue`, telling Claude where it left off
- Repeat until Phase 4 verification passes (or hits max 8 runs)

Monitor progress in another terminal:
```bash
while true; do clear; cat .spec-implementer/work-log.md 2>/dev/null; sleep 2; done
```

Set a higher max if your spec is very large:
```bash
.claude/skills/spec-implementer/spec-runner.sh specs/001-ai-players.md --max-runs 15
```

### Resuming After Interruption

The runner script handles auto-resume automatically. But if you killed it manually
or want to resume by hand:

```bash
# Let the runner pick up where it left off
.claude/skills/spec-implementer/spec-runner.sh specs/001-ai-players.md
```

It reads `.spec-implementer/work-log.md` and generates the right resume prompt.
You can also resume manually if you prefer:

```bash
claude -p "Resume the spec-implementer skill. Read .spec-implementer/work-log.md \
to see where we left off. Continue from the current phase and step." \
  --dangerously-skip-permissions --continue
```

## Writing Good Specs for This Skill

The skill works best when your spec includes:

1. **Context** — What already exists in the project (tech stack, key files)
2. **Requirements** — What to build, broken into logical sections
3. **File paths** — Where new files should go, which existing files to modify
4. **Verification criteria** — Numbered, testable acceptance criteria
5. **Test/build commands** — How to run tests and build the project

The skill handles ambiguity by researching the codebase, but the more explicit
your spec, the better the output.

## What It Produces

After a successful run, you'll find:

```
.spec-implementer/
├── work-log.md          # Full progress log
├── research.md          # Codebase analysis (Phase 1)
├── plan.md              # Prescriptive implementation plan (Phase 2)
└── verification.md      # Final verification report (Phase 4)
```

Plus all the actual code changes in your project, with tests.

## OpenClaw Integration

If you're using OpenClaw with the Claude Code plugin, you can trigger this
from Telegram:

```
"Implement the AI players spec in my tetris-battle repo"
```

Your OpenClaw orchestrator skill would:
1. Start a Claude Code session in the tetris-battle directory
2. Send: "Use the spec-implementer skill to implement specs/001-ai-players.md"
3. Monitor the work log for progress updates
4. Forward the verification report to you when done

## Tips

- **First run**: Use interactive mode so you can see what it does. If it makes
  wrong assumptions during research, you can course-correct early.
- **Large features**: Break into multiple specs. Implement sequentially.
  The CLAUDE.md updates from each run give context to the next.
- **After completion**: Always `git diff` before committing. The skill is good
  but not infallible.
- **Iteration**: If the output isn't right, update the spec (not the code)
  and re-run. The spec is your source of truth.
