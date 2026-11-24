"""Read-only archive/manifest/scope checkpoints; no shell execution or extraction."""
import argparse, hashlib, json, re, stat, sys, zipfile
from pathlib import Path, PurePosixPath
ROOT=Path(__file__).resolve().parents[1]
HEX=re.compile(r'[a-f0-9]{64}')
def need(ok,msg):
    if not ok: raise ValueError(msg)
def sha_file(path):
    with open(path,'rb') as f: return hashlib.file_digest(f,'sha256').hexdigest()
def load(path): return json.loads(Path(path).read_text(encoding='utf-8'))
def safe(name):
    need(isinstance(name,str) and name and '\\' not in name and ':' not in name and not any(ord(c)<32 or c in '*?[]' for c in name) and not name.startswith('/'),f'unsafe path: {name!r}')
    need(all(p not in ('','.','..') for p in name.split('/')),f'unsafe path: {name!r}')
    return name

def inventory(path, product=False):
    with zipfile.ZipFile(path) as z:
        infos=z.infolist(); need(len(infos)<=100000 and sum(x.file_size for x in infos)<=1024**3,'archive limits')
        seen=set(); names={}; folds=set()
        for x in infos:
            n=safe(x.filename.rstrip('/') if x.is_dir() else x.filename)
            need(n not in seen and n.casefold() not in folds,'duplicate/case collision: '+n); seen.add(n); folds.add(n.casefold())
            mode=x.external_attr>>16; kind=stat.S_IFMT(mode)
            need(kind in (0,stat.S_IFREG,stat.S_IFDIR) and (kind!=stat.S_IFDIR or x.is_dir()) and (kind!=stat.S_IFREG or not x.is_dir()),'nonregular member: '+n)
            if not x.is_dir(): names[n]=x
        for n in names:
            need(not any(str(p) in names for p in PurePosixPath(n).parents if str(p)!='.'),'file/directory collision')
        prefix='SnowSite-Kamchatka/' if product else ''
        if product: need(names and all(n.startswith(prefix) for n in names),'unexpected product root')
        inv={}
        for n,x in names.items():
            with z.open(x) as f: inv[n[len(prefix):]]=hashlib.file_digest(f,'sha256').hexdigest()
        manifest_member=prefix+'MANIFEST.sha256'
        manifest=z.read(manifest_member).decode('utf-8') if manifest_member in names else None
        return inv,manifest

def verify_manifest(inv,manifest):
    need(manifest is not None,'manifest missing'); expected={}
    for line in manifest.splitlines():
        m=re.fullmatch(r'([a-f0-9]{64}) [ *](.+)',line); need(m is not None,'bad manifest line')
        h,n=m.groups(); n=safe(n.removeprefix('./')); need(n not in expected,'duplicate manifest path'); expected[n]=h
    actual={n:h for n,h in inv.items() if n!='MANIFEST.sha256'}
    need(expected==actual,'manifest mismatch (membership or digest)'); return len(expected)

def check_base(path):
    state=load(ROOT/'state/current.json'); b=state['baseline']; need(sha_file(path)==b['sha256'],'baseline SHA mismatch')
    inv,m=inventory(path,True); need(inv==load(ROOT/'state/baseline-inventory.json'),'baseline inventory mismatch')
    return {'files':len(inv),'manifest':verify_manifest(inv,m),'sha256':b['sha256']}

def check_diff(base,candidate,task):
    t=load(task); need(t.get('schema')=='snowcontrol.task.v1' and t.get('status')=='GO' and isinstance(t.get('task_id'),str) and t['task_id'].strip() and isinstance(t.get('owner_go_ref'),str) and t['owner_go_ref'].strip(),'NO_GO: owner approval reference required')
    need(sha_file(base)==t.get('base_sha256'),'wrong task baseline')
    allow=t['allowed_changes']; need(isinstance(allow,dict),'bad allowlist')
    for p,action in allow.items(): safe(p); need(action in ('ADD','EDIT','DELETE'),'bad path action')
    a,_=inventory(base,True); b,_=inventory(candidate,True)
    diff={p:('ADD' if p not in a else 'DELETE' if p not in b else 'EDIT') for p in sorted(a.keys()|b.keys()) if a.get(p)!=b.get(p)}
    unexpected={p:v for p,v in diff.items() if allow.get(p)!=v}; need(not unexpected,'unauthorized diff: '+json.dumps(unexpected,ensure_ascii=False))
    return {'task':t['task_id'],'actual_changes':diff,'unused_allowlist':sorted(allow.keys()-diff.keys()),'candidate_sha256':sha_file(candidate),'authorization':'reference only; verify actual owner message'}

def main():
    p=argparse.ArgumentParser(); s=p.add_subparsers(dest='cmd',required=True)
    s.add_parser('state'); s.add_parser('base').add_argument('archive'); s.add_parser('pack').add_argument('archive'); d=s.add_parser('diff'); d.add_argument('base'); d.add_argument('candidate'); d.add_argument('task')
    args=p.parse_args()
    try:
        if args.cmd=='base': result=check_base(args.archive)
        elif args.cmd=='pack':
            i,m=inventory(args.archive); result={'files':len(i),'manifest':verify_manifest(i,m),'sha256':sha_file(args.archive)}
        elif args.cmd=='diff': result=check_diff(args.base,args.candidate,args.task)
        else:
            t=load(ROOT/'state/task.json'); r=load(ROOT/'state/current.json'); need(r['schema']=='snowcontrol.agent-state.v1' and t['schema']=='snowcontrol.task.v1','state schema'); need(r['active_task']==t['task_id'] and r['implementation_authorized']==(t['status']=='GO') and r['baseline']['sha256']==t['base_sha256'],'state/task conflict'); result={'phase':r['phase'],'task':t['status'],'next':r['next'],'authorization':'actual owner message required'}
        print(json.dumps({'status':'PASS','result':result},ensure_ascii=False,indent=2)); return 0
    except (ValueError,KeyError,TypeError,OSError,zipfile.BadZipFile,RuntimeError) as e:
        print(json.dumps({'status':'FAIL','reason':str(e)},ensure_ascii=False),file=sys.stderr); return 1
if __name__=='__main__': raise SystemExit(main())
