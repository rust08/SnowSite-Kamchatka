// Compatibility entrypoint; implementation lives in apps/api.
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {launchServer} from '../apps/api/server.mjs';
export {startServer,launchServer} from '../apps/api/server.mjs';
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))launchServer();
