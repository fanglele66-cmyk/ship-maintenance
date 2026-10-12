import { taskReceipt } from '../message-flows/taskReceipt.js'
// Prototype fixtures, never real customer telemetry.
const point=(label,at,text,assessment)=>({label,at,actor:'AI 状态跟踪',text,assessment})
export const r02Reports={
  'cyl4-watch':{
    conclusion:'4#缸排温相对偏差在近期多个可比片段中反复出现，与此前表现不同，暂未继续扩大。值得持续跟踪，但不足以确认具体部件故障。',
    recommendation:'暂不需要人员操作；系统继续比较本缸历史、缸间差异与相关信号。',
    sections:[{title:'进入关注的依据',paragraphs:['初次出现的单个片段先保留在运行分析中；后续多个独立、相近转速与负荷片段反复出现同类偏差，且不同于此前可比表现，才建立一条关注档案。','本次选取转速440–460 rpm、负荷68%–72%的稳定运行片段，排除启停及负荷快速变化时段。']},{title:'当前解释与限制',paragraphs:['新可比片段仍反复出现相同偏差，但未扩大，没有新增已确认的现场异常。未报警不是建档依据，当前也不能锁定喷油器等部件。','与近30天同工况记录相比，相对差由3–4°C升至7–8°C；尚未持续扩大，继续观察。']}],
    timeline:[point('初次发现 · 尚未建档','初始片段','一个运行片段出现排温相对偏差。','保留为普通分析背景，核对可比性与参考。'),point('反复出现 · 建立关注','后续独立可比片段','相同偏差在多个可比片段中反复出现，与此前表现不同。','形成独立跟踪理由，仅建立一个4#缸档案。'),point('后续回顾 · 尚未扩大','最近可比片段','新的片段仍出现相同偏差，但暂未继续扩大。','更新原档案，维持系统跟踪，无新增人工任务。')]
  },
  'cyl2-ended':{
    conclusion:'2#缸原反复出现的排温相对偏差在后续有效可比片段中收敛，未再反复出现。本轮专项观察结束，恢复常规监测。',
    recommendation:'无需操作，可回看结束依据；本轮没有检查或维修执行。',
    sections:[{title:'最初为何关注',paragraphs:['原相对偏差在多个独立可比片段中反复出现，与此前表现不同，才形成关注。不是从一次轻微起伏直接建立专项观察。']},{title:'后续收敛与结束范围',paragraphs:['偏差开始收敛时仍继续观察，后续可比片段中原偏差未再反复出现，且没有新增相关异常证据，才结束本轮专项观察。','本轮没有检查或维修执行，不能说成维修成功。近72小时取得6个有效可比片段，缸间差收敛至2–3°C；数据中断、人员未回复都不是结束依据。']}],
    timeline:[point('反复偏差 · 进入关注','进入关注时','多个可比片段反复出现不同于此前表现的相对偏差。','建立专项关注，没有人工检查或维修。'),point('偏差开始收敛 · 继续观察','后续比较阶段','偏差开始收敛，但当时尚不足以结束。','继续取得有效可比记录，保留原判断。'),point('观察结束','最近有效可比片段','原偏差未再反复出现，缸间差异收敛，无新增相关异常证据。','结束本轮专项观察，恢复常规监测。')]
  },
  drift:{
    conclusion:'3#缸原反复出现的相对偏差在新的可比片段中进一步扩大，并出现波动变化。需要现场核实，尚不能确认具体故障。',
    recommendation:'核对现场排温、运行工况和现场现象，通过右侧询问组件提交。',
    sections:[{title:'建档与本次新证据',paragraphs:['最初多个可比片段反复出现相对偏差，与此前表现不同，因此建立档案；这不是只有一个读数的完整历史趋势。','后续新增可比片段显示偏差继续扩大并出现波动变化，人工介入来自新增证据，不是固定时间到达。本次同工况排温由428°C升至432°C，与其余缸均值差由8°C扩大至10°C。']},{title:'解释与未确认原因',paragraphs:['现场读数和当时工况可帮助核实采集变化，不能直接确诊喷油器或气阀故障。没有异响也不能单独排除问题。']},{title:'本次补证要求',paragraphs:['在右侧通用询问组件填写现场读数、工况与核对时间、现场现象，并确认已核对。无需先建事件才能完成这项核实。','完整提交仅完成本次核实要求，不自动确诊或创建事件；普通留言不能替代必填字段与核对确认。']}],
    timeline:[point('反复偏差 · 建立关注','初期可比片段','相对偏差在多个可比片段中反复出现，与此前表现不同。','建立同一关注档案，先由系统持续比较。'),point('偏差扩大 · 请求现场核实','新增可比片段','偏差进一步扩大，并出现波动变化。','请求现场读数、工况和现象；当前未确诊。')]
  }
}

