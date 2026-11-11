// A browser tab owns its login. Reload preserves it; other tabs do not switch it.
const sessionKey='engine-room-session-token'
export function sessionHeaders(){
 let token;try{token=sessionStorage.getItem(sessionKey)}catch{}
 return {'x-engine-room-client':'local-ui','x-ship-session':token||'none'}
}
export function saveSession(token){sessionStorage.setItem(sessionKey,token)}
export function clearSession(){sessionStorage.removeItem(sessionKey)}
