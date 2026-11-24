// Stable public library exports; keep API names unchanged across internal moves.
export {optimize} from './optimize.mjs';
export {safeRequest,exclusionRerun,inputFingerprint} from '../contracts/request.mjs';
export {DomainError} from '../contracts/validate.mjs';
