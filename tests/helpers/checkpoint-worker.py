"""Protocol fixture only: deterministic hard timeout after phase proofs."""
import json
import sys
import time

for line in sys.stdin:
    req = json.loads(line)
    mode = req.get('fixture', 'timeout')
    u = {'name': 'unservedM3', 'status': 'optimal', 'value': 0, 'bound': 0, 'gap': 0}
    d = {'name': 'transportDistanceMm', 'status': 'optimal', 'value': 6, 'bound': 6, 'gap': 0}
    def pending(name):
        return {'name': name, 'status': 'time_limit', 'value': None, 'bound': None, 'gap': None}
    result = {'status': 'time_limit', 'allocations': [[0,0,3,2]], 'selected': [0], 'stages': [u,pending('transportDistanceMm')], 'version':'fixture', 'timeMs':1}
    if mode != 'silent':
        if mode == 'malformed':
            result['status'] = 'optimal'
        print(json.dumps({'checkpoint': result}),flush=True)
    if mode == 'final':
        result.update(status='optimal',stages=[u,d])
        print(json.dumps(result),flush=True)
        continue
    if mode == 'two':
        result['stages'] = [u,d,pending('configurationTie')]
        print(json.dumps({'checkpoint':result}),flush=True)
    time.sleep(10)
