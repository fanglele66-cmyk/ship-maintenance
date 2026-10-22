// Navigation only: never create or progress tasks here.
export function issueDirectoryLocation(query={}, {resume=false}={}) {
 const status=['待决策','处置中','已闭环'].includes(query.status)?query.status:query.state==='待决策'?'待决策':query.state==='已闭环'?'已闭环':query.state?'处置中':''
 return {path:'/issues',query:{...(resume?{resume:'1'}:{}),device:query.device||'',type:query.type||'',status,
  ...(query.scope?{scope:query.scope}:{})}}
}
export function dispatchReturnLocation(route,scenario=''){
 if(route.query?.from==='issues')return issueDirectoryLocation(route.query,{resume:true})
 if(route.path?.startsWith('/situation'))return {path:'/situation'}
 return {path:route.path||'/situation',query:{...route.query}}
}
