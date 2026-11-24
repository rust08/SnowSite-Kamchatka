import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
// Transport helper only. Core gets already loaded data; never accepts a request path.
export function loadNetwork(path,id='pkgo'){
 const raw=readFileSync(path),network=JSON.parse(raw.toString('utf8'));
 return {network,networkMeta:{id,version:network.version,hash:createHash('sha256').update(raw).digest('hex')}};
}
