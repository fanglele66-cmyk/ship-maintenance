export const trackingIds = ['drift', 'air-delivery', 'cyl4-watch', 'cyl2-ended', 'cyl5-drift']
export const isTrackingDossier = id => trackingIds.includes(id)
export const trackingPath = id => '/situation/attention/'+encodeURIComponent(id)
export function trackingReturnLocation(query={},deviceId='main-engine-1') {
  if(query.returnTracking==='1')return {path:'/event',query:{todo:query.todo}}
  if(query.from==='issues')return {path:'/situation/issues',query:{...query,resume:'1'}}
  if(query.from==='workbench')return {path:'/situation'}
  return {path:'/situation',query:{restoreDevice:query.device||deviceId,restoreTab:query.from==='history'?'history':'related',type:query.type||'异动跟踪',state:query.state||'待决策',category:query.category||'all',scroll:query.scroll||'0'}}
}
