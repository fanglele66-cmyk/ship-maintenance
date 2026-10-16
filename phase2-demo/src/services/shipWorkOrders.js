// Read-only adapter seam. Replace this implementation with the supplied ship-management API.
// These are connected-scenario demo responses, not requests to a real external system.
export async function fetchShipWorkOrders(eventId) {
 if(eventId!=='maintenance')return {orders:[],syncedAt:Date.now(),source:'船管接口'}
 const common={device:'主机 · 1#缸连杆轴承',equipmentId:'main-engine-1',component:'1#缸连杆轴承',status:'待执行',source:'船管接口'}
 return {source:common.source,syncedAt:Date.now(),orders:[
  {...common,id:'WO-ME-01',title:'1#缸连杆轴承周期保养',scope:'检查轴瓦与间隙、核对润滑，按确认结果保养及复测验收',plannedWindow:'本次靠港窗口',reason:'设备与部件一致，作业范围覆盖本次检查及保养，计划窗口与建议相近。'},
  {...common,id:'WO-ME-02',title:'1#缸连杆轴承专项检查与保养',scope:'专项检查轴瓦表面、间隙及润滑；按批准范围执行保养并验收',plannedWindow:'人员另行安排的停机窗口',reason:'同一部件且包含检查与保养，可作为替代；执行窗口需要人员核对。'}
 ]}
}
