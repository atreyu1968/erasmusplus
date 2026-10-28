import {candidateRoutes} from './feature-candidates.mjs';
import {selectionRoutes} from './feature-selection.mjs';
import {agendaRoutes} from './feature-agenda.mjs';
import {dashboardRoutes} from './feature-dashboard.mjs';
import {socialRoutes} from './feature-social.mjs';
import {accountRoutes} from './feature-accounts.mjs';
import {startMailWorker} from './feature-service.mjs';
import {infoRoutes} from './feature-info.mjs';
import {passkeyRoutes} from './feature-passkeys.mjs';
import {privacyRoutes} from './feature-privacy.mjs';
import {editionRoutes} from './feature-editions.mjs';
import {landingRoutes} from './feature-landing.mjs';
import {mobileApiRoutes} from './mobile-api.mjs';

const mobilePasskeyRouteAliases = new Map([
 ['/mobile/passkeys/login/start','/passkeys/acceso/iniciar'],
 ['/mobile/passkeys/login/finish','/passkeys/acceso/terminar'],
 ['/mobile/passkeys/register/start','/passkeys/registro/iniciar'],
 ['/mobile/passkeys/register/finish','/passkeys/registro/terminar']
]);

export async function extraRoute(req,url,method,api) {
 const passkeyRoute=mobilePasskeyRouteAliases.get(url);
 if(passkeyRoute&&await passkeyRoutes(req,passkeyRoute,method,api))return true;
 if(await mobileApiRoutes(req,url,method,api))return true;
 if(await landingRoutes(req,url,method,api))return true;
  if(await editionRoutes(req,url,method,api))return true;
 if(await selectionRoutes(req,url,method,api))return true;
 if(await agendaRoutes(req,url,method,api))return true;
 if(await dashboardRoutes(req,url,method,api))return true;
 if(await candidateRoutes(req,url,method,api))return true;
 if(await socialRoutes(req,url,method,api))return true;
 if(await accountRoutes(req,url,method,api))return true;
 if(await infoRoutes(req,url,method,api))return true;
 if(await passkeyRoutes(req,url,method,api))return true;
 if(await privacyRoutes(req,url,method,api))return true;
 return false;
}
export {startMailWorker};
