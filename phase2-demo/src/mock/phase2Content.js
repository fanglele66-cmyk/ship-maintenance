import additionalScenarios from './additionalScenarios.json'
import { maintenanceProposalScene } from './phase2SituationContent'
import { mockEvents } from './events'

// 结构来源：墨刀“改造和新增的部分”概览类、检测类、处置类及其助手说明。
// 冷却水案例沿用一期事件快照；其余为本次已约定的模拟故事。
export const overviewReports = {
  maintenance: {
    basis: '近7日轴承振动由2.1升至3.0 mm/s，较起始值增加约43%；累计运行1,860 h，距2,000 h周期检修节点约140 h。约48小时后有靠港窗口。',
    conclusion: '振动持续上行且周期检修临近，提示轴承状态可能偏离历史稳定区间；但系统尚未触发振动报警，趋势本身不能证明轴瓦磨损或直接决定换件。',
    system: '继续跟踪振动与轴承温度。', operation: '结合靠港窗口安排检查，作业前按现有规程确认停机与隔离条件。', human: '检查轴瓦表面、测量间隙并核对备件，再决定是否提前保养。'
  },
  drift: {
    basis: '同工况下3#缸排温相对差由8°C扩大到10°C；当前排温432°C，低于450°C AMS报警线，出现轻微波动。',
    conclusion: '3#缸排温相对差持续扩大，可能增加燃烧效率下降和后燃风险；现有监测数据仍需现场证据核实。',
    system: '继续比较同工况排温、相对差和负荷。', operation: '当前数据未触发AMS报警；是否调整运行按现场规程与轮机员判断执行。', human: '核对现场仪表，确认异响、振动能否复现，以补充异常确立依据。'
  },
  driftEvent: {
    basis: '系统排温相对差由8°C扩大到10°C；现场仪表与采集值一致，3#缸轻微异响可复现，人工已确认需要响应。',
    conclusion: '排温异动已由现场证据确立；喷油器雾化不良等燃烧异常值得优先核实，根因尚待排查。',
    system: '继续保留同工况趋势与现场反馈的关联记录。', operation: '按现场作业条件安排检查，持续关注排温变化。', human: '在候选原因中查看依据，优先排查喷油器，再核查排气阀密封。'
  },
  fault: {
    basis: '冷却水出口温度92.4°C，进口温度48.7°C，温差43.7°C；流量降至68.2 m³/h，低于80 m³/h参考下限。',
    conclusion: '温差扩大与流量下降同时出现，冷却能力不足；优先怀疑海水冷却管路或滤器堵塞，持续升温可能影响主机运行。',
    system: '同步观察出口温度、进出口温差和流量。', operation: '由轮机员结合现有告警及运行规程判断负荷安排。', human: '优先检查海水滤器压差与脏污，再核对换热器和温控阀。'
  }
}

export const causeContent = {
  fault: { mechanism: '冷却水进口温度变化不大，而出口温度和温差同步升高，流量明显下降，首先考虑冷却侧阻力增大或换热效率下降。', rows: [
    { level:'较高', name:'海水冷却管路 / 滤器堵塞', cause:'管路阻力增大，冷却水供给不足', effect:'流量下降，出口温度和温差升高', check:'滤器压差与滤芯脏污' },
    { level:'中等', name:'淡水冷却侧结垢', cause:'换热面水垢降低传热效率', effect:'进出口温差扩大，冷却能力下降', check:'换热前后温差及结垢情况' },
    { level:'较低', name:'温控阀动作异常', cause:'阀位或执行机构异常', effect:'冷却水分配不合理', check:'实际阀位与动作反馈' }
  ]},
  drift: { mechanism:'现场仪表一致且异响可复现，单纯测点偏差的可能性降低。单缸排温偏高提示燃烧或排气过程存在差异，需要结合喷油与气阀证据区分。', rows:[
    {level:'较高',name:'喷油器雾化不良',cause:'喷孔积炭或喷雾形态异常，燃烧后移',effect:'单缸排温升高并伴燃烧异响',check:'喷孔积炭与喷雾形态'},
    {level:'中等',name:'排气阀密封不良',cause:'阀面密封状态变化',effect:'单缸热状态偏离',check:'阀面密封与漏气情况'},
    {level:'较低',name:'测点偏差',cause:'采集或现场仪表偏差',effect:'读数偏高但未必存在真实温升',check:'现场与系统读数已初步互证'}
  ]}
}

