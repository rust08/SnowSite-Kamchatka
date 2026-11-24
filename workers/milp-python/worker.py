"""Local JSON-lines fixed allocation and unified site selection worker. No file/network access from input.
Each request is already validated by Node. Lexicographic MILP stages, sparse constraints.
"""
import json
import sys
import time
import math
import numpy as np
import scipy
from scipy.optimize import milp, Bounds, LinearConstraint
from scipy.sparse import coo_matrix


def solve(req, publish=None):
    start = time.monotonic()
    d, c, costs, q = (req[k] for k in ('demands', 'capacities', 'costs', 'q'))
    limit = req['timeLimitMs'] / 1000
    pairs = [(i,j) for i in range(len(d)) for j in range(len(c))
             if costs[i][j] is not None and d[i] and c[j]]
    p = len(pairs)
    selection = req.get('selection')
    z_start = 2*p+len(d)
    size = z_start + (len(c) if selection is not None else 0)
    hi = np.zeros(size)
    lower = np.zeros(size)
    distance = np.zeros(size)
    u_obj = np.zeros(size)
    u_obj[2*p:z_start] = 1
    hi[2*p:z_start] = 0 if selection is not None and selection['requireAllServed'] else d
    if selection is not None:
        hi[z_start:] = 1
        for j in selection['fixed']:
            lower[z_start+j] = 1
        for j in selection['excluded']:
            hi[z_start+j] = 0
    rr, cc, vv, lo, up = [], [], [], [], []

    def row(entries, lower, upper):
        for k,v in entries:
            rr.append(len(lo)); cc.append(k); vv.append(v)
        lo.append(lower); up.append(upper)

    for i, volume in enumerate(d):
        row([(k,1) for k,(a,b) in enumerate(pairs) if a==i]+[(2*p+i,1)],volume,volume)
    for j, capacity in enumerate(c):
        entries = [(k,1) for k,(a,b) in enumerate(pairs) if b==j]
        if selection is None:
            row(entries,0,capacity)
        else:
            row(entries+[(z_start+j,-capacity)],-np.inf,0)
        trip_limit = req.get('tripLimits', [None]*len(c))[j]
        if trip_limit is not None:
            entries = [(p+k,1) for k,(a,b) in enumerate(pairs) if b==j]
            if selection is None:
                row(entries,0,trip_limit)
            else:
                row(entries+[(z_start+j,-trip_limit)],-np.inf,0)
    for k,(i,j) in enumerate(pairs):
        hi[k] = min(d[i], c[j]); hi[p+k] = math.ceil(hi[k]/q)
        distance[p+k] = costs[i][j]
        row([(k,1),(p+k,-q)],1-q,0)


    if selection is not None:
        for rule in selection['cardinalities']:
            row([(z_start+j,1) for j in rule['indices']],rule['lower'],rule['upper'])
        # Exact-set no-good cut. Neither supersets nor subsets are excluded.
        for cut in selection['excludedSets']:
            selected = set(cut)
            row([(z_start+j,1 if j in selected else -1) for j in range(len(c))],
                -np.inf,len(selected)-1)

    # Exact common divisor reduces numerical scale without rounding a distance.
    # Report distance objective and dual bounds in original millimetres.
    distance_scale = (math.gcd(*(int(distance[p+k]) for k in range(p))) or 1) if selection is not None or req.get("sourceTripCuts") else 1
    distance /= distance_scale
    stages = []
    def stage(name, objective, scale=1):
        remaining = limit - (time.monotonic()-start)
        if remaining <= 0:
            stages.append({'name':name,'status':'time_limit','bound':None,'value':None,'gap':None})
            return None
        mat = coo_matrix((vv,(rr,cc)),shape=(len(lo),size)).tocsc()
        r = milp(objective, integrality=np.ones(size), bounds=Bounds(lower,hi),
                 constraints=LinearConstraint(mat,lo,up),
                 options={'time_limit':remaining,'mip_rel_gap':0.0})
        finite = lambda x: float(x) if x is not None and np.isfinite(x) else None
        value = finite(None if r.fun is None else r.fun*scale)
        if req.get('sourceTripCuts') and name == 'transportDistanceMm' and r.fun is not None:
            # The native scaled objective is integral. Canonicalize native
            # floating-point roundoff BEFORE multiplying back to millimetres.
            # Reject genuine numerical discrepancies, and leave the raw dual
            # bound intact. Node still independently recomputes exact mm.
            native = round(r.fun)
            if abs(r.fun-native) > 1e-5:
                raise RuntimeError('Non-integral scaled distance objective')
            value = native * scale
        stages.append({'name':name,'status':{0:'optimal',1:'time_limit',2:'infeasible'}.get(r.status,'error'),
                       'bound':finite(None if getattr(r,'mip_dual_bound',None) is None else r.mip_dual_bound*scale), 'value':value,
                       'gap':finite(getattr(r,'mip_gap',None))})
        if r.status not in ((0,1,2) if selection is not None else (0,1)):
            raise RuntimeError(str(r.message))
        return r

    def result(incumbent, status, reported_stages):
        allocations = None
        if incumbent is not None:
            if np.max(np.abs(incumbent-np.rint(incumbent)))>1e-5:
                raise RuntimeError('Non-integral solver incumbent')
            allocations = [[i,j,round(incumbent[k]),round(incumbent[p+k])] for k,(i,j) in enumerate(pairs) if round(incumbent[k])>0]
        selected = None if incumbent is None or selection is None else [j for j in range(len(c)) if round(incumbent[z_start+j]) == 1]
        return {'status':status,'allocations':allocations,'selected':selected,'stages':list(reported_stages),
                'version':scipy.__version__,'timeMs':round((time.monotonic()-start)*1000,3)}

    def checkpoint(incumbent, next_stage):
        # A completed phase is not a proof of the next one. Node independently
        # checks the returned allocation even when the hard deadline kills us.
        if publish is not None and incumbent is not None:
            publish(result(incumbent,'time_limit',stages+[
                {'name':next_stage,'status':'time_limit','bound':None,'value':None,'gap':None}]))

    a = stage('unservedM3',u_obj)
    incumbent = None if a is None else a.x
    status = 'infeasible' if a is not None and a.status == 2 else 'time_limit'
    if a is not None and a.status == 0:
        u = round(a.fun)
        checkpoint(incumbent,'transportDistanceMm')
        row([(2*p+i,1) for i in range(len(d))],u,u)
        # Valid integer-cover cuts once full service is proved. No change to
        # feasible integer solutions; eliminate fractional trips at each source.
        if req.get('sourceTripCuts') and u == 0:
            for i, volume in enumerate(d):
                if volume:
                    row([(p+k,1) for k,(a,b) in enumerate(pairs) if a==i],math.ceil(volume/q),np.inf)
        b = stage('transportDistanceMm',distance,distance_scale)
        if b is not None and b.x is not None:
            incumbent = b.x
        if b is not None and b.status == 2:
            raise RuntimeError('Distance phase infeasible after proven first phase')
        if b is not None and b.status == 0:
            if selection is None:
                status = 'optimal'
            else:
                # Only after U and L are proven: stable lexicographic configuration ID.
                # <=30 binary sites => weights exactly representable (<= 2**29).
                checkpoint(incumbent,'configurationTie')
                row([(p+k,int(distance[p+k])) for k in range(p) if distance[p+k]],round(b.fun),round(b.fun))
                tie = np.zeros(size)
                for i,j in enumerate(selection['tieOrder']):
                    tie[z_start+j] = -(1 << (len(c)-1-i))
                t = stage('configurationTie',tie)
                if t is not None and t.status == 2:
                    raise RuntimeError('Tie phase infeasible after proven distance phase')
                if t is not None and t.x is not None:
                    incumbent = t.x
                if t is not None and t.status == 0:
                    status = 'optimal'
    return result(incumbent,status,stages)


if __name__ == '__main__':
    for line in sys.stdin:
        try:
            print(json.dumps(solve(json.loads(line), lambda value: print(json.dumps({'checkpoint':value}, allow_nan=False), flush=True)), allow_nan=False), flush=True)
        except Exception as e:
            print(json.dumps({'status':'error','message':str(e)}), flush=True)
