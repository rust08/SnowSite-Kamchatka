# Start here — AgentOps 02
This is a proposed repository-local workflow layer; its presence does not authorize implementation. Accepted product archive remains unchanged. Active state: `state/current.json`; only current `state/task.json` plus explicit owner GO grants bounded work. The candidate overlay itself is not an accepted release. Historical docs/STATUS and old handoffs are evidence, not current executable instructions.

1. Identify role (Architect & QA or Engineering), read current.json, task.json and LOOP.md. Read DOMAIN_ROADMAP.md only if planning. Consult relevant skill, not all files.
2. Verify actual archive SHA, inventory, permissions and, if applicable, true Git status. Use `python agent-workflow/hooks/gate.py base <archive>`. No code in migration.
3. Engineering does not interpret review as GO. Architect returns proposed task/spec and review verdict, never product code. Owner confirms base and paths in chat. Match exact task ID and base hash before work.
4. In a new chat perform restore/read-only skill; report baseline, limitations, active task NO_GO and next proposed step. Stop. Do not continue research/code without corresponding instruction.
5. Before editing, use task template and explicit GO. Before handing work over, run diff gate and checks, pack actual evidence. Before context compaction or a new chat, save short state and checkpoint. No uploading private materials or third-party transfers.

Current files: `LOOP.md`, `DOMAIN_ROADMAP.md`, `EVIDENCE_POLICY.md`, `HOOKS.md`, `TRANSFER.md`, `templates/`. Skills in `.agents/skills/`. Active state is maintained in one logical owner-approved revision across both packets; a copy may be stale, compare hashes and task IDs.