const english = ['Cyl Cool Water Out','Cyl Cool Water In','Cooling Water ΔT','Cool Water Flow','Expansion Tank Level','Engine Speed']
const faultSensors = mockEvents[0].snapshot.sensors.map((s,i)=>{const start=s.trendData[0].value,end=s.trendData.at(-1).value;return {...s,id:`fault-${i}`,nameEn:english[i],nameCn:s.name,trendData:s.trendData.map(p=>({...p,value:Number((start+(p.value-start)*(s.value-start)/(end-start||1)).toFixed(2))}))}})
faultSensors[2].trendData=faultSensors[0].trendData.map((p,i)=>({...p,value:Number((p.value-faultSensors[1].trendData[i].value).toFixed(2))}))
function sensor(id,nameEn,nameCn,unit,values,normalRange){return {id,nameEn,nameCn,name:nameCn,unit,value:values.at(-1),normalRange,trendData:values.map((value,i)=>({time:`09-${String(23+Math.floor(i/4)).padStart(2,'0')} ${String(i%4*6).padStart(2,'0')}:00`,value}))}}
for(const item of additionalScenarios){overviewReports[item.id]=item.report;causeContent[item.id]=item.cause}
export function scenarioSensors(id, stageId='event') {
  const extra=additionalScenarios.find(item=>item.id===id)
  if(id==='main-warning')return [{id:'warn-oil',name:'机油压力',nameCn:'机油压力',nameEn:'机油压力',value:.24,unit:'MPa',trendData:[{time:'前2班',value:.31},{time:'前1班',value:.27},{time:'本班',value:.24}]},{id:'warn-delta',name:'滤器压差',nameCn:'滤器压差',nameEn:'滤器压差',value:.07,unit:'MPa',trendData:[{time:'前2班',value:.03},{time:'前1班',value:.05},{time:'本班',value:.07}]}]
  if(id==='air-delivery')return [{id:'air-time',name:'加载时间',nameCn:'加载时间',nameEn:'加载时间',value:128,unit:'s',trendData:[{time:'前2班',value:95},{time:'前1班',value:112},{time:'本班',value:128}]},{id:'air-pressure',name:'供气压力',nameCn:'供气压力',nameEn:'供气压力',value:0.82,unit:'MPa',trendData:[{time:'前2班',value:.82},{time:'前1班',value:.82},{time:'本班',value:.82}]}]
  if(extra)return mockEvents[extra.snapshotIndex].snapshot.sensors.map((s,i)=>({...s,id:extra.id+'-'+i,nameCn:s.name,nameEn:s.name,trendData:s.trendData.map(p=>{const first=s.trendData[0].value,last=s.trendData.at(-1).value;return {...p,value:Number((first+(p.value-first)*(s.value-first)/(last-first||1)).toFixed(3))}})}))
  if(id==='fault')return faultSensors
  if(id==='maintenance')return [sensor('vibration','Bearing Vibration','1#缸轴承振动','mm/s',[2.1,2.15,2.12,2.2,2.25,2.3,2.32,2.4,2.45,2.5,2.6,2.65,2.7,2.8,2.9,3.0],'历史稳定区间约2.1–2.3 mm/s'),sensor('bearing-temp','Bearing Temperature','轴承温度','°C',[62,62.4,62.1,63,63.2,63.1,63.5,64,64,64.2,64.5,64.8,65,65.2,65.1,65.4],'历史稳定区间62–65°C')]
  const values=stageId==='attention'?[420,421,421,422,423,422,423,424,424,425,426,427,428,429,431,432]:[420,421,421,422,423,422,423,424,424,425,426,427,428,429,431,432]
  return [sensor('cyl3','Cyl.3 Exh.Temp','3#缸排气温度','°C',values,'AMS报警线450°C'),sensor('cyl-avg','Other Cyl. Avg.Temp','其余缸平均排温','°C',[418,419,419,419,420,419,419,420,420,420,420,421,420,421,422,422],'同工况比较'),sensor('deviation','Cyl.3 Temperature Δ','3#缸排温相对差','°C',values.map((v,i)=>v-[418,419,419,419,420,419,419,420,420,420,420,421,420,421,422,422][i]),'关注同工况变化')]
}