export function r02Report(store,id){
  const source=r02Reports[id]
  if(!source || (id==='drift' && store.todoCreated.drift))return null
  return {...source,sections:source.sections.map(s=>({...s,paragraphs:[...s.paragraphs]})),timeline:source.timeline.map(p=>({...p})),arrangement:[{label:'当前安排',text:source.recommendation},{label:'下次复核',text:id==='cyl2-ended'?'常规监测；新的持续变化重新评估':'每日08:00回顾近24小时可比片段'}]}
}

const scene=(id,title,paragraphs,question='')=>({id,role:'assistant',type:'notice',kind:'scene',expanded:true,title,paragraphs,question,demoLabel:''})
export const r02TaskReceipts=Object.fromEntries(['cyl4-watch','cyl2-ended','drift'].map(id=>[id,taskReceipt({
  id:`r02-${id}-review-20261012`,runId:`health-review-${id}-20261012-0800`,title:'每日健康回顾',completedAt:'2026/10/12 08:00',triggerLabel:'每日定时任务',executionStatus:'completed',
  subject:`主机 · ${id==='cyl4-watch'?'4':id==='cyl2-ended'?'2':'3'}#缸`,analysisRange:'10月11日08:00 — 10月12日08:00 · 可比运行片段',
  conclusion:r02Reports[id].conclusion,
  change:id==='cyl4-watch'?'排温429°C → 428°C；缸间相对差8°C → 7°C。偏差暂未扩大，继续关注。':id==='cyl2-ended'?'缸间相对差维持2°C，近72小时未再反复偏离。本轮专项观察结束。':'排温430°C → 432°C；缸间相对差9°C → 10°C。偏差扩大，需要现场核实。',
  requiresAction:id==='drift',arrangement:id==='drift'?'请核对现场排温、当时工况与现场现象，并在下方提交核实记录。':id==='cyl2-ended'?'恢复常规监测，无需你操作。本轮没有检查或维修执行。':'继续系统跟踪，暂无需你执行的检查。下次回顾：10月13日08:00。',
  dataLimit:'本次结论仅覆盖已接入指标，不代表未覆盖部位正常。'
})]))
export function r02InitialMessage(store,id){
  if(r02TaskReceipts[id])return r02TaskReceipts[id]
  if(id==='drift' && !store.todoCreated.drift)return scene('r02-drift-current',store.attentionFeedback.drift?'3#缸 · 核实记录已提交':'3#缸 · 新证据需要现场核实',store.attentionFeedback.drift?[{label:'本次要求',text:'现场核实已完整提交，不等于确认或排除故障，没有自动创建检查事件。'},{label:'分析状态',text:store.dossierReviews?.drift?.text||'后续分析尚未更新，待取得相应结果后再补充。'}]:[{label:'新证据',text:r02Reports.drift.conclusion},{label:'需要你',text:'请核对现场读数、当时工况和现场现象，帮助区分实际变化与测量或工况影响。'}])
  return null
}

