// Branch fixtures are explicitly simulated. They never replace imported measurements.
export const observationPresets = {
 'real-alarm-0430': {names:['二缸排气温度','一缸排气温度'],units:['°C','°C'],before:[258.6,255.1],samples:[[260,258],[261,259]],abnormal:[180,259],days:1},
 'real-warning-0523': {names:['控制空气进口压力','控制空气进口压力（安全）'],units:['MPa','MPa'],before:[0.57,0.54],samples:[[0.67,0.64],[0.67,0.64]],abnormal:[0.57,0.54],days:1},
 'real-maintenance-0523': {names:['控制空气进口压力','控制空气进口压力（安全）'],units:['MPa','MPa'],before:[0.57,0.54],samples:[[0.67,0.64],[0.68,0.64]],abnormal:[0.57,0.54],days:2},
}

const contextNotes = {
 alarm: ['C2 ICU 的动作、反馈与现场检验', '燃油供给、同刻其他缸响应与瞬态工况'],
 warning: ['同刻现场仪表、平台测点和采样来源', '运行负荷、近期操作与低压发生窗口'],
 tracking: ['倒车试验指令、正负转速与采样时刻', '换向过程、燃油指令与燃烧响应'],
 maintenance: ['0523 临修后减压阀的后续检修需求', 'HRD-FA 总成备件、隔离与作业窗口'],
}
const meaning = {
 '发现异常':'取得异常发现，按该方向生成处置范围。',
 '未见异常':'检查范围内未见异常，不纳入该方向维修。',
 '无法确认':'资料或现场条件不足，保留缺项，继续补充。',
 '现场与系统一致':'同刻读数一致；不替代独立校准。',
 '读数不一致':'现场与平台存在差异，继续核对映射、来源和时刻。',
 '工况可比，偏离仍存在':'工况不能解释持续偏离，接续原因排查。',
 '工况变化可以解释':'取得覆盖发生窗口的操作说明，由人决定是否结束本次核实。',
 '信息已记录':'倒车操纵背景已补齐，原记录继续保留。',
 '条件受限，已记录限制':'部分指令资料缺失，带限制保留，不据此判断部件故障。',
 '有提前处理依据':'临修后的复检资料支持提前处理相关范围。',
 '暂无提前处理必要':'本轮复核暂无提前必要，原计划与后续需求仍保留。',
 '条件具备':'备件、隔离和窗口已落实，可按批准范围检查。',
 '条件暂不具备':'备件尚待到船或窗口未落实，保留待安排。',
}

function caseFeedback(item,stage,index,value){
 if(item.realType==='alarm'&&index===0&&value==='发现异常')return '本轮拆检发现二缸ICU伺服油液压活塞卡阻；ICV电气候选与液压执行机构结论分别记录。'
 if(item.realType==='alarm'&&index===1&&value==='未见异常')return '本轮已检查的燃油供给与工况范围未见异常；仅处理ICU方向，未覆盖通路仍保留限制。'
 if(item.realType==='warning'&&stage.id==='investigate'&&index===0&&value==='发现异常')return '本轮检查发现阀芯密封垫老化、单组减压阀调压卡滞；故障判断来自检查记录，不能仅凭NF参考确诊。'
 if(item.realType==='warning'&&stage.id==='check'&&index===0&&value==='现场与系统一致')return '低压发生时，0302为0.57 MPa、0303为0.54 MPa；现场仪表与系统同刻读数一致。'
 if(item.trackingOnly&&index===1&&value==='信息已记录')return '根据轮机长回执，已核对为正常计划倒车操纵；正负转速与燃烧响应按试验时段解释，不认定启动系统或TDC故障。'
 if(item.realType==='maintenance'&&index===0&&value==='有提前处理依据')return '结合0523临修恢复与HRD-FA总成申请资料，本轮仍有后续检查需求；临修恢复不能代替永久措施完成。'
 if(item.realType==='maintenance'&&index===1&&value==='条件暂不具备')return '备件仍待供船，本轮到船、隔离或作业窗口仍未落实；保留原定期检修与交替使用安排。'
 return meaning[value]
}

