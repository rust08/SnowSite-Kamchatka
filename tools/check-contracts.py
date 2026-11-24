"""Offline JSON Schema gate plus fresh CLI outputs; no external schema fetching."""
import copy
import json
import os
from pathlib import Path
import subprocess
import sys
from jsonschema import Draft202012Validator
from referencing import Registry

ROOT = Path(__file__).resolve().parent.parent
SCHEMAS = ROOT / 'packages/contracts/schemas'

def load(path):
    return json.loads((ROOT / path).read_text(encoding='utf-8'))

validators = {}
for schema_path in sorted(SCHEMAS.glob('*.schema.json')):
    schema = load(schema_path)
    Draft202012Validator.check_schema(schema)
    validators[schema_path.name] = Draft202012Validator(schema, registry=Registry())
    print('PASS schema', schema_path.name)
assert len(validators) == 6

count = 0

def check(schema, document, label):
    global count
    validators[schema].validate(document)
    count += 1
    print('PASS instance', label)

def reject(schema, document, label):
    global count
    if validators[schema].is_valid(document):
        raise AssertionError('Schema unexpectedly accepted ' + label)
    count += 1
    print('PASS reject', label)

request = 'optimize-request-v1.schema.json'
response = 'optimize-response-v1.schema.json'
for path in sorted((ROOT / 'examples').rglob('*.json')):
    obj = load(path)
    if isinstance(obj, dict) and 'scenario' in obj and 'policy' in obj:
        check(request, obj, path.relative_to(ROOT))
check(response, load('examples/demo-v1.result.json'), 'legacy v1 stored response')
check('scenario.schema.json', load('data/fixtures/scenario.demo.json'), 'legacy scenario')
check('network-registry-v1.schema.json', load('examples/v44/registry.json'), 'registry')
check('site-evidence-v1.schema.json', load('data/evidence/pkgo-history.json'), 'historical leads')
# Synthetic, unlocated and not an eligible optimizer site. Structural contract only.
record = dict(id='schema-fixture', sourceRefs=['synthetic-ref'], validFrom=None,
              validUntil=None, operationalStatus='unknown', geometryStatus='unlocated',
              location=None, accessNodeId=None, availableCapacityM3=None,
              snowTypes=['unknown'], screening={'status':'unknown'},
              accessVerification=None, capacityEvidence=None)
check('site-record-v1.schema.json', record, 'unlocated synthetic record')
invalid = copy.deepcopy(record)
invalid['availableCapacityM3'] = -1
reject('site-record-v1.schema.json', invalid, 'negative capacity')

# Fresh responses from legacy default and both opt-in strategies, on two graphs.
# Existing runtime/domain tests remain authoritative for cross-field semantics.
env = {**os.environ, 'SNOW_PYTHON': os.environ.get('SNOW_PYTHON', sys.executable)}
for fixture, flags, strategies in [
    ('examples/demo-v1.json', [], [None, 'bounded_enumeration']),
    ('examples/v43/add-2-plus-2.json', ['--network','examples/v43/network.json','--network-id','synthetic-v43'], ['unified_milp','bounded_enumeration']),
    ('examples/v49/map-api-2plus2.json', [], ['bounded_enumeration'])
]:
    for strategy in strategies:
        r = load(fixture)
        if strategy is not None:
            r['policy']['searchStrategy'] = strategy
        r['policy']['timeLimitMs'] = 30000  # contract gate, not performance benchmark
        check(request, r, f'{fixture} {strategy or "default"} request')
        proc = subprocess.run(['node','apps/cli/cli.mjs',*flags,'-'], cwd=ROOT,
                              input=json.dumps(r), encoding='utf-8', capture_output=True,
                              env=env, timeout=40)
        if proc.returncode:
            raise RuntimeError(f'CLI failed ({proc.returncode}): {proc.stderr}\n{proc.stdout}')
        result = json.loads(proc.stdout)
        check(response, result, f'{fixture} {strategy or "default"} live response')
        assert result['search']['rankingStatus'] == 'exact_top_k'
        if strategy == 'bounded_enumeration':
            bad = copy.deepcopy(result)
            bad['search']['prunedByBound'] = -1
            reject(response, bad, 'negative pruned counter')
invalid = load('examples/v47/demo-bounded.json')
invalid['policy']['searchStrategy'] = 'unsupported'
reject(request, invalid, 'unknown search strategy')
print(f'PASS {len(validators)} schema definitions and {count} instance checks')
