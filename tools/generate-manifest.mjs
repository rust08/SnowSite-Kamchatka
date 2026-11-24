// Run after staging all intended release files. Hash the actual working-tree bytes.
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('..',import.meta.url));
const names=execFileSync('git',['ls-files','-z'],{cwd:root,encoding:'utf8'}).split('\0').filter(p=>p&&p!=='MANIFEST.sha256').sort();
if(!names.length||names.some(p=>/[\r\n\\]/.test(p)))throw Error('Unexpected tracked path');
const rows=names.map(p=>createHash('sha256').update(readFileSync(resolve(root,p))).digest('hex')+'  '+p);
writeFileSync(resolve(root,'MANIFEST.sha256'),rows.join('\n')+'\n');console.log(`Generated ${rows.length} entries`);
