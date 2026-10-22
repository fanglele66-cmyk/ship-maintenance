// Navigation only: never create or progress tasks here.
export function issueDirectoryLocation(query={}, {resume=false}={}) {
 return {path:'/issues',query:{...(resume?{resume:'1'}:{}),state:query.state||'',device:query.device||'',type:query.type||'',
  ...(query.status?{status:query.status}:{}),...(query.scope?{scope:query.scope}:{})}}
}
export function dispatchReturnLocation(route,scenario=''){
 if(route.query?.from==='issues')return issueDirectoryLocation(route.query,{resume:true})
 if(route.path?.startsWith('/situation'))return {path:'/situation'}
 return {path:route.path||'/situation',query:{...route.query}}
}
