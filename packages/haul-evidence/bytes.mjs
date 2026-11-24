import {HaulEvidenceInputError} from './validate.mjs';

const MAX_BYTES=2097152;
const fail=code=>{throw new HaulEvidenceInputError(code);};
const typedArray=Object.getPrototypeOf(Uint8Array.prototype);
const get=(prototype,key)=>Object.getOwnPropertyDescriptor(prototype,key).get;
const tag=get(typedArray,Symbol.toStringTag), bufferOf=get(typedArray,'buffer');
const lengthOf=get(typedArray,'byteLength'), offsetOf=get(typedArray,'byteOffset');
const arrayBufferLength=get(ArrayBuffer.prototype,'byteLength');

// Intrinsic brand checks ignore spoofed properties, accept Buffer and cross-realm
// Uint8Array, reject proxies, shared buffers, detached or out-of-bounds views.
function checkedView(input) {
  let view;
  try {
    if(tag.call(input)!=='Uint8Array') throw new TypeError();
    const buffer=bufferOf.call(input);
    arrayBufferLength.call(buffer); // Reject SharedArrayBuffer.
    // ValidateTypedArray also detects an out-of-bounds resizable-buffer view.
    Uint8Array.prototype.values.call(input);
    view={buffer,offset:offsetOf.call(input),length:lengthOf.call(input)};
  } catch {fail('invalid_bytes');}
  if(view.length>MAX_BYTES) fail('byte_limit');
  return view;
}
export function snapshotEvidenceBytes(first,second) {
  const views=[checkedView(first),checkedView(second)];
  return views.map(({buffer,offset,length})=>{
    try {return new Uint8Array(new Uint8Array(buffer,offset,length));}
    catch {return fail('invalid_bytes');}
  });
}
export function decodeEvidenceBytes(bytes) {
  if(bytes[0]===0xef&&bytes[1]===0xbb&&bytes[2]===0xbf) fail('utf8_bom');
  try {return new TextDecoder('utf-8',{fatal:true,ignoreBOM:true}).decode(bytes);}
  catch {return fail('invalid_utf8');}
}
export async function sha256EvidenceBytes(bytes) {
  const provider=globalThis.crypto;
  if(typeof provider?.subtle?.digest!=='function') fail('crypto_unavailable');
  try {
    const digest=await provider.subtle.digest('SHA-256',bytes);
    return Array.from(new Uint8Array(digest),n=>n.toString(16).padStart(2,'0')).join('');
  } catch {return fail('crypto_failure');}
}
