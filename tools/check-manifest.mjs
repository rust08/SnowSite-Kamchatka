// Verify release bytes, independent of git (also works after extracting ZIP).
import {readFileSync,statSync,realpathSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {resolve,relative,isAbsolute,sep} from 'node:path';
const root=fileURLToPath(new URL('..',import.meta.url));
const inside=(base,file)=>{const r=relative(base,file);return r!==''&&r!=='..'&&!r.startsWith('..'+sep)&&!isAbsolute(r);};
const manifest=readFileSync(resolve(root,'MANIFEST.sha256'),'utf8').trimEnd().split(/\r?\n/);
const seen=new Set();let count=0;
for(const line of manifest){
 const m=/^([a-f0-9]{64})  (.+)$/.exec(line);if(!m)throw Error('Invalid manifest row: '+line);
 const [,expected,p]=m;const file=resolve(root,p);
 if(p==='MANIFEST.sha256'||p.includes('\\')||p.split('/').some(v=>v===''||v==='..'||v==='.'||v==='.git')||!inside(root,file)||seen.has(p)||!inside(realpathSync(root),realpathSync(file))||!statSync(file).isFile())throw Error('Unexpected manifest entry: '+p);
 seen.add(p);const actual=createHash('sha256').update(readFileSync(file)).digest('hex');if(actual!==expected)throw Error('SHA-256 mismatch: '+p);count++;
}
if(!count)throw Error('Empty manifest');
console.log(`PASS ${count} release files (SHA-256)`);
