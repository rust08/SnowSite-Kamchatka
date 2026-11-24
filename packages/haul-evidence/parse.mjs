import {HaulEvidenceInputError} from './validate.mjs';

const fail = code => { throw new HaulEvidenceInputError(code); };
const digit = c => c >= '0' && c <= '9';
const hex = c => digit(c) || (c >= 'a' && c <= 'f') || (c >= 'A' && c <= 'F');

// Grammar has already been checked. Saturate exponent beyond token length:
// no possible exact in-range integer can be recovered beyond this bound.
function exactRevision(token) {
  if (token[0] === '-') return null;
  const e = token.search(/[eE]/);
  const mantissa = e < 0 ? token : token.slice(0,e);
  const dot = mantissa.indexOf('.');
  const fractionLength = dot < 0 ? 0 : mantissa.length-dot-1;
  const digits = mantissa.replace('.','');
  let first=0, end=digits.length;
  while (first<end && digits[first]==='0') first++;
  if (first===end) return null;
  while (digits[end-1]==='0') end--;
  let exponent=0;
  if (e>=0) {
    let i=e+1;
    const negative=token[i]==='-';
    if (negative || token[i]==='+') i++;
    const cap=token.length+10;
    for (;i<token.length;i++) exponent=Math.min(cap,exponent*10+Number(token[i]));
    if (negative) exponent=-exponent;
  }
  const zeros=exponent-fractionLength+digits.length-end;
  const significantLength=end-first;
  if (zeros<0 || significantLength+zeros>5) return null;
  const value=Number(digits.slice(first,end))*10**zeros;
  return value>=1 && value<=10000 ? value : null;
}

// Bounded recursive descent (max 32 containers); disjoint token scans.
// JSON.parse is used only for a single already-scanned string token, to decode
// escapes exactly as ECMAScript does (including surrogate pairs).
export function parseEvidenceJson(text) {
  let i=0;
  const syntax=()=>fail('invalid_json');
  const whitespace=()=>{while(text[i]===' '||text[i]==='\t'||text[i]==='\r'||text[i]==='\n') i++;};
  function string() {
    const start=i++;
    while(i<text.length) {
      const c=text[i++];
      if(c==='"') return JSON.parse(text.slice(start,i));
      if(c.charCodeAt(0)<32) syntax();
      if(c==='\\') {
        const escape=text[i++];
        if(escape==='u') {
          for(let j=0;j<4;j++) if(!hex(text[i++])) syntax();
        } else if(escape===undefined || !'"\\/bfnrt'.includes(escape)) syntax();
      }
    }
    syntax();
  }
  function number(revision) {
    const start=i;
    if(text[i]==='-') i++;
    if(text[i]==='0') i++;
    else {
      if(!digit(text[i])) syntax();
      while(digit(text[i])) i++;
    }
    if(text[i]==='.') {
      i++;
      if(!digit(text[i])) syntax();
      while(digit(text[i])) i++;
    }
    if(text[i]==='e'||text[i]==='E') {
      i++;
      if(text[i]==='+'||text[i]==='-') i++;
      if(!digit(text[i])) syntax();
      while(digit(text[i])) i++;
    }
    const token=text.slice(start,i);
    return revision ? exactRevision(token) : Number(token);
  }
  // Role tags follow only root.records -> direct array item -> revision.
  function value(depth, role='other') {
    whitespace();
    const c=text[i];
    if(c==='{'||c==='[') {
      if(depth===32) fail('depth_limit');
      i++;
      whitespace();
      if(c==='{') {
        const result=Object.create(null), seen=new Set();
        if(text[i]==='}') {i++;return result;}
        while(true) {
          if(text[i]!=='"') syntax();
          const key=string();
          if(seen.has(key)) fail('duplicate_member');
          seen.add(key);
          whitespace();
          if(text[i++]!==':') syntax();
          const child=role==='root'&&key==='records'?'records':role==='row'&&key==='revision'?'revision':'other';
          result[key]=value(depth+1,child);
          whitespace();
          const delimiter=text[i++];
          if(delimiter==='}') return result;
          if(delimiter!==',') syntax();
          whitespace();
        }
      }
      const result=[];
      if(text[i]===']') {i++;return result;}
      while(true) {
        result.push(value(depth+1,role==='records'?'row':'other'));
        whitespace();
        const delimiter=text[i++];
        if(delimiter===']') return result;
        if(delimiter!==',') syntax();
      }
    }
    if(c==='"') return string();
    if(c==='-'||digit(c)) return number(role==='revision');
    for(const [literal,v] of [['true',true],['false',false],['null',null]]) {
      if(text.startsWith(literal,i)) {i+=literal.length;return v;}
    }
    syntax();
  }
  const parsed=value(0,'root');
  whitespace();
  if(i!==text.length) syntax();
  return parsed;
}
