import {existsSync} from 'node:fs'
import {join,resolve} from 'node:path'

export const runtimeDirectory=(root,env=process.env)=>resolve(env.SHIP_DATA_DIR||join(root,'.local-data'))

export function telemetryDirectory(root,legacyRuntime=runtimeDirectory(root),env=process.env){
 if(env.SHIP_TELEMETRY_DIR)return resolve(env.SHIP_TELEMETRY_DIR)
 const legacy=resolve(legacyRuntime),prepared=resolve(root,'deployment-data/telemetry')
 // An explicit legacy fixture remains isolated from the application's dataset.
 if(legacy!==runtimeDirectory(root,env)&&existsSync(join(legacy,'manifest.json')))return legacy
 if(existsSync(join(prepared,'manifest.json')))return prepared
 if(existsSync(join(legacy,'manifest.json')))return legacy
 return prepared
}
