const loopback=new Set(['127.0.0.1','::1','::ffff:127.0.0.1'])

// Nginx runs on the same host and forwards Host unchanged. Do not trust
// arbitrary X-Forwarded-* headers or expose the backend listener publicly.
export function trustedAppRequest(req, publicOrigin=process.env.SHIP_PUBLIC_ORIGIN||'') {
 if(!loopback.has(req.socket?.remoteAddress)||req.headers['x-engine-room-client']!=='local-ui')return false
 try{
  const expected=publicOrigin?new URL(publicOrigin):new URL(`${req.socket?.encrypted?'https':'http'}://${req.headers.host}`)
  if(!['http:','https:'].includes(expected.protocol)||expected.username||expected.password||expected.pathname!=='/'||expected.search||expected.hash)return false
  if(expected.host!==req.headers.host)return false
  return !req.headers.origin||req.headers.origin===expected.origin
 }catch{return false}
}
