"""Isolated A1 schema check; does not touch the existing six-schema gate."""
import copy
import json
from pathlib import Path
from jsonschema import Draft202012Validator

ROOT = Path(__file__).resolve().parents[1]
SCHEMA = json.loads((ROOT / 'packages/haul-evidence/haul-evidence.synthetic.v0.1.schema.json').read_text())
Draft202012Validator.check_schema(SCHEMA)
envelope = Draft202012Validator(SCHEMA)
record = Draft202012Validator({'$schema': SCHEMA['$schema'], '$defs': SCHEMA['$defs'], '$ref': '#/$defs/record'})
checks = 0

def check(validator, value, valid, label):
    global checks
    errors = list(validator.iter_errors(value))
    if bool(errors) == valid:
        raise AssertionError(f'{label}: expected valid={valid}, errors={errors}')
    checks += 1
    print(f'PASS {label}')

fixtures = ROOT / 'tests/fixtures/haul-evidence'
for side in ('carrier', 'receiver'):
    data = json.loads((fixtures / f'{side}.json').read_text())
    check(envelope, data, True, side + ' envelope')
    for i, row in enumerate(data['records'], 1):
        check(record, row, not (side == 'carrier' and i == 15), f'{side} row {i}')
base = json.loads((fixtures / 'carrier.json').read_text())
row = base['records'][0]
for value in (None, [], 1, 'text', False, {}, {'receivedAt': 'bad'}):
    check(envelope, dict(base, records=[value]), True, f'envelope permits bad row {value!r}')
    check(record, value, False, f'record rejects {value!r}')
for field, value in [('quantity','0'),('quantity','999999999.999'),('quantity','12.000'),('revision',1.0),('ticket','😀'*128),('ticket','a/b|"'),('ticket','__proto__'),('receivedAt','0001-01-01T00:00:00.1Z')]:
    check(record, dict(row, **{field:value}), True, f'valid {field} {value!r}')
for field,value in [('quantity','1\n'),('quantity','01'),('quantity','1e0'),('quantity','-1'),('quantity','1.0000'),('quantity','1000000000'),('quantity',0),('quantity',None),('revision','1'),('revision',0),('revision',1.1),('revision',10001),('unit','kg'),('basis','actual'),('ticket',' a'),('ticket','a\uFEFF'),('ticket','\ud800'),('ticket','😀'*129),('eventAt','0000-01-01T00:00:00Z'),('eventAt','2026-01-01T24:00:00Z'),('eventAt','2026-01-01T00:00:00Z\n'),('eventAt','2026-01-01'),('eventAt','2026-01-01T00:00:00+00:00')]:
    check(record, dict(row, **{field:value}), False, f'invalid {field} {value!r}')
check(record, dict(row, action='cancel', quantity=None), True, 'null cancel')
check(record, dict(row, action='cancel', quantity='0'), False, 'non-null cancel')
check(record, dict(row, unknown=1), False, 'unknown record field')
missing = dict(row); del missing['quantity']
check(record, missing, False, 'missing quantity')
for field,value in [('schemaVersion','other'),('mode','real'),('source','other'),('datasetId',''),('scopeId',' a'),('records',None),('records',[None]*5001)]:
    check(envelope, dict(base, **{field:value}), False, f'invalid envelope {field}')
check(envelope, dict(base, records=[]), True, 'empty envelope')
check(envelope, dict(base, extra=True), False, 'unknown envelope field')
missing = copy.copy(base); del missing['source']
check(envelope, missing, False, 'missing source')
print(f'1 isolated schema; {checks} instance checks PASS (calendar and history runtime only)')
