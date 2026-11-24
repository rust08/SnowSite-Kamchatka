"""Advisory only. Never read transcripts or mutate state."""
import json, sys
from pathlib import Path
try:
    data=json.load(sys.stdin)
    state=json.loads((Path(__file__).resolve().parents[1]/'state/current.json').read_text(encoding='utf-8'))
    event=data.get('hook_event_name')
    msg=f"Snow Control: {state['phase']}; active={state['active_task']}; authorized={state['implementation_authorized']}. Read START_HERE and actual owner GO."
    if event in ('PreCompact','Stop'):
        msg+=' Save checkpoint, actual logs and STOP or next scope; do not auto-advance.'
    if event=='SessionStart':
        print(json.dumps({'hookSpecificOutput':{'hookEventName':'SessionStart','additionalContext':msg}}))
    else:
        print(json.dumps({'systemMessage':msg}))
except Exception:
    print(json.dumps({'systemMessage':'Snow Control state unavailable; restore explicitly; no inferred GO.'}))
