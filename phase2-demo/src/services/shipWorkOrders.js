// Read-only adapter seam. Replace this implementation with the supplied ship-management API.
// These are connected-scenario demo responses, not requests to a real external system.
export async function fetchShipWorkOrders(eventId) {
 if(eventId==='real-maintenance-c4-baseline'){
  const common={device:'主机 · 四缸测温与燃烧',equipmentId:'main-engine-1',component:'四缸排温与燃烧',status:'待执行',source:'原维保计划'}
  return {source:common.source,syncedAt:Date.now(),orders:[
   {...common,id:'WO-C4-TEMP',title:'四缸测温通道周期检查',scope:'核对探头、通道、独立校验与本机周期检查要求',plannedWindow:'按原计划核对',reason:'关联四缸基线下移跟踪，已检查与未覆盖项目分别保留。'},
   {...common,id:'WO-C4-BALANCE',title:'四缸燃烧与排气平衡检查',scope:'核对六缸Pmax、喷射与排气资料，按批准范围与停机窗口检查；不预设换件',plannedWindow:'备件与窗口确认后',reason:'关联同一维保待办的后续检修安排。'}
  ]}
 }
 if(eventId!=='maintenance')return {orders:[],syncedAt:Date.now(),source:'船管接口（演示返回）'}
 const common={device:'主机 · 1#缸连杆轴承',equipmentId:'main-engine-1',component:'1#缸连杆轴承',status:'待执行',source:'船管接口（演示返回）'}
 return {source:common.source,syncedAt:Date.now(),orders:[
  {...common,id:'WO-ME-01',title:'1#缸连杆轴承周期保养',scope:'检查轴瓦与间隙、核对润滑，按确认结果保养及复测验收',plannedWindow:'本次靠港窗口',reason:'设备与部件一致，作业范围覆盖本次检查及保养，计划窗口与建议相近。'},
  {...common,id:'WO-ME-02',title:'1#缸连杆轴承专项检查与保养',scope:'专项检查轴瓦表面、间隙及润滑；按批准范围执行保养并验收',plannedWindow:'人员另行安排的停机窗口',reason:'同一部件且包含检查与保养，可作为替代；执行窗口需要人员核对。'}
 ]}
}
