const step=(label,guide,checks,recordHint)=>({label,guide,checks,recordHint,options:['已完成','未完成','不适用']})
export function maintenancePlans(event){
 if(!event.tracking)return []
 const cylinder=event.id.includes('c4')?'四缸':'一缸',code=event.id.includes('c4')?'04':'01'
 const preparation=step('核对计划、备料与停机隔离','按所选计划提前执行，确认靠港停机窗口和获批作业范围。',['核对作业卡版本、探头及密封适配性，备齐有效校验工具。','办理停机、防意外启动和相关能源隔离，确认具备作业条件后开始。'],'记录计划编号、许可、隔离确认与实际备料；条件不满足时停止并上报。')
 const measurement=step('校验'+cylinder+'排温测量链路','按适用作业卡核对探头、端子及采集通道，采用独立仪表校验。',['记录校验设备、同刻读数和测量条件，区分同源显示与独立校验。','仅对已确认且获批的连接或探头问题实施处理；限值按厂家文件核对。'],'记录原始偏差、实际处理、使用部件及处理后校验结果。')
 const combustion=step('执行燃烧与排气专项维护','依据计划和已确认发现检查喷油器响应、排气阀及燃烧平衡。',['在批准条件下记录六缸排温、Pmax及运行工况，定位仍存在的差异。','仅按获批作业卡清洁、检修或换件，未获批部位保留并上报。'],'记录检查部位、实际措施及用料；未执行项和原因单列。')
 const restore=step('恢复、复测与汇报','恢复本次拆装接口与防护，在批准工况下复测并汇报。',['复核接线、密封、工具清点和恢复签认。','同步记录六缸排温、转速与负荷，对照处理前后变化。'],'提交实际作业记录、复测结果及剩余事项，交轮机长审阅闭环。')
 return [
  {id:'CBY-MP-TEMP-'+code,revision:'1',title:cylinder+'排温测量链路校验与保养',steps:[preparation,measurement,restore]},
  {id:'CBY-MP-BALANCE-'+code,revision:'1',title:cylinder+'测温与燃烧平衡专项维保',steps:[preparation,measurement,combustion,restore]},
 ]
}
// Planned port calls; elapsed windows are never offered for a new dispatch.
export const maintenancePortCalls=[
 {id:'V261031-SHA',port:'上海',start:'2026-10-31T09:00:00+08:00',end:'2026-10-31T16:00:00+08:00',label:'上海靠港 · 10月31日 09:00—16:00 · 停机检修'},
 {id:'V261102-NBO',port:'宁波',start:'2026-11-02T08:00:00+08:00',end:'2026-11-02T15:00:00+08:00',label:'宁波靠港 · 11月2日 08:00—15:00 · 停机检修'},
]
export const availableMaintenanceWindows=(now=Date.now())=>maintenancePortCalls.filter(w=>Date.parse(w.end)>now)
export function maintenanceSelection(event,form,now=Date.now()){
 const plan=maintenancePlans(event).find(p=>p.id===form.maintenancePlanId),window=availableMaintenanceWindows(now).find(w=>w.id===form.window)
 if(!plan||!window)throw Error('请选择适用的维保计划及尚未结束的靠港检修时间。')
 if(Date.parse(form.deadline)<Math.max(now,Date.parse(window.start))||Date.parse(form.deadline)>Date.parse(window.end))throw Error('要求完成时间应在所选靠港检修窗口内。')
 return {plan:JSON.parse(JSON.stringify(plan)),window:{...window}}
}
