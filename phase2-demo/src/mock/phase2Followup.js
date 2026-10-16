import {maintenanceExample as example} from './maintenanceExample.js'
import { r02Report, r02Reports } from './r02Stories.js'
import { maintenanceAssessment } from './phase2SituationContent'

const point = (label, at, actor, text, assessment, current = false) => ({ label, at, actor, text, assessment, done: !current, current })
const taskName = (store, id) => store.todoCreated[id] ? (id === 'drift' && store.progress.drift >= 2 ? store.cases[id].eventTitle : store.cases[id].initialTitle) : '尚未建立待办'

export function maintenanceFollowup(store,planned=false){
 const report=maintenanceAssessment(store,planned),confirmed=store.logs.drift.some(m=>m.id==='injector-demo-evidence')
 return {...report,timeline:(confirmed?example.origins:example.origins.slice(0,2)).map(n=>({...n,done:true,current:false})),arrangement:[{label:'当前安排',text:'前置取证与本次维护分别记录，维护尚待人员决定。'},{label:'来源事件',text:'3号缸排温偏离原事件'},{label:'正式计划',text:example.plan.basis}]}
}

export function attentionFollowup(store, id) {
  const report = attentionFollowupContent(store, id)
  if(id==='drift' && store.todoCreated[id])report.timeline=[...r02Reports.drift.timeline.map(record=>({...record})),...report.timeline.filter(record=>!['首次发现','分析更新 · 新证据'].includes(record.label))]
  if (id === 'maintenance') return report
  const action = store.attentionAction(id), feedback = store.attentionFeedback[id]
  report.recommendation = action.text
  if (id === 'drift' && !store.todoCreated[id]) {
    report.sections = report.sections.map(section=>section.title==='人工补证要回答什么'?{...section,paragraphs:['在右侧询问组件中补充现场排温、运行工况与现场现象，并确认已核对现场仪表。此项核实不需要先创建检查事件。','完整提交后仅完成本次核实要求；普通留言不自动满足要求。需要开展进一步检查或维护时，再经人员明确确认关联事件。']}:section)
    report.arrangement = report.arrangement.map(item => item.label === '当前安排' ? {...item,text:action.text} : item)
    if (feedback) {
      report.conclusion = '现场核实记录已完整提交，后续分析尚未更新；不等于确认或排除具体故障。'
    }
  }
  if (id === 'drift' && feedback) {
    const entry=point('现场核实 · 已提交',feedback.at,'轮机员',`排温 ${feedback.reading}°C；${feedback.conditions}；${feedback.phenomenon}`,'本次核实要求已完成，系统接续分析，不自动创建事件。',!store.todoCreated[id])
    const eventIndex=report.timeline.findIndex(item=>item.label==='人员决定 · 建立检查待办')
    report.timeline.splice(eventIndex<0?report.timeline.length:eventIndex,0,entry)
    if(store.dossierReviews?.[id]){
      const review=store.dossierReviews[id]
      if(!store.todoCreated[id])report.conclusion=review.text
      const reviews=(review.history||[review]).map(entry=>point('研判更新',entry.at,'AI 健康研判',entry.text,'结合现场反馈更新判断；原事实与反馈保留。'))
      const event=report.timeline.findIndex(record=>record.label==='人员决定 · 建立检查待办')
      if(event<0)report.timeline.push(...reviews)
      else report.timeline.splice(event,0,...reviews)
    }
  }
  return report
}
function attentionFollowupContent(store, id) {
  if (id === 'maintenance') return maintenanceFollowup(store)
  const r02=r02Report(store,id)
  if(r02)return r02
  if (id === 'vibration-trend') return {
    conclusion:'机体X向振动小幅变化后持平，Y向没有同步抬升，尚无需要人工响应的新证据，继续由 AI 跟踪。',
    recommendation:'继续比较相近转速与负荷样本；若出现持续单向变化或可复现异响，再请求现场核实。',
    sections:[
      {title:'监测事实与变化范围',paragraphs:['近三轮相近工况下，机体X向振动为2.7、2.8、2.8 mm/s。第二轮有小幅变化，第三轮没有继续扩大；Y向读数未见同步抬升，也没有新增现场异常反馈。','本次判断依据连续变化与方向间关联，不以尚未确认的单点参考范围判定正常或故障。观察重点是变化是否持续、是否扩展到其他方向，以及是否出现现场可复现现象。']},
      {title:'AI 分析如何更新',paragraphs:['首次变化只表明采集值与前一轮不同；第二次比较后出现持平，暂不支持持续劣化的解释。Y向没有同向变化也削弱了机体整体振动同步扩大的证据，但不能单凭一个方向未变化就排除所有局部问题。','因此保持 AI 跟踪。若X向在后续可比样本中继续上行，或其他方向也出现变化，应先核对测点固定和转速、负荷，再结合机体异响、连接状态等现场证据判断是否需要检查待办。']},
      {title:'当前证据与补充反馈',paragraphs:['目前没有已确认的机体异响、松动或振动手感变化记录，这些信息仍属可补充证据，而非已完成的检查结果。轮机员如发现新现象，可直接在助手中补充对应时间和工况，AI 将其与趋势接续比较。']}
    ],
    timeline:[point('首次记录', '第1轮 · 同工况样本', 'AI 状态跟踪', 'X向2.7 mm/s，未出现新增现场异常反馈。', '保留起始样本，作为后续趋势比较依据。'),point('分析更新', '第2轮 · 同工况样本', 'AI 状态跟踪', 'X向2.8 mm/s，Y向未同步抬升。', '单轮小幅变化不足以确定持续上升，继续观察。'),point('当前回顾', '第3轮 · 同工况样本', 'AI 状态跟踪', 'X向仍为2.8 mm/s，变化没有进一步扩大。', '维持 AI 跟踪，当前不请求人工检查。', true)],
    arrangement:[{label:'当前安排',text:'AI 持续比较，无需人工处理'},{label:'下次复核',text:'下一相近转速与负荷的采集窗口'},{label:'请求人工的条件',text:'趋势持续扩大、方向关联变化或新增可复现现场现象'},{label:'关联待办',text:'无；当前没有具体执行任务'}]
  }
  if (id === 'cyl2-ended') return {
    conclusion:'2#缸排温在连续比较中未持续偏离，缸间差值已经收敛，本轮专项观察结束，恢复常规监测。',
    recommendation:'保留三轮变化及结束依据；后续若出现持续偏离或新的现场现象，再重新评估。',
    sections:[
      {title:'本轮监测证据',paragraphs:['三轮相近转速与负荷下，排温依次为420°C、421°C、420°C，与其余缸均值的差值约1°C、1°C、0°C。中间样本小幅上移后回到起始读数，差值没有继续扩大。','本轮没有与这一波动关联的已确认异响、振动或其他现场异常记录，也没有形成需要人员执行的检查事项。']},
      {title:'AI 收束分析',paragraphs:['若单缸热状态持续偏离，通常需要在可比样本中看到偏差持续存在或扩大。本次记录没有形成这样的连续证据，第三轮差值反而收敛，因此不继续把短时波动解释为需要响应的异常。','观察结束来自持续比较后的证据收束，全程没有建立待办或实施维修。设备常规监测继续保留；今后若有新一轮持续变化，应关联历史样本重新判断，不能以本次收束代替后续判断。']}
    ],
    timeline:[point('首次发现', '第1轮 · 同工况样本', 'AI 状态跟踪', '排温420°C，缸间差值约1°C。', '保留为轻微波动关注，启动连续比较。'),point('分析更新', '第2轮 · 同工况样本', 'AI 状态跟踪', '排温421°C，缸间差值仍约1°C。', '读数变化但相对差未扩大，继续自动观察。'),point('观察结束', '第3轮 · 同工况样本', 'AI 状态跟踪', '排温回到420°C，缸间差值约0°C。', '持续偏离证据不成立，结束专项观察，全程未建待办。')],
    arrangement:[{label:'当前安排',text:'专项观察已结束，恢复常规监测'},{label:'下次复核',text:'常规监测窗口；新变化时重新评估'},{label:'结束依据',text:'连续样本未扩大，缸间差值收敛'},{label:'关联待办',text:'无；没有实际检修执行记录'}]
  }
  if (id === 'stable') {
    const step=store.monitorStep.stable, ended=step>=2
    return {
      conclusion:ended ? '三轮压力变化未扩大，末轮收敛至0.39–0.40 MPa；流量与冷却水温未同步恶化，结束本轮专项观察。' : '泵出口压力轻微波动，连续样本未见扩大，流量与冷却水温无同步恶化，现由 AI 跟踪。',
      recommendation:ended ? '恢复常规监测，保留本轮压力及关联量的比较记录；有新证据时重新评估。' : '保持同工况压力与关联量比较；波动持续扩大或出现现场异常后再请求人工确认。',
      sections:[
        {title:'观测范围与证据',paragraphs:['比较对象是海水冷却泵出口压力，选取主机转速约95 rpm、泵组组合不变的样本。初始压力在0.38–0.41 MPa间小幅变化，流量与冷却水温没有同步恶化。',ended ? '第三轮压力收敛至0.39–0.40 MPa。连续样本未形成扩大过程，关联量也未补充劣化证据。' : step>=1 ? '第二轮同工况比较未见波动扩大，流量与水温保持原有表现。当前没有新增的已确认泵体异响、泄漏或现场压力表差异。' : '目前只有初始波动与关联量记录，尚未取得更多连续样本。没有把未来观测结果预先作为当前结论。']},
        {title:'AI 分析与解释范围',paragraphs:['单一压力点的变化可能受吸入侧扰动、海况、泵组工况及测量离散影响。流量与水温未出现同向变化，说明当前证据不足以支持冷却供给能力持续恶化的解释；具体波动来源仍不能仅凭这些数据确认。',ended ? '后续可比样本未见扩大并出现收敛，使本轮继续专项跟踪的必要性降低。AI 据此结束本轮观察，而非确认完成了一次维修。' : '当前策略是继续自动比较，而不是先建故障任务。后续若压力波动扩大且流量下降、水温上升或异响同步出现，证据组合发生变化，才请求人员核实真实性及响应需要。']},
        {title:'可补充的现场材料',paragraphs:['如人员发现泵体异响、泄漏、压力表读数差异或泵组切换，可在助手中补充时间、现场现象及当时工况。这些反馈会接续原异动跟踪材料；当前未取得的检查结果不会写成已确认事实。']}
      ],
      timeline:[point('首次发现', '第1日 · 同工况样本', 'AI 状态跟踪', '压力0.38–0.41 MPa，流量与冷却水温稳定。', '先保留压力关注，不形成故障结论。',step===0),...(step>=1?[point('分析更新', '第2日 · 同工况复测', 'AI 状态跟踪', '压力波动未扩大，关联流量和水温无恶化。', '证据仍不支持人工检修，维持自动观察。',step===1)]:[]),...(ended?[point('观察收束', '第3日 · 同工况复测', 'AI 状态跟踪', '压力收敛至0.39–0.40 MPa，关联量未见同步变化。', '结束专项观察，恢复常规监测，全程未建立待办。')]:[])],
      arrangement:[{label:'当前安排',text:ended?'观察已结束':'AI 持续跟踪，无需人工执行'},{label:'下次复核',text:ended?'常规监测窗口':'下一同工况监测窗口'},{label:'请求人工的条件',text:'波动扩大并伴随关联量变化，或新增现场异常'},{label:'关联待办',text:'无；本轮尚未形成检修任务'}]
    }
  }
  const escalated=store.monitorStep.drift>0, created=store.todoCreated.drift, established=created&&store.progress.drift>=2, diagnosed=store.progress.drift>=4, handled=store.isTaskHandled('drift')
  const conclusion=handled?store.getObservationResult('drift').text:diagnosed?'喷油器积炭与喷雾异常已由现场排查确认，气阀检查未见异常，现沿关联事件执行维修。':established?'现场读数一致、轻微异响可复现，已确立需要响应的异常；具体原因由关联事件继续排查。':created?'检查待办已建立，正在补齐现场读数与可复现现象；是否确立异常仍待检查结果。':escalated?'排温相对差由8°C扩大至10°C并出现轻微波动，建议人工核实异动真实性与响应需要。':'3#缸排温相对偏高，当前只有监测证据，继续 AI 跟踪。'
  const recommendation=handled?'继续对照原排温差与异响验证持续效果，按观测建议收束、补证或复查。':diagnosed?'按已确认原因完成喷油器处理，记录喷雾、密封和同工况排温验收结果。':established?'进入关联事件的候选原因与排查，补齐喷油器及气阀证据。':created?'在关联待办中完成仪表核对及现场现象检查。':escalated?'请决定是否建立检查待办；确认后先补现场证据，再判断异常是否成立。':'继续比较同工况排温与相对差；新证据出现后再请求人工确认。'
  return {conclusion,recommendation,
    sections:[
      {title:'监测事实与本次变化',paragraphs:['首次同工况比较，3#缸排温428°C，比其余缸平均值约高8°C，尚无已确认异响或振动记录。相对差用于识别单缸是否与其他缸共同升温，而非仅看一条温度读数。',escalated?'后续可比样本中排温432°C、相对差10°C，并出现轻微波动。与首次相比，偏差扩大且波形发生变化；当前仍低于既有450°C AMS报警线，但告警状态不能替代异动真实性判断。':'目前仍在收集连续可比样本，尚未将未来的偏差扩大或现场异常写入已知证据。']},
      {title:'AI 研判与尚未确认的解释',paragraphs:[escalated?'相同转速与负荷下，单缸相对偏差继续扩大，更值得核验该缸燃烧、排气或测量链路是否存在变化。当前趋势不能直接把原因锁定为某一部件，需要由不同类型的现场结果区分。':'单轮相对偏高可能受工况与测量差异影响，尚未形成持续偏离或现场异常互证。当前保留关注，等待连续样本判断变化是否扩大。',diagnosed?'喷油器检查已发现喷孔积炭、喷雾不良，排气阀密封检查未见异常，两项证据使原因范围收敛至喷油器雾化问题；维修效果仍需排温差与原异响共同验证。':'喷油器雾化、排气阀密封和测点偏差是需要分别验证的方向：喷雾/回油提供燃烧侧证据，密封检查提供气阀证据，现场与采集读数比对核实测量链路。尚未取得的结果不能作为已排除原因。']},
      {title:established?'现场补证与事件确立':'人工补证要回答什么',paragraphs:[established?'轮机员已确认现场仪表与系统读数一致，轻微异响可复现。监测与现场两类证据共同支持异动真实且需要响应，已由检查待办接续到异常事件。':'先核对现场仪表与系统采集值是否一致，再记录3#缸附近异响或振动是否可复现、出现时间和对应工况。这次检查回答异常是否真实、是否需要响应，尚不负责确定根因。',established?'异常确立后，原关注继续保留，并与具体排查事件关联。后续人员检查和维修结果反向更新关注状态；处理完成后转回 AI 效果观察。':'人员同意后才建立检查待办；读数差异或不可复现的现象应保留为待验证证据，结合后续数据重新评估，不直接确立故障。']}
    ],
    timeline:[point('首次发现', '第1日 · 08:00', 'AI 状态跟踪', '排温428°C，相对其余缸高约8°C，无已确认现场异常。', '建立持续关注，保留相对差与工况样本。'),...(escalated?[point('分析更新 · 新证据', '第2日 · 08:00', 'AI 状态跟踪', '排温432°C，相对差扩大至10°C，并出现轻微波动。', '建议由 AI 跟踪转为待人工确认，请求现场核对读数及可复现现象。',!created)]:[]),...(created?[point('人员决定 · 建立检查待办', '人员确认后', '轮机员', '已同意开展现场检查，原排温变化及建议关联到待办。', '待办负责补齐真实性证据，尚不等于异常已经确立。',!established)]:[]),...(established?[point('现场反馈 · 异常确立', '检查反馈确认后', '轮机员 → AI', '现场读数与采集值一致，轻微异响可复现。', '异常真实且需要响应，接续为具体排查事件。',!diagnosed)]:[]),...(diagnosed?[point('排查反馈 · 原因收敛', '排查反馈确认后', '轮机员 → AI', '喷油器喷孔积炭、喷雾不良，排气阀检查未见异常。', '建议针对喷油器处理，异动跟踪材料与事件排查共用原证据。',!handled)]:[]),...(handled?[point('处理完成 · 转回观察', '维修验收后', '轮机员 → AI', '喷油器处理验收已提交，首测排温差3°C、排温425°C，异响未再复现。', store.getObservationResult('drift').text,true)]:[])],
    arrangement:[{label:'当前安排',text:handled?store.getObservationResult('drift').title:diagnosed?'执行已确认的喷油器维修':established?'沿关联事件排查原因':created?'补齐现场检查证据':escalated?'等待是否开展现场检查的决定':'AI 持续跟踪'},{label:'负责与接续',text:handled?'AI 效果跟踪；出现新异常时请求人员复查':created?'轮机员检查或处置，AI 接续反馈':'AI 跟踪；需补证时通知轮机员'},{label:'下次复核',text:handled?'按24小时效果窗口持续记录':created?'现场反馈提交后更新建议':'下一同工况监测窗口；新现场现象可随时补充'},{label:'关联待办',text:taskName(store,'drift')}]
  }
}

export function followupConversation(report, topic) {
  return [...report.timeline.map((entry,index)=>({role:'assistant',kind:'scene',at:entry.at,demoLabel:entry.actor,title:entry.label,paragraphs:[{label:'观测或反馈',text:entry.text},{label:'研判更新',text:entry.assessment}],question:index===report.timeline.length-1?'当前建议与安排见下方。':''})),{role:'assistant',kind:'scene',at:'当前',demoLabel:'当前建议与安排',title:topic,paragraphs:[{label:'当前结论',text:report.conclusion},{label:'下一步建议',text:report.recommendation},{label:'后续复核',text:report.arrangement.find(item=>item.label==='下次复核')?.text}],question:'有新的现场情况，可直接补充；已确认的材料将与关联待办接续。'}]
}
