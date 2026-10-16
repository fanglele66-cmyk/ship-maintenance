import {trackingReturnLocation,isTrackingDossier} from '../utils/trackingNavigation.js'
import {maintenanceReturnLocation} from '../utils/maintenanceNavigation.js'
// Navigation only: never create or progress tasks here.
export function dispatchReturnLocation(route){
 if(route.path?.startsWith('/situation/attention/')&&isTrackingDossier(decodeURIComponent(route.path.split('/').at(-1))))return trackingReturnLocation(route.query)
 if(['/situation/maintenance/maintenance','/situation/maintenance/injector-3-cleaning'].includes(route.path)&&route.query?.from)return maintenanceReturnLocation(route.query)
 if(route.query?.from==='issues')return {path:'/situation/issues',query:{resume:'1',state:route.query.state||'',device:route.query.device||'',type:route.query.type||''}}
 if(route.path?.startsWith('/situation'))return {path:'/situation'}
 return {path:route.path||'/situation',query:{...route.query}}
}
