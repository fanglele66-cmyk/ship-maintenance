const loopback=new Set(['127.0.0.1','::1','::ffff:127.0.0.1'])

// Local startup keeps the loopback/proxy allowlist. Deployed web clients are
// checked against a fixed public origin, independent of proxy IP and upstream Host.
// Forwarded headers never grant trust. Authentication still runs on every API.
export function trustedAppRequest(req, publicOrigin=process.env.SHIP_PUBLIC_ORIGIN||'',proxyIps=process.env.SHIP_TRUSTED_PROXY_IPS||'',mode=process.env.SHIP_REQUEST_MODE||'local') {
 if(req.headers['x-engine-room-client']!=='local-ui')return false
 try{
  if(!['local','web'].includes(mode)||(mode==='web'&&!publicOrigin))return false
  const expected=publicOrigin?new URL(publicOrigin):new URL(`${req.socket?.encrypted?'https':'http'}://${req.headers.host}`)
  if(!['http:','https:'].includes(expected.protocol)||expected.username||expected.password||expected.pathname!=='/'||expected.search||expected.hash)return false
  if(mode==='web'){
   if(req.headers['sec-fetch-site']==='cross-site')return false
   const {origin,referer}=req.headers
   if(origin!==undefined&&origin!==expected.origin)return false
   if(referer!==undefined){
    const source=new URL(referer)
    if(source.origin!==expected.origin||source.username||source.password)return false
   }
   // Same-origin GETs commonly omit Origin; their Referer still identifies the site.
   // Clients omitting both must address the configured public Host directly.
   return origin!==undefined||referer!==undefined||req.headers.host===expected.host
  }
  const address=(req.socket?.remoteAddress||'').replace(/^::ffff:/,'')
  const trustedProxy=Boolean(publicOrigin)&&proxyIps.split(',').map(ip=>ip.trim()).filter(Boolean).includes(address)
  if(!loopback.has(address)&&!trustedProxy)return false
  if(expected.host!==req.headers.host)return false
  return !req.headers.origin||req.headers.origin===expected.origin
 }catch{return false}
}
