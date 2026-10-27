import {candidateRoutes} from './feature-candidates.mjs';
import {socialRoutes} from './feature-social.mjs';
import {accountRoutes} from './feature-accounts.mjs';
import {startMailWorker} from './feature-service.mjs';
import {infoRoutes} from './feature-info.mjs';
import {passkeyRoutes} from './feature-passkeys.mjs';
import {privacyRoutes} from './feature-privacy.mjs';

export async function extraRoute(req,url,method,api) {
 if(await candidateRoutes(req,url,method,api))return true;
 if(await socialRoutes(req,url,method,api))return true;
 if(await accountRoutes(req,url,method,api))return true;
 if(await infoRoutes(req,url,method,api))return true;
 if(await passkeyRoutes(req,url,method,api))return true;
 if(await privacyRoutes(req,url,method,api))return true;
 return false;
}
export {startMailWorker};
