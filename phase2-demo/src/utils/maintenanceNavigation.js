export function issueDetailPath(id){return id==='maintenance'?'/situation/maintenance/injector-3-cleaning':'/situation/issue/'+encodeURIComponent(id)}
export function maintenanceReturnLabel(query={}){return query.from==='workbench'?'返回船舶态势':query.from==='issues'?'返回事项处置':query.from==='history'?'返回动态记录':query.from==='device'?'返回主机相关事项':'返回维保建议'}
export function maintenanceReturnLocation(query={}){
 if(query.from==='issues')return {path:'/situation/issues',query:{...query,resume:'1'}}
 if(query.from==='workbench')return {path:'/situation',query:{}}
 return {path:'/situation',query:{restoreDevice:query.device||'main-engine-1',restoreTab:query.from==='history'?'history':'related',type:query.type||'维保建议',state:query.state||'待决策',category:query.category||'all',scroll:query.scroll||'0'}}
}