export function feedbackPresets(item, stage) {
 if(!item?.realCaseId||stage?.kind!=='check')return []
 const combinations=stage.tasks.reduce((rows,task)=>rows.flatMap(row=>(task.options||['发现异常','未见异常','无法确认']).map(value=>[...row,value])),[[]])
 return combinations.map((values,index)=>({id:String(index),label:values.join(' / '),records:stage.tasks.map((task,i)=>({
  label:task.label,result:values[i],attachments:[],
  note:(stage.id==='investigate'?task.label:contextNotes[item.realType]?.[i]||task.label)+'：'+caseFeedback(item,stage,i,values[i]),
 }))}))
}

export const executionPresetOptions=[
 {id:'complete',label:'作业与验收完成 → 效果观察'},
 {id:'partial',label:'仅完成部分 → 保留本轮工作'},
 {id:'unresolved',label:'作业完成但仍异常 → 返回排查／评估'},
 {id:'pending',label:'作业完成但未验收 → 补验收'},
 {id:'missing',label:'验收通过但缺可比资料 → 补观察记录'},
]
export function executionPreset(item,stage,key) {
 if(!item?.realCaseId||stage?.kind!=='work'||!executionPresetOptions.some(p=>p.id===key))return null
 const partial=key==='partial',details=stage.title
 const measures=item.realType==='alarm'&&details.includes('C2 ICU')?'已完成本轮批准的ICU更换与测试'+(details.includes('燃油供给')?'及本轮确认的供给侧处理':'')+'。':item.realType==='warning'&&details.includes('空气减压阀')?'已投入备用阀，完成密封垫临时制作、清洁装复和测试；HRD-FA供船和永久措施仍单独保留。':item.realType==='maintenance'?'已完成批准范围的减压阀定期检查、维护和压力复查；逐项登记原计划覆盖范围，不自动填写永久更换已完成。':details+'：批准范围的检查／处置已执行。'
 const now=new Date(),local=new Date(now.getTime()-now.getTimezoneOffset()*60000).toISOString().slice(0,16)
 return {...Object.fromEntries(stage.tasks.flatMap((task,i)=>[['task'+i,partial&&i===stage.tasks.length-1?'待补充':'已完成'],['note'+i,task.label+'；按本轮已确认范围记录。']])),
  equipment:item.device,executedAt:local,
  measures:(partial?'已完成部分检查，剩余工作待条件落实。':measures),
  acceptance:(key==='unresolved'?'复查仍有原异常，返回同一事项。':key==='pending'?'作业已完成，现场复测验收待补。':'已完成适用复测；持续效果另行观察。'),
  completion:partial?'partial':'completed',verification:key==='unresolved'?'unresolved':key==='pending'||partial?'pending':'resolved',
  comparable:key==='complete'?'available':'missing',
 }
}

export function decisionPreset(item,action,assessment){
 if(!item?.realCaseId)return ''
 const background=item.initialTitle+'；'+(assessment?.records||[]).map(r=>r.label+'：'+r.result).join('；')
 const directions={
  'false-alarm':'现场复核发现报警通道或测点异常，本次按误报留档；保留触发记录及核实依据，继续关注测点状态。',
  ignore:'本轮暂不新增人工任务，保留来源资料、监测与后续检查需求；若依据变化，再重新安排。',
  supplement:'补充待核对的同刻操作与现场记录，暂未定位可处置对象，保留当前排查。',
  'end-warning':'根据本轮反馈结束本轮核实；工况解释、测点差异和未确认范围分别留存，不将当前恢复等同于历史误报或永久修复。',
  'finish-tracking':'保存倒车试验指令、正负转速对应关系和资料限制，结束本轮信息核实；原跟踪继续，不安排部件维修。',
  'end-maintenance':'结束本轮提前评估；暂无必要或备件与窗口未落实的项目保持待安排，原定期检查和HRD-FA备件需求保留。',
 }
 return directions[action]?background+'。'+directions[action]:''
}

export function scenarioStatus(store,item) {
 const id=item.id
 if(store.eventStatus?.[id]==='closed')return store.completedTasks?.[id]?.title||'本轮已确认闭环'
 if(store.ignoredSuggestions?.[id])return '已记录本次不采纳决定'
 if(store.eventStatus?.[id]==='observing')return '现场工作已提交，持续效果待跟进'
 if(store.todoCreated?.[id])return store.checkAssessments?.[id]?.title||item.stages[store.progress[id]]?.label||'已派发'
 return '待决策'
}
