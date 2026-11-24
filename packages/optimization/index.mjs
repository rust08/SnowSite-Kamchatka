// Pure application entrypoints (no HTTP, browser or filesystem dataset selection).
export {optimize} from './optimize.mjs';
export {verifyAllocation,verifyConfiguration,verifySolution} from './verify-result.mjs';
export {compareSites} from './legacy.mjs';
