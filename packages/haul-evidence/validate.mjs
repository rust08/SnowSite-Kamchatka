// Parsed-object boundary only. Raw JSON syntax, bytes and hashes belong to A2.
const envelopeFields = ['schemaVersion','mode','source','datasetId','scopeId','periodStart','periodEnd','records'];
const rowFields = ['namespace','series','ticket','revision','action','eventAt','receivedAt','contract','site','unit','basis','quantity'];
export const schemaVersion = 'haul-evidence.synthetic.v0.1';
export const isObject = value => value !== null && typeof value === 'object' && !Array.isArray(value);
export const own = (object, field) => isObject(object) && Object.hasOwn(object, field) ? object[field] : undefined;
const full = (pattern, value) => typeof value === 'string' && pattern.exec(value)?.[0] === value;

export class HaulEvidenceInputError extends Error {
  constructor(code, side = null, field = null) {
    super(code);
    this.name = 'HaulEvidenceInputError';
    this.code = code;
    this.side = side;
    this.field = field;
  }
}

export function validId(value) {
  if (typeof value !== 'string' || value.length === 0 || value.length > 256 || value.trim() !== value) return false;
  const points = [...value];
  return points.length <= 128 && points.every(c => { const n = c.codePointAt(0); return n < 0xD800 || n > 0xDFFF; });
}

// Date parsing is not calendar validation. Validate every field first, including years 0001–0099.
export function parseTimestamp(value) {
  if (typeof value !== 'string' || value.length > 24) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,3}))?Z$/.exec(value);
  if (!m || m[0] !== value) return null;
  const [year,month,day,hour,minute,second] = m.slice(1,7).map(Number);
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const days = [31,leap ? 29 : 28,31,30,31,30,31,31,30,31,30,31];
  if (year === 0 || month < 1 || month > 12 || day < 1 || day > days[month-1] || hour > 23 || minute > 59 || second > 59) return null;
  const ms = Number((m[7] ?? '').padEnd(3,'0'));
  const date = new Date(0);
  date.setUTCFullYear(year,month-1,day);
  date.setUTCHours(hour,minute,second,ms);
  return {instant:date.getTime(), text:date.toISOString().replace(/\.000Z$/,'Z')};
}

export function parseQuantity(value) {
  if (!full(/^(0|[1-9][0-9]{0,8})(\.[0-9]{1,3})?$/,value)) return null;
  const [integer,fraction = ''] = value.split('.');
  return BigInt(integer)*1000n + BigInt(fraction.padEnd(3,'0'));
}

export function formatQuantity(value) {
  if (value === null) return null;
  const abs = value < 0n ? -value : value;
  const fraction = (abs%1000n).toString().padStart(3,'0').replace(/0+$/,'');
  return `${value < 0n ? '-' : ''}${abs/1000n}${fraction ? '.'+fraction : ''}`;
}

export function compareText(a,b) {
  const aa = [...a], bb = [...b];
  for (let i=0; i<Math.min(aa.length,bb.length); i++) {
    const diff = aa[i].codePointAt(0)-bb[i].codePointAt(0);
    if (diff) return diff;
  }
  return aa.length-bb.length;
}
export function compareTuple(a,b) {
  for (let i=0; i<Math.min(a.length,b.length); i++) {
    const diff = compareText(a[i],b[i]);
    if (diff) return diff;
  }
  return a.length-b.length;
}
export const tupleId = tuple => JSON.stringify(tuple);
export const extractKey = row => {
  const key = ['namespace','series','ticket'].map(field => own(row,field));
  return key.every(validId) ? key : null;
};
export const reason = (code,side,rowIndices,extra = {}) => ({code,side,rowIndices:[...rowIndices].sort((a,b)=>a-b),...extra});
export function sortReasons(reasons) {
  return reasons.sort((a,b)=>compareTuple([a.code,a.side??'',a.field??''],[b.code,b.side??'',b.field??'']) || (a.revision??0)-(b.revision??0) || compareIndices(a.rowIndices,b.rowIndices));
}
function compareIndices(a,b) {
  for (let i=0;i<Math.min(a.length,b.length);i++) if (a[i]!==b[i]) return a[i]-b[i];
  return a.length-b.length;
}

export function validateEnvelope(input) {
  const side = ['carrier','receiver'].includes(own(input,'source')) ? own(input,'source') : null;
  const fail = field => { throw new HaulEvidenceInputError('invalid_envelope',side,field); };
  if (!isObject(input) || Object.keys(input).some(k=>!envelopeFields.includes(k))) fail(null);
  for (const field of envelopeFields) if (!Object.hasOwn(input,field)) fail(field);
  if (input.schemaVersion !== schemaVersion) fail('schemaVersion');
  if (input.mode !== 'synthetic') fail('mode');
  if (side === null) fail('source');
  for (const field of ['datasetId','scopeId']) if (!validId(input[field])) fail(field);
  const start = parseTimestamp(input.periodStart), end = parseTimestamp(input.periodEnd);
  if (!start) fail('periodStart');
  if (!end || start.instant >= end.instant) fail('periodEnd');
  if (!Array.isArray(input.records) || input.records.length > 5000) fail('records');
  return {source:side,datasetId:input.datasetId,scopeId:input.scopeId,start,end,records:input.records};
}

export function validateRow(row, key, receipt, side, index) {
  const reasons = [];
  const add = (code,extra) => reasons.push(reason(code,side,[index],extra));
  if (!key) add('invalid_identity');
  if (Object.keys(row).some(k=>!rowFields.includes(k))) add('unknown_field');
  const revision = own(row,'revision'), action = own(row,'action');
  const event = parseTimestamp(own(row,'eventAt'));
  const quantity = own(row,'quantity');
  const milli = parseQuantity(quantity);
  const fields = {
    revision:Number.isSafeInteger(revision)&&revision>=1&&revision<=10000,
    action:['issue','correct','cancel'].includes(action),
    eventAt:event!==null,
    contract:validId(own(row,'contract')),site:validId(own(row,'site')),
    unit:own(row,'unit')==='m3',basis:own(row,'basis')==='nominal',
    quantity:action==='cancel'?quantity===null:milli!==null
  };
  for (const [field,valid] of Object.entries(fields)) if (!valid) add('invalid_field',{field});
  if (event && receipt.instant<event.instant) add('receipt_before_event');
  if (reasons.length) return {reasons};
  return {reasons,record:{revision,action,event,receipt,scope:['contract','site','unit','basis'].map(k=>own(row,k)),quantity:milli,index}};
}
