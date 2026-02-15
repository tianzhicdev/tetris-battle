#!/bin/bash
#
# spec-runner.sh — Autonomous spec implementation with auto-resume
#
# Keeps launching Claude Code sessions until the spec is fully implemented.
# Reads the work log between sessions to detect completion.
#
# Usage:
#   ./spec-runner.sh specs/001-ai-players.md
#   ./spec-runner.sh specs/001-ai-players.md --max-runs 10
#

set -euo pipefail

SPEC_FILE="${1:?Usage: ./spec-runner.sh <spec-file> [--max-runs N]}"
MAX_RUNS="${3:-8}"

# Extract spec name from file path (e.g., "specs/001-ai-players.md" -> "001-ai-players")
SPEC_NAME=$(basename "$SPEC_FILE" .md)

# Create unique directory for this spec
SPEC_DIR=".spec-implementer/${SPEC_NAME}"
WORK_LOG="${SPEC_DIR}/work-log.md"
VERIFICATION="${SPEC_DIR}/verification.md"
LOG_DIR="${SPEC_DIR}/session-logs"
RUN_COUNT=0

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

log() { echo -e "${GREEN}[spec-runner]${NC} $1"; }
warn() { echo -e "${YELLOW}[spec-runner]${NC} $1"; }
err() { echo -e "${RED}[spec-runner]${NC} $1"; }

mkdir -p "$LOG_DIR"

is_complete() {
  # Check if verification report exists and has no FAIL entries
  # NEEDS_MANUAL_TEST entries are OK - those are for the user to verify
  if [[ -f "$VERIFICATION" ]]; then
    if grep -q "| FAIL |" "$VERIFICATION" || grep -q "Status.*FAIL" "$VERIFICATION"; then
      return 1
    fi
    # Also check if the verification has a summary showing 0 failures
    if grep -q "Failed: 0" "$VERIFICATION"; then
      return 0
    fi
    # If verification exists but no clear completion signal, check work log
    if [[ -f "$WORK_LOG" ]] && grep -q "Phase 4.*complete" "$WORK_LOG"; then
      return 0
    fi
  fi
  return 1
}

get_current_phase() {
  if [[ ! -f "$WORK_LOG" ]]; then
    echo "not-started"
    return
  fi
  grep -oP 'Current Phase: \K.*' "$WORK_LOG" 2>/dev/null || echo "unknown"
}

get_current_step() {
  if [[ ! -f "$WORK_LOG" ]]; then
    echo "none"
    return
  fi
  grep -oP 'Current Step: \K.*' "$WORK_LOG" 2>/dev/null || echo "unknown"
}

build_prompt() {
  local phase
  phase=$(get_current_phase)

  if [[ "$phase" == "not-started" ]]; then
    # First run — full initial prompt
    cat <<EOF
Use the spec-implementer skill to implement ${SPEC_FILE}.
Follow all 4 phases. Do not stop until Phase 4 verification is complete.
Store all progress in ${SPEC_DIR}/ (work-log.md, plan.md, etc.).
If you run low on context, update ${WORK_LOG} with your
exact progress before stopping so the next session can resume.
EOF
  else
    # Resume run — pick up where we left off
    cat <<EOF
Resume the spec-implementer skill. Read ${WORK_LOG} and
${SPEC_DIR}/plan.md to see exactly where you left off.
Current phase: ${phase}
Current step: $(get_current_step)
Continue from where you stopped. Follow the remaining steps in the plan.
Run tests after each step. Do not stop until Phase 4 verification is complete.
If you run low on context, update the work log with your exact progress
before stopping so the next session can resume.
EOF
  fi
}

# ─── Main Loop ───────────────────────────────────────────────

log "Starting autonomous implementation of ${SPEC_FILE}"
log "Max runs: ${MAX_RUNS}"
log "Monitor progress: while true; do clear; cat ${WORK_LOG} 2>/dev/null; sleep 2; done"
echo ""

while true; do
  RUN_COUNT=$((RUN_COUNT + 1))

  if [[ $RUN_COUNT -gt $MAX_RUNS ]]; then
    err "Hit max runs (${MAX_RUNS}). Implementation incomplete."
    err "Check ${WORK_LOG} for current state."
    err "Resume manually or increase --max-runs."
    exit 1
  fi

  # Check if already complete
  if is_complete; then
    log "Implementation complete! All verification criteria passed."
    break
  fi

  PROMPT=$(build_prompt)
  SESSION_LOG="${LOG_DIR}/session-${RUN_COUNT}.jsonl"

  log "━━━ Run ${RUN_COUNT}/${MAX_RUNS} ━━━"
  log "Phase: $(get_current_phase)"
  log "Step: $(get_current_step)"
  log "Logging to: ${SESSION_LOG}"
  echo ""

  # Build the claude command
  CLAUDE_ARGS=(-p "$PROMPT" --dangerously-skip-permissions --output-format stream-json --verbose)

  # Add --continue for resume runs (after first)
  if [[ $RUN_COUNT -gt 1 ]]; then
    CLAUDE_ARGS+=(--continue)
  fi

  # Run Claude Code, capture output
  claude "${CLAUDE_ARGS[@]}" 2>&1 | tee "$SESSION_LOG" | \
    jq -rj 'select(.type == "stream_event" and .event.delta.type? == "text_delta") | .event.delta.text // empty' 2>/dev/null || true

  echo ""
  log "Session ${RUN_COUNT} ended."

  # Brief pause before checking status
  sleep 2

  # Check if complete after this run
  if is_complete; then
    log "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    log "Implementation complete!"
    log "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
    log "Verification report: ${VERIFICATION}"
    log "Work log: ${WORK_LOG}"
    log "Total sessions: ${RUN_COUNT}"
    echo ""

    if [[ -f "$VERIFICATION" ]] && grep -q "NEEDS_MANUAL_TEST" "$VERIFICATION"; then
      warn "Some criteria need manual testing. Check ${VERIFICATION}"
    fi

    # Auto-deploy to PartyKit and Vercel
    log "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    log "Starting deployment..."
    log "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""

    # Deploy to PartyKit
    log "Deploying to PartyKit..."
    if cd packages/partykit && npx partykit deploy 2>&1; then
      log "✓ PartyKit deployment successful"
    else
      warn "⚠ PartyKit deployment failed (check logs above)"
    fi
    cd ../.. 2>/dev/null || true
    echo ""

    # Deploy to Vercel (via git push)
    log "Pushing to GitHub (Vercel will auto-deploy)..."
    if git push 2>&1; then
      log "✓ Pushed to GitHub - Vercel deployment in progress"
      log "  Check https://vercel.com for deployment status"
    else
      warn "⚠ Git push failed (check logs above)"
    fi
    echo ""

    log "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    log "Deployment complete!"
    log "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

    break
  fi

  log "Not yet complete. Auto-resuming in 3 seconds..."
  sleep 3
done
