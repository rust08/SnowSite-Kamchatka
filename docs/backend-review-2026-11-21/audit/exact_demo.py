"""Independent reference for fixed configurations; not a production solver.
Python + scipy 1.17.0 used in audit. Run python audit/exact_demo.py [matrix.json].
"""
import json, sys, pathlib
import numpy as np
from scipy.optimize import milp, Bounds, LinearConstraint
p=json.loads(pathlib.Path(sys.argv[1] if len(sys.argv)>1 else pathlib.Path(__file__).with_name('demo_costs.json')).read_text(encoding='utf-8'))
s=p['s']; d=s['demands']; sites=s['sites']; c=p['pairs']
Q=min(s['truck']['bodyM3'],s['truck']['payloadKg']//s['snowDensityKgM3']); out=[]
for ids in [[0,1],[0,1,2],[0,1,3],[0,1,2,3]]:
    pairs=[(i,j) for i in range(len(d)) for j in ids if c[i][j] is not None]; n=len(pairs); N=2*n+len(d)
    lo=np.zeros(N); hi=np.full(N,np.inf); cost=np.zeros(N); ww=[]; lb=[]; ub=[]
    def row(v,l,u):
        a=np.zeros(N)
        for k,x in v.items(): a[k]=x
        ww.append(a); lb.append(l); ub.append(u)
    for i,di in enumerate(d): row({**{k:1 for k,(a,b) in enumerate(pairs) if a==i},2*n+i:1},di['volumeM3'],di['volumeM3'])
    for j in ids: row({k:1 for k,(a,b) in enumerate(pairs) if b==j},0,sites[j]['capacityM3'])
    for k,(i,j) in enumerate(pairs):
        row({k:1,n+k:-Q},-np.inf,0); row({k:1,n+k:-Q},1-Q,np.inf)
        hi[k]=min(d[i]['volumeM3'],sites[j]['capacityM3']); hi[n+k]=int(np.ceil(hi[k]/Q)); cost[n+k]=round(c[i][j]*1e6)
    for i,di in enumerate(d): hi[2*n+i]=di['volumeM3']
    obj=np.zeros(N); obj[2*n:]=1
    def solve(obj):
        return milp(obj,integrality=np.ones(N),bounds=Bounds(lo,hi),constraints=LinearConstraint(np.array(ww),lb,ub),options={'time_limit':10,'mip_rel_gap':0})
    a=solve(obj); assert a.status==0,a.message; u=round(a.fun); row({2*n+i:1 for i in range(len(d))},u,u); b=solve(cost); assert b.status==0,b.message
    alloc=[{'demand':d[i]['id'],'site':sites[j]['id'],'m3':round(b.x[k]),'trips':round(b.x[n+k])} for k,(i,j) in enumerate(pairs) if b.x[k]>0.5]
    out.append({'sites':[sites[j]['id'] for j in ids],'unservedM3':u,'transportKm':b.fun/1e6,'trips':sum(x['trips'] for x in alloc),'status':b.message,'allocation':alloc})
print(json.dumps(out,indent=2,ensure_ascii=False))
