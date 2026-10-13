// Navigation only: never create or progress tasks here.
export function dispatchReturnLocation(route){
 if(route.query?.from==='issues')return {path:'/situation/issues',query:{resume:'1',state:route.query.state||'',device:route.query.device||'',type:route.query.type||''}}
 if(route.path?.startsWith('/situation'))return {path:'/situation'}
 return {path:route.path||'/situation',query:{...route.query}}
}