export function attentionScene(id, monitorStep=0) {
  if(id==='maintenance')return maintenanceProposalScene
  if(id==='stable')return {title:monitorStep===2?'本轮关注已收束':'海水冷却泵压力持续跟踪', paragraphs:[{label:'观测情况',text:monitorStep===2?'第三次同工况比对，压力波动收敛至0.39–0.40 MPa。':'出口压力在0.38–0.41 MPa之间小幅波动，连续样本未见扩大。'},{label:'关联证据',text:'流量和冷却水温没有同步恶化，尚未出现明确故障证据。'},{label:'后续安排',text:monitorStep===2?'结束本轮专项跟踪，恢复常规监测。':'继续做同工况比对，观察波动是否扩大。'}],question:monitorStep===2?'如后续出现新的现场现象，您可以继续补充。':'现场若有异响、泄漏或工况变化，请告诉我。'}
  if(id==='cyl2-ended')return {title:'2#缸排温观察结论',paragraphs:[{label:'监测结果',text:'三轮相近工况下排温依次为420°C、421°C、420°C；与其余缸均值的差值约为1°C、1°C、0°C。'},{label:'本轮判断',text:'未见持续偏离或差值扩大，现有记录不支持建立异常待办。'},{label:'后续安排',text:'结束专项观察并恢复常规监测；若后续出现持续偏离或现场异常，再重新评估。'}],question:'这条观察已收束，不需要创建待办。'}
  if(id==='vibration-trend')return {title:'主机机体振动状态跟踪',paragraphs:[{label:'监测情况',text:'相近工况下X向采集值近三轮为2.7、2.8、2.8 mm/s，变化幅度较小；Y向读数未见同步抬升。'},{label:'当前判断',text:'现有趋势没有形成连续上升，也没有现场异常反馈，暂不要求人工确认。'},{label:'后续安排',text:'继续自动比较同工况数据；若持续上行或出现可复现异响、振动，再请求现场核实。'}],question:'近期机体有异响或振动手感变化吗？如有，可直接补充现场现象。'}
  return {title:monitorStep?'异动跟踪出现新事实':'主机3#缸排温持续关注',paragraphs:monitorStep?[
    {label:'观测节点',text:'持续监测第2日，同工况比对已形成新的排温差证据。'},
    {label:'跟踪回顾',text:'同工况排温相对差由8°C扩大到10°C，并出现轻微波动；当前432°C，尚未触及450°C AMS报警线。'},
    {label:'建议',text:'建议人工核对现场仪表，并补充异响、振动等现象，确认异动是否真实且需要响应。'}
  ]:[{label:'当前情况',text:'同工况下3#缸排温428°C，其余缸平均约420°C，相对差约8°C，出现单缸偏离。'},{label:'关注依据',text:'尚未触及450°C AMS报警线。单缸偏离值得跟踪，但当前没有现场异响、振动佐证，不能只凭相对差认定异常成立。'},{label:'后续安排',text:'系统继续比较相近转速与负荷下的排温和缸间差值；若偏差扩大或出现新波动，再请求现场核实。'}],question:monitorStep?'是否为您建立对应检查待办？如有现场异响、振动等细节，可一并补充。':'近期3#缸是否有异响、振动或负荷变化？您可以直接向我反馈。'}
}

export function stageScene(id, stage, observationReady=false) {
  const report=overviewReports[id==='drift'&&stage.id==='event'?'driftEvent':id]
  if(stage.kind==='overview')return {title:stage.label,paragraphs:[{label:'初判结论',text:report.conclusion},{label:'判断依据',text:report.basis},{label:'下一步建议',text:report.human}],question:stage.id==='event'?'要先查看数据趋势，还是结合候选原因安排排查？':id==='maintenance'?'现场是否具备检查条件？轴瓦磨损、间隙和备件信息都可以直接补充。':'现场仪表读数是否一致？有无可以复现的异响或振动？'}
  if(stage.kind==='check')return {title:`已进入${stage.label}`,paragraphs:[{label:'本轮任务',text:stage.title},{label:'操作提示',text:`先查看当前${stage.label}项的注意事项，确认后逐步记录现场结果。提交后我会整理反馈并提示下一步。`}],question:id==='drift'&&stage.id==='check'?'请重点确认读数真实性和现场现象；补充证据后再判断异常事件是否成立。':'如有补充、修改或新的现场发现，可以直接告诉我。'}
  if(stage.kind==='work')return {title:`已进入${stage.label}`,paragraphs:[{label:'处理目标',text:stage.title},{label:'操作安排',text:'依次核对准备、备件、作业步骤和验收结果。也可一次说明已完成的检查和处理过程，我会整理为记录供您确认。'}],question:id==='fault'?'滤器清洗后，实测流量和出口温度分别是多少？':id==='drift'?'喷油器处理后，喷雾形态、密封和同工况排温如何？':additionalScenarios.find(item=>item.id===id)?'处理后原异常指标与现场现象如何？请在执行记录中确认，并明确验收是否通过。':'换件后间隙、振动和轴承温度的复测结果如何？'}
  if(stage.kind==='observe'&&!observationReady)return {title:'已进入效果观察',paragraphs:[{label:'观察安排',text:stage.title},{label:'验证口径',text:id==='maintenance'?'跟踪同工况振动是否由3.0 mm/s回落，并观察轴承温度。':id==='drift'?'跟踪同工况排温相对差是否由10°C回落，同时确认异响是否消失。':'跟踪流量是否由68.2 m³/h恢复、出口温度是否由92.4°C回落，留意是否反复。'}],question:'当前观察窗口尚未完成。如发现新的现场异常，可以随时反馈。'}
  if(stage.kind==='observe')return {title:'处理后效果观察',paragraphs:[{label:'观察口径',text:stage.summary},{label:'监测证据',text:stage.evidence.join('；')},{label:'当前判断',text:stage.judgement}],question:'您是否确认观察期内没有新的异常？可确认闭环，或延长跟踪并补充现场情况。'}
  return {title:'本次处理已闭环',paragraphs:[{label:'处理摘要',text:stage.evidence.join('；')},{label:'后续建议',text:stage.judgement}],question:'需要回看哪一阶段的记录，或将本次处理提报为案例？'}
}
