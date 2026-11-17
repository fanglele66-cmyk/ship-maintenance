export function normalizeContextPath(value='') {
 const path=String(value).trim().replace(/^\/+|\/+$/g,'')
 if(!path)return ''
 if(path.split('/').some(segment=>!/^[A-Za-z0-9][A-Za-z0-9_-]*$/.test(segment)))throw Error('SHIP_CONTEXT_PATH must contain path segments with letters, numbers, underscores or hyphens.')
 return '/'+path
}

// Apply before authentication, API routing and static file lookup. Root requests
// remain valid when the upstream proxy has already removed the context path.
export function handleContextPath(req,res,prefix) {
 if(!prefix)return false
 const url=req.url||'/',queryAt=url.indexOf('?')
 const pathname=queryAt<0?url:url.slice(0,queryAt)
 if(pathname===prefix){
  res.writeHead(308,{Location:prefix+'/'+(queryAt<0?'':url.slice(queryAt)),'Cache-Control':'no-store'})
  res.end()
  return true
 }
 if(pathname.startsWith(prefix+'/'))req.url=url.slice(prefix.length)
 return false
}