// Deterministic responses for the approved scripts, not a real semantic agent.
export function r02Reply(store,id,text){
  const value=text.trim(),isQuestion=/[?？]|为什么|为何|是否|是不是|要不要|需要.*吗|怎么|哪些|有什么|多少|多久|能否|看看|查看/.test(value)
  const supplement=!isQuestion && /现场|异响|声音|负荷|泵组|切换|松动|测点|工况|读数|意见|建议/.test(value)
  const result={text:'',supplement}
  if(id==='cyl4-watch'){
    result.text=/报警/.test(value)?'这次依据是相对此前可比表现出现了反复变化，不是仅凭“未报警”。当前足以支持观察，尚不足以要求维修。':/换|喷油|维修|退化/.test(value)?'现有材料不能定位喷油器问题，也没有现场检查支持换件。当前不建议只凭这项变化直接维修。':/昨天|今天|严重|扩大/.test(value)?'新的可比片段仍出现同类偏差，但暂未扩大；近30天参考显示本次相对差偏大，但不能据此确认长期劣化。':supplement?'这条现场情况可以作为人员补充，但不能单独排除设备问题。可在本条消息确认登记原文；当前仍保持系统跟踪。':r02Reports[id].conclusion+' 接下来比较本缸历史、缸间差异及相关信号，暂无人工任务。'
  }else if(id==='cyl2-ended'){
    result.text=/维修|修好|换件/.test(value)?'本轮没有维修执行记录，不能把自然收敛归因于不存在的维修。':/没问题|健康|正常/.test(value)?'本次只收束2#缸这项变化的专项观察，不覆盖所有部位，也不能代替后续监测。':/为何|为什么|开始|当时/.test(value)?'最初已有多个可比片段反复偏离且不同于此前表现的依据。历史中的“继续观察”不会被最后的结束结论覆盖。':supplement?'这是一条新的现场补充。请说明发生时间、工况和位置；可以先留存，但不自动改写历史结束结果或认定复发。':r02Reports[id].conclusion+' 常规监测继续；不会每天重复要求你处理这个历史事项。'
    if(supplement && /又|再次|异常声音|异响/.test(value))result.newSituation=true
  }else if(id==='drift'){
    if(store.todoCreated.drift)return {text:'本问题已有关联事件。检查、排查和实际处置在原事件中接续；关注档案保留原证据，不再重复填写一份核实表。',supplement}
    if(/演示.*(分析|研判)|模拟.*(分析|研判)/.test(value) && store.attentionFeedback.drift && !store.todoCreated.drift){
      result.review=/不足|缺少/.test(value)?'insufficient':/修订|未支持/.test(value)?'revise':'check'
      result.text=result.review==='check'?'结合最新可比片段与现场反馈，建议进一步核查3#缸；具体原因仍未确定。若确认开展检查，将关联同一问题事件，不代表已检查或维修。':result.review==='revise'?'本次新增材料未支持原扩大解释，修订判断并继续观察。保留原判断及修订依据，不认定整机正常。':'现场反馈已留存，但仍缺少足够可比证据。继续观察，不确认原因。'
    }else result.text=/暂时|无法|不能.*核对/.test(value)?'可以保留无法核对的原因，待具备条件后继续。核实要求仍待处理；不强迫不可行或危险的操作。':/为何|为什么|核对.*[?？]/.test(value)?'现场读数与当时工况帮助核实采集变化是否真实；核实不负责直接确定根因，也不需要先创建检查事件。':supplement?'已收到这条补充。如需留档，可在本条消息确认登记；普通留言不能替代现场读数、工况及核对确认。':store.attentionFeedback.drift?'本次核实已提交，后续分析尚未更新。不直接宣布故障成立；取得最新可比数据后更新研判。':'新的可比片段显示偏差扩大，需要在右侧组件补齐现场读数、工况和现象；尚不能确定故障原因。'
  }else if(id==='stable'){
    result.text=/滤器|堵/.test(value)?'没有足够证据锁定滤器堵塞。仅有压力小幅波动，关联流量与水温未同步变化，不能套用冷却水故障的根因结论。压差与滤器状态未取得。':/泵组|切换/.test(value)?'泵组切换可能影响读数，但需要核对时间、组合及记录，不能直接认定为原因。当前没有压力关注档案；补充仅保留在设备对话。':/变大|扩大/.test(value)?'这属于新的情况，需要取得对应时段与可比依据后重新评估，不能沿用旧结论；尚不足以建立专项关注。':'当前材料只有小幅波动且未见扩大，关联流量和水温未同步变化。现有依据不足以建立专项关注或要求检修，也不能确认泵绝对健康。'
    result.supplement=false
  }else if(id==='vibration-trend'){
    result.text=/轴承|磨损|换件/.test(value)?'机体X向测点不能直接定位具体轴承，没有相应部位证据或现场检查，不建议据此换件；需要结合具体部位证据判断。':/Y向|方向|没问题/.test(value)?'其他方向未同步变化不能单独排除局部问题。当前Y向振动为2.1–2.2 mm/s，未同步上升，但不能因此认定整机健康。':/传感器|安装|听诊/.test(value)?'先明确希望覆盖的问题与现有测点缺口，再评估接入条件。当前材料不足以直接提出安装或采购方案。':/松动|现场|负荷/.test(value)?'这是新的现场信息，需要核对位置、时间和工况。未取得证据前不确认松动或归因为负荷；没有关注档案，不登记到不存在的跟踪记录。':'小幅变化后持平不足以认定退化。还需核对可比工况、历史波动、测点与关联信号；现阶段不要求专项检查，日常分析仍覆盖已接入指标。'
    result.supplement=false
  }else return null
  if(/数据.*(不足|缺失|没有)|没有.*可比/.test(value) && ['cyl4-watch','drift'].includes(id))result.text='本次没有取得足够可比记录，暂不能判断是否继续变化。保留原关注与最后有效分析；不把数据缺失当作正常或结束依据。'
  return result
}

// Fictional prototype telemetry, not customer measurements.
export const r02Telemetry={
 'cyl4-watch':{labels:['10/08 08:00','10/09 08:00','10/10 08:00','10/11 08:00','10/12 08:00'],values:[424,427,428,429,428],gaps:[4,7,8,8,7]},
 drift:{labels:['10/09 08:00','10/10 08:00','10/11 08:00','10/12 08:00'],values:[425,428,430,432],gaps:[5,8,9,10]},
 'cyl2-ended':{labels:['10/06 08:00','10/07 08:00','10/08 08:00','10/09 08:00','10/10 08:00','10/12 08:00'],values:[429,428,425,423,422,422],gaps:[9,8,5,3,2,2]}
}
for(const [id,report] of Object.entries(r02Reports)) {
 const times=id==='cyl4-watch'?['2026/10/08 08:00','2026/10/09 08:00','2026/10/12 08:00']:id==='drift'?['2026/10/10 08:00','2026/10/12 08:00']:['2026/10/06 08:00','2026/10/08 08:00','2026/10/12 08:00']
 report.timeline.forEach((entry,i)=>{entry.at=times[i]})
}
