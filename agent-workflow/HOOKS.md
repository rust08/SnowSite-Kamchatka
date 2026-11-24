# Hooks: executable checkpoints, not a security sandbox
Ordinary ChatGPT chat cannot automatically execute repo hooks on every edit/turn. Explicitly invoke checks in the loop using shell/python when available; if unavailable record NOT_RUN. Native Codex lifecycle hooks are optional; template `codex-hooks.example.json` is deliberately inactive. In a trusted repo after approval, copy it to `.codex/hooks.json` **only if no existing config would be overwritten**, review script, use `/hooks`/trust UI as supported by your Codex version. Run Codex from project root with Python available; template commands resolve relative to root. For shared repo root different from module root, adapt commands after inspecting actual paths. Never bypass trust. Test in actual environment first. No native runtime verification performed here.

CLI (Python 3.11+, standard library, read-only; paths on command line):
```
python agent-workflow/hooks/gate.py base path/to/accepted.zip
python agent-workflow/hooks/gate.py pack path/to/review-pack.zip
python agent-workflow/hooks/gate.py diff path/to/base.zip path/to/candidate.zip path/to/approved-task.json
python agent-workflow/hooks/gate.py state
python -m unittest discover -s agent-workflow/hooks -p 'test_*.py'
```
`base`: current pinned H01 archive SHA + exact membership and per-file hashes. `pack`: root MANIFEST.sha256 (exclude itself; nested ZIPs hashed as bytes, not recursively trusted). `diff`: validates the supplied base SHA and checks exact ADD/EDIT/DELETE paths (unexpected changes fail; missing planned paths reported, not necessarily failures). Requires task status GO and nonblank owner_go_ref; operator must independently confirm actual owner authorization. It does not apply patch or execute tests. `state`: validates migration state structure and prints next action, does not grant permission. No wildcard paths, zip extraction, shell or network. Run full independent replay and tests separately. Archive path names must be safe; limits are 100k members and 1 GiB uncompressed. No claim universal security boundary or tamper-proof authorization.

Native template: SessionStart provides short state + reminders; PreCompact and Stop warn to save checkpoint. Hooks do not change code, send data, auto-approve, retry endlessly or schedule new turns. They are advisory. The enforceable checkpoint comparison is `gate.py diff`, run explicitly. On mismatch stop, report and obtain new GO. Source docs: https://learn.chatgpt.com/docs/hooks ; repo-local skills https://developers.openai.com/blog/skills-agents-sdk .
