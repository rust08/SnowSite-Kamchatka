import {readFileSync} from 'node:fs';import {importLeads,parseLeadCsv} from '../src/core/site-catalog.mjs';
try{
 const [file,evidenceFile]=process.argv.slice(2);if(!file||!evidenceFile)throw Error('Usage: node tools/import-site-leads.mjs LEADS.json|csv EVIDENCE.json (dry-run, stdout only)');
 const raw=readFileSync(file,'utf8');if(Buffer.byteLength(raw)>2*1024*1024)throw Error('Input size limit');
 const leads=file.toLowerCase().endsWith('.csv')?parseLeadCsv(raw):JSON.parse(raw).sites;
 const result=importLeads(leads,JSON.parse(readFileSync(evidenceFile,'utf8')));console.log(JSON.stringify(result,null,2));if(result.report.rejected.length)process.exitCode=2;
}catch(e){console.error(e.message);process.exitCode=2;}
