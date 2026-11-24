---
name: implement-task
description: Implement a specifically owner-approved Snow Control ticket and repair in-scope failures.
---

# implement-task
Read `agent-workflow/START_HERE.md` and current task first.

Engineering only. Match explicit GO, base and allowlist. Preflight gate; preserve baseline, use minimum diff. Run targeted tests then agreed regression, inspect failures; max 3 no-progress attempts then block. No edits beyond authorized paths, no hidden dependency or network changes. Do not regenerate release manifest except authorized. Run diff gate, package logs and update checkpoint; STOP WAIT_REVIEW.
