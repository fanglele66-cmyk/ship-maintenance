import { defineStore } from 'pinia'
import { computed, reactive, ref, watch } from 'vue'
import { useSensorStore } from '@/stores/sensorStore'
import { attentionItems, scenarioCases } from '@/mock/phase2Scenarios'
import { attentionScene, stageScene, causeContent } from '@/mock/phase2Content'
import { observationConfig, observationResult, observationScene } from '@/mock/phase2Observation'
import { shipSituationReply } from '@/mock/phase2ShipConversation'

export const usePhase2DemoStore = defineStore('phase2-demo', () => {
  const attention = attentionItems
  const cases = scenarioCases
  const selectedAttentionId = ref('maintenance')
  const selectedTodoId = ref(null)
  const todoCreated = reactive({ maintenance: false, drift: false, fault: true })
  const progress = reactive({ maintenance: 0, drift: 0, fault: 0 })
  const activeStage = reactive({ maintenance: 0, drift: 0, fault: 0 })
  const monitorStep = reactive({ stable: 0, drift: 1 })
  const logs = reactive({ ship: [], device: [], sensor: [], maintenance: [], stable: [], drift: [], 'cyl2-ended': [], 'vibration-trend': [], fault: [] })
  const inputDraft = ref('')
  const detailTab = ref('概览')
  const attentionInFocus = ref(false)
  const regularMaintenanceInFocus = ref(false)
  const situationObservationId = ref(null)
  const observationTimers = {}
  const openedStages = reactive({})
  const recordDrafts = reactive({})
  const taskResults = reactive({})
  const taskNotes = reactive({})
  const taskAttachments = reactive({})
  const workAcceptance = reactive({})
  const workAcceptanceNotes = reactive({})
  const observationReady = reactive({ maintenance:false, drift:false, fault:false })
  const observationRounds = reactive({ maintenance:1, drift:1, fault:1 })
  const observationRecords = reactive({ maintenance:[], drift:[], fault:[] })
  const observationHistory = reactive({ maintenance:[], drift:[], fault:[] })
  const observationTargets = reactive({ maintenance:2, drift:1, fault:1 })
  const situationVersions = reactive({})
  const dataViews = reactive({})
  const sensors=useSensorStore()
  watch(()=>[progress.fault,progress.drift,progress.maintenance,monitorStep.stable,monitorStep.drift,observationRecords.fault.at(-1),observationRecords.drift.at(-1),observationRecords.maintenance.at(-1)],()=>{
    const outlet=sensors.allSensors.find(s=>s.id==='s-007'),exhaust=sensors.allSensors.find(s=>s.id==='s-005')
    const coolingFlow=sensors.allSensors.find(s=>s.id==='s-017'),pumpPressure=sensors.allSensors.find(s=>s.id==='s-015')
    const bearingVibration=sensors.allSensors.find(s=>s.id==='s-018'),bearingTemperature=sensors.allSensors.find(s=>s.id==='s-019')
    const faultRecord=observationRecords.fault.filter(r=>r.values).at(-1),driftRecord=observationRecords.drift.filter(r=>r.values).at(-1)
    const maintenanceRecord=observationRecords.maintenance.filter(r=>r.values).at(-1)
    if(outlet){outlet.value=progress.fault>=3?(faultRecord?.values[0]??79.1):92.4;outlet.status=outlet.value>85?'over':'normal'}
    if(coolingFlow){coolingFlow.value=progress.fault>=3?(faultRecord?.values[1]??86.5):68.2;coolingFlow.status=coolingFlow.value<80?'over':'normal'}
    if(exhaust)exhaust.value=progress.drift>=5?(driftRecord?.values[1]??425):monitorStep.drift?432:428
    if(pumpPressure)pumpPressure.value=monitorStep.stable>=2?0.395:0.40
    if(bearingVibration){bearingVibration.value=progress.maintenance>=3?(maintenanceRecord?.values[0]??2.2):3.0;bearingVibration.status=progress.maintenance>=3?'normal':'warning'}
    if(bearingTemperature)bearingTemperature.value=progress.maintenance>=3?(maintenanceRecord?.values[1]??64):65
  },{immediate:true,deep:true})

  const selectedAttention = computed(() => attention.find(item => item.id === selectedAttentionId.value) || attention[0])
  const selectedTodo = computed(() => selectedTodoId.value ? cases[selectedTodoId.value] : null)
  const visibleTodos = computed(() => ['fault', 'maintenance', 'drift'].filter(id => todoCreated[id]).map(id => cases[id]))
  function observationIndex(id) { return cases[id].stages.findIndex(stage => stage.kind === 'observe') }
  function isTaskHandled(id) { return Boolean(cases[id]) && progress[id] >= observationIndex(id) }
  const effectObservations = computed(() => visibleTodos.value.filter(item => isTaskHandled(item.id)))
  const caseMaterials = computed(() => Object.fromEntries(visibleTodos.value.filter(item=>isTaskHandled(item.id)||observationHistory[item.id].length).map(item => [item.id, {
    sourceId: 'EVT-ME-' + ({fault:'001',maintenance:'002',drift:'003'})[item.id],
    sourceTitle: item.id === 'drift' ? item.eventTitle : item.initialTitle,
    status: '待岸端审阅',
    content: '已自动汇集原始证据、原因分析、人员反馈和实际措施；后续效果记录继续关联补充。'
  }])))
  function handledReceipt(id) {
    const work = cases[id].stages[observationIndex(id) - 1]
    return { id:'handled', kind:'handled', label:'处理完成', title:'本轮人工处理已完成', summary:'现场措施与验收已提交，待办记为已处理。', evidence:work.evidence, judgement:'处理后的持续效果由设备态势跟踪，事件保留本轮检查、处置和人员反馈。' }
  }
  const currentStage = computed(() => {
    const id = selectedTodoId.value, selected = selectedTodo.value?.stages[activeStage[id]]
    return selected && ['observe','closed'].includes(selected.kind) ? handledReceipt(id) : selected || null
  })
  function selectObservation(id) { if(!isTaskHandled(id))return; situationObservationId.value=id; attentionInFocus.value=false; startObservation(id); scheduleObservation(id) }
  function clearObservationFocus() { situationObservationId.value=null }
  function completeObservation(id) {
    if (!isTaskHandled(id) || getObservationResult(id).type !== 'archive') return
    if (progress[id] === cases[id].stages.length - 1) return
    const wasInReceipt=activeStage[id]>=observationIndex(id)
    progress[id]=cases[id].stages.length-1
    if(wasInReceipt)activeStage[id]=progress[id]
    observationReady[id]=true
    addLog(id,'assistant','本轮效果观察已自动结束，记录关联至来源事件；案例材料保留在岸端待审阅队列。')
  }
  function scheduleObservation(id) {
    if (observationTimers[id] || !isTaskHandled(id) || getObservationResult(id).type !== 'continue') return
    observationTimers[id]=setTimeout(() => {
      delete observationTimers[id]
      if (!isTaskHandled(id)) return
      reviewObservation(id)
      if (getObservationResult(id).type === 'archive') completeObservation(id)
      else scheduleObservation(id)
    },4800)
  }
  function sendObservation(text) {
    const id=situationObservationId.value, value=text.trim()
    if (!id || !value) return
    addLog(id,'user',{text:value,observationContext:true})
    const noIssue=/没有.*异常|未见.*异常|未再.*反复|未再.*异响|无异常|无反复|无异响/.test(value)
    if (!noIssue && /再次|反复|又升|仍有异响|未恢复/.test(value)) recordObservationEvidence(id,'abnormal',value)
    else if (/数据缺失|数据不足|采集不全|工况不同/.test(value)) recordObservationEvidence(id,'incomplete',value)
    else addLog(id,'assistant',{kind:'scene',observationContext:true,...observationScene(id,observationRecords[id],observationTargets[id])})
  }

  function addLog(id, role, text) {
    logs[id].push({ role, ...(typeof text === 'string' ? { text } : text), at: new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }) })
  }

  function selectAttention(id) {
    selectedAttentionId.value = id
    inputDraft.value = ''
    const item = attention.find(entry => entry.id === id)
    if (!logs[id].length) {
      addLog(id, 'user', `查看${item.title}`)
      addLog(id, 'assistant', { kind: 'scene', ...attentionScene(id, monitorStep[id] || 0) })
    }
  }

  function createTodo(id) {
    if (!['maintenance', 'drift'].includes(id) || todoCreated[id]) return false
    if (id === 'drift' && monitorStep.drift < 1) return false
    todoCreated[id] = true
    addLog(id, 'assistant', `已建立“${cases[id].initialTitle}”待办。请到待办中心查看概览并继续处理；原关注证据已带入同一任务。`)
    return true
  }

  function sendAttention(text) {
    const id = selectedAttentionId.value
    const value = text.trim()
    if (!value) return
    addLog(id, 'user', value)
    inputDraft.value = ''
    if (/暂不|不需要|不要|不建|不同意|先不|取消|不能确认|不确定|未确认|暂缓|稍后/.test(value)) {
      addLog(id,'assistant',todoCreated[id]?'已有待办保留，暂不推进处理。':'已保留当前关注，继续系统监测；本次不建立待办。')
      return
    }
    if (!/[?？]|是否|要不要|能否|可否/.test(value) && (/确认.*待办|同意.*待办|请.*建立|帮我.*建立|为我.*建立|^建立.*待办|^建.*待办/.test(value)||/^(好的|可以|同意|确认|建吧)[。！!\s]*$/.test(value))) {
      if(todoCreated[id]){addLog(id,'assistant','这条待办已经建立，可在待办中心继续处理。');return}
      if (createTodo(id)) return
      addLog(id, 'assistant', id === 'stable' ? '目前只有系统监测，没有人工处理事项，暂不生成待办。' : id === 'drift' ? '当前证据还未达到现场确认条件。我会继续自动比对同工况数据；若偏差扩大，会主动推送新证据，再由你决定是否建立检查待办。' : '这条待办已建立，可到待办中心继续。')
      return
    }
    if(todoCreated[id]){addLog(id,'assistant',{kind:'scene',...sceneFor(id,cases[id].stages[progress[id]])});return}
    if (id === 'cyl2-ended' || id === 'vibration-trend') {
      addLog(id, 'assistant', {kind:'scene', ...attentionScene(id, 0)})
      return
    }
    if (id === 'drift' && /异响|振动|现场/.test(value)) {
      addLog(id, 'assistant', '已记录现场线索。建议先核对仪表读数并确认异响是否可复现；偏差扩大后可建立检查待办。')
      return
    }
    addLog(id, 'assistant', { kind: 'scene', ...attentionScene(id, monitorStep[id] || 0) })
  }

  function nextMonitor(id) {
    if (id === 'stable' && monitorStep.stable < 2) {
      monitorStep.stable += 1
      addLog(id, 'assistant', { kind: 'scene', ...attentionScene(id, monitorStep.stable) })
    }
    if (id === 'drift' && monitorStep.drift < 1) {
      monitorStep.drift = 1
      addLog(id, 'assistant', { kind: 'scene', ...attentionScene(id, 1) })
    }
  }

  function selectTodo(id) {
    selectedTodoId.value = id
    activeStage[id] = progress[id]
    inputDraft.value = ''
    openStageConversation(id)
  }

  function closeTodo() { selectedTodoId.value = null }

  function selectStage(id, index) {
    if (index <= progress[id]) { activeStage[id] = index; openStageConversation(id) }
  }

  function openStageConversation(id) {
    const rawStage = cases[id].stages[activeStage[id]]
    const stage = ['observe','closed'].includes(rawStage.kind) ? handledReceipt(id) : rawStage
    if (stage.kind === 'handled') { startObservation(id); scheduleObservation(id) }
    const key = `${id}:${stage.id}`
    if (openedStages[key]) return
    openedStages[key] = true
    addLog(id, 'user', stage.kind === 'handled' ? '查看处理结果' : stage.kind === 'overview' ? id==='maintenance'?'查看维保建议':stage.id==='attention'?'查看关注事项当前情况':'查看事件当前情况' : `进入${stage.label}`)
    addLog(id, 'assistant', { kind: 'scene', stageId: stage.id, ...sceneFor(id, stage) })
  }

  function advanceTodo(id, feedback = []) {
    const stage = cases[id].stages[activeStage[id]]
    if (!stage?.action) return
    if(activeStage[id]<progress[id]){selectStage(id,activeStage[id]+1);return}
    if(stage.kind==='observe'&&getObservationResult(id).type!=='archive')return
    if (feedback.length) addLog(id, 'assistant', { kind:'feedbackRecord', title:`${stage.label}反馈已提交`, task:stage.title, records:feedback })
    const next = activeStage[id] + 1
    progress[id] = Math.max(progress[id], next)
    activeStage[id] = next
    delete recordDrafts[id]
    addLog(id, 'assistant', stage.reply)
    openStageConversation(id)
  }

  function sendTodo(text) {
    const id = selectedTodoId.value
    if (!id || !text.trim()) return
    addLog(id, 'user', text.trim())
    inputDraft.value = ''
    const stage = cases[id].stages[activeStage[id]]
    if(isTaskHandled(id)){addLog(id,'assistant','本轮人工处理已完成。持续观测由设备态势自动跟踪；案例材料已按事件来源汇集，等待岸端审阅。');return}
    if(activeStage[id]<progress[id]){addLog(id,'assistant','当前显示已完成阶段，原反馈已保留。请切换到当前阶段后补充新的处理记录。');return}
    if (recordDrafts[id] && /^(确认|同意|确认以上记录|记录以上|确认记录|确认并继续)[。！!\s]*$/.test(text)) { confirmQuickRecord(id); return }
    if (/取消|暂不|先不|不同意/.test(text)) { delete recordDrafts[id]; logs[id].filter(m=>m.kind==='recordDraft'&&!m.confirmed).forEach(m=>m.cancelled=true);addLog(id,'assistant','已暂缓推进，当前阶段保留。您可以补充或修改现场反馈。'); return }
    if (/数据|趋势/.test(text) && stage.kind === 'overview' && id !== 'maintenance') {
      detailTab.value = '数据观测'
      addLog(id,'assistant',{kind:'scene',title:'数据观测',paragraphs:[{label:'关联变化',text:id==='fault'?'出口温度与温差升高，流量下降，进口温度相对稳定。可打开多选视图，将温度与流量同时勾选比对。':'3#缸排温与其余缸的相对差正在扩大。可同时勾选两条排温曲线，观察同一时间点的差异。'}],question:'这些变化发生时，现场负荷或运行工况有变化吗？'})
      return
    }
    if (/原因|可能性/.test(text) && stage.id === 'event') {
      detailTab.value='候选原因'
      const content=causeContent[id]
      addLog(id,'assistant',{kind:'scene',title:'候选原因',paragraphs:[{label:'判断依据',text:content.mechanism},{label:'排查顺序',text:content.rows.map(r=>`${r.name}：${r.check}`).join('；')}],question:'现场是否具备开始排查的条件？也可补充已有检查结果。'})
      return
    }
    if (['check','work'].includes(stage.kind) && /发现|检查了|已完成|处理了|更换|清洗|清洁|复装|校验|拆检|复测|读数|确认一致|异响/.test(text)) {
      const destination = stage.kind==='work' ? 'observe' : cases[id].stages[activeStage[id]+1]?.id
      const parts=[...(/^补充|^另外/.test(text)&&recordDrafts[id]?recordDrafts[id].records.map(r=>r.result):[]),...text.split(/[。；\n]+/).map(t=>t.trim()).filter(Boolean)]
      const hasProblem=/未消失|未完成|待复核|待补充|不一致|未恢复|仍有|无法/.test(stage.kind==='work'?parts.at(-1):text)
      const evidenceText=parts.join('；')
      const evidenceOk=stage.kind==='work'? /复测|校验|试运转/.test(evidenceText)&&/合格|正常|稳定|恢复|无泄漏|2\.2|79\.1|86\.5|3°C/.test(evidenceText)&&/清洗|清洁|更换|处理/.test(evidenceText): id==='maintenance'?/偏磨/.test(evidenceText)&&/间隙/.test(evidenceText)&&/备件/.test(evidenceText): id==='drift'&&stage.id==='check'?/一致/.test(evidenceText)&&/异响/.test(evidenceText)&&/复现/.test(evidenceText):id==='fault'?/滤器/.test(evidenceText)&&/堵塞|脏污/.test(evidenceText)&&/温控阀/.test(evidenceText)&&/正常|未见异常/.test(evidenceText):/喷油器/.test(evidenceText)&&/积炭/.test(evidenceText)&&/排气阀/.test(evidenceText)&&/正常|未见异常/.test(evidenceText)
      const draft={kind:'recordDraft',title:'现场反馈待确认',task:stage.title,stageId:stage.id,destination,canAdvance:evidenceOk&&!hasProblem,records:parts.map((p,i)=>({label:stage.tasks.find(t=>p.includes(t.label.slice(2,5)))?.label||`${stage.kind==='work'?'处理':'检查'}反馈 ${i+1}`,result:p,note:''})),confirmed:false}
      logs[id].filter(m=>m.kind==='recordDraft'&&!m.confirmed).forEach(m=>m.cancelled=true)
      recordDrafts[id]=draft
      addLog(id,'assistant',draft)
      return
    }
    addLog(id, 'assistant', {kind:'scene',...sceneFor(id,stage)})
  }

  function confirmQuickRecord(id) {
    const draft=recordDrafts[id]
    if(!draft)return
    const current=cases[id].stages[activeStage[id]]
    if(current.id!==draft.stageId){addLog(id,'assistant','当前阶段已经变化，请在对应阶段重新确认这份记录。');return}
    draft.confirmed=true
    logs[id].filter(m=>m.kind==='recordDraft'&&m.stageId===draft.stageId).forEach(m=>m.confirmed=true)
    addLog(id,'assistant',{kind:'feedbackRecord',title:'现场反馈已登记',task:draft.task,records:draft.records})
    if(!draft.canAdvance){addLog(id,'assistant','反馈已保存。当前内容尚不足以完成本轮判断，请继续补齐左侧各项检查或验收结果；当前阶段暂不推进。');delete recordDrafts[id];return}
    const next=cases[id].stages.findIndex(s=>s.id===draft.destination)
    ;(current.tasks||[]).forEach((task,i)=>{taskResults[`${id}:${current.id}:${i}`]='已通过现场反馈完成';taskNotes[`${id}:${current.id}:${i}`]=draft.records.map(r=>r.result).join('；')})
    if(next>=0){progress[id]=Math.max(progress[id],next);activeStage[id]=next;openStageConversation(id)}
    delete recordDrafts[id]
  }

  function startObservation(id){
    if(observationRecords[id].length)return
    observationRecords[id].push({day:0,label:'处理后首测',values:[...observationConfig[id].samples[0]],status:'normal',note:'现场验收后记录，待验证持续效果'})
  }
  function getObservationResult(id){return observationResult(id,observationRecords[id],observationTargets[id])}
  function sceneFor(id,stage){if(stage.kind==='handled')return {title:'本轮处理已完成',paragraphs:[{label:'已提交措施',text:cases[id].stages[observationIndex(id)-1].title},{label:'后续跟踪',text:'现场验收记录已保存，设备态势将自动记录处理后趋势并判断是否稳定。待办保留本轮人工处理结果。'},{label:'案例材料',text:'来源：'+caseMaterials.value[id].sourceId+' · '+caseMaterials.value[id].sourceTitle+'。原始证据、现场反馈与处理措施已自动汇集，待岸端审阅；岸端可补充建议、修改或直接沉淀。'}]};if(stage.kind==='observe')return observationScene(id,observationRecords[id],observationTargets[id]);if(stage.kind==='closed'){const scene=stageScene(id,stage);scene.paragraphs.push({label:'观察结论',text:getObservationResult(id).text});return scene}return stageScene(id,stage)}
  function reviewObservation(id){
    if(!isTaskHandled(id)||getObservationResult(id).type!=='continue')return
    startObservation(id)
    const day=observationRecords[id].at(-1).day+1,c=observationConfig[id]
    observationRecords[id].push({day,label:`第${day}日`,values:[...c.samples[Math.min(day,c.samples.length-1)]],status:'normal',note:id==='drift'?'同工况偏差收敛，未见异响复现':'同工况复测稳定，未见原异常反复'})
    observationReady[id]=getObservationResult(id).type==='archive'
    addLog(id,'assistant',{kind:'scene',...observationScene(id,observationRecords[id],observationTargets[id])})
  }
  function recordObservationEvidence(id,status,text){
    startObservation(id)
    const day=observationRecords[id].at(-1).day
    observationRecords[id].push({day,label:`第${day}日补充`,values:status==='abnormal'?[...observationConfig[id].abnormal]:null,status,note:text})
    observationReady[id]=false
    addLog(id,'assistant',{kind:'scene',...observationScene(id,observationRecords[id],observationTargets[id])})
  }
  function extendObservation(id){
    if(getObservationResult(id).type!=='extend')return
    const day=observationRecords[id].at(-1).day+1,c=observationConfig[id]
    observationTargets[id]=Math.max(observationTargets[id],day-1)+1
    observationRecords[id].push({day,label:`第${day}日`,values:[...c.samples[Math.min(day,c.samples.length-1)]],status:'normal',note:'延长跟踪24小时后，同工况记录已补齐，未见原异常反复'})
    observationReady[id]=getObservationResult(id).type==='archive'
    addLog(id,'assistant',{kind:'scene',...observationScene(id,observationRecords[id],observationTargets[id])})
    if(observationReady[id])completeObservation(id);else scheduleObservation(id)
  }
  function reopenTodo(id){
    delete openedStages[id+':handled']
    if(observationTimers[id]){clearTimeout(observationTimers[id]);delete observationTimers[id]}
    if(getObservationResult(id).type!=='reinspect')return
    const index=cases[id].stages.findIndex(s=>s.id===(id==='maintenance'?'check':'investigate'))
    observationHistory[id].push({round:observationRounds[id],records:observationRecords[id].map(r=>({...r}))})
    observationRecords[id].splice(0);observationTargets[id]=observationConfig[id].days;observationRounds[id]++
    progress[id]=index;activeStage[id]=index;observationReady[id]=false;delete recordDrafts[id]
    cases[id].stages.slice(index).forEach(s=>{delete openedStages[`${id}:${s.id}`];(s.tasks||[]).forEach((_,i)=>{delete taskResults[`${id}:${s.id}:${i}`];delete taskNotes[`${id}:${s.id}:${i}`];delete taskAttachments[`${id}:${s.id}:${i}`]})})
    const workKey=`${id}:${id==='maintenance'?'service':'repair'}`;delete workAcceptance[workKey];delete workAcceptanceNotes[workKey]
    addLog(id,'assistant','观察期内出现反复，已重新打开现场核实。历史观测与反馈保留，需重新提交本轮检查和处理结果。');openStageConversation(id)
  }

  function enterSituation(mode) {
    const version=JSON.stringify([progress,monitorStep,todoCreated])
    if(!logs[mode]||situationVersions[mode]===version)return
    situationVersions[mode]=version
    if(mode!=='ship')addLog(mode,'user',mode==='device'?'查看主机的近期态势情况':'查看当前传感器趋势')
    addLog(mode,'assistant',{kind:'scene',title:mode==='ship'?'船舶运行概况 · 自动播报':mode==='device'?'主机每日健康回顾':'传感器趋势',paragraphs:mode==='ship'?[{label:'运行概要',text:'远洋6号当前航行中，接入10台设备，4台重点设备在线展示。'},{label:'关注分布',text:`主机有${(monitorStep.stable<2?1:0)+(todoCreated.drift?0:1)}项持续监测、${todoCreated.maintenance?0:1}项待确认维保建议，${visibleTodos.value.filter(t=>!isTaskHandled(t.id)).length}项未处理待办。`}]:mode==='device'?[{label:'当前结论',text:`${todoCreated.drift?(progress.drift>=2?'3#缸异常已确立，排查由关联待办接续，持续效果由设备态势跟踪':'3#缸检查待办已建立，等待现场确认'):'3#缸排温单缸偏离正在监测'}；${monitorStep.stable===2?'海水冷却泵压力跟踪已收束':'海水冷却泵压力轻微波动'}。`},{label:'计划与执行',text:`1#缸连杆轴承${todoCreated.maintenance?'维保待办已建立':'有1项提前维保建议'}；冷却水温异常${progress.fault===4?'已闭环':'仍需跟进'}。`}]:[{label:'数据查看',text:'可切换传感器、时间范围或多趋势对比，查看同一工况下的变化。'}],question:mode==='ship'?'以下为系统连续推送的设备变化、证据与待办建议。':mode==='device'?'优先核对3#缸异动和冷却系统处理进展；稳定监测仍由系统持续跟踪。有现场发现可以直接补充。':'哪个时间段或现场现象需要一起核对？'})
  }

  function sendSituation(text, mode) {
    const id = mode === 'sensor' ? 'sensor' : mode === 'device' ? 'device' : 'ship'
    const value = text.trim()
    if (!value) return
    addLog(id, 'user', value)
    if (mode === 'ship') {
      addLog(id, 'assistant', { ...shipSituationReply({ progress, monitorStep, todoCreated, cases, visibleTodos: visibleTodos.value, isTaskHandled, getObservationResult, observationRecords, observationTargets }, value), shipFollowup: true })
      return
    }
    if (/维保|轴承|1#缸/.test(value)) addLog(id, 'assistant', '1号主机的1#缸连杆轴承接近计划检修时数，振动缓升。请进入设备层“维保”查看建议，并决定是否建立人工检查待办。')
    else if (/关注|排温|3#缸/.test(value)) addLog(id, 'assistant', '1号主机有两项系统关注：3#缸排温偏离和海水冷却泵压力波动。请进入设备层“关注”比较后续变化。')
    else addLog(id, 'assistant', mode === 'sensor' ? '可在左侧选择传感器查看趋势；设备层的关注和维保建议保留在上一层。' : '请先进入左侧1号主机设备层。系统监测、维保建议和人工待办会分别呈现。')
  }

  function resetDemo() {
    Object.values(observationTimers).forEach(clearTimeout)
    Object.keys(observationTimers).forEach(id=>delete observationTimers[id])
    situationObservationId.value=null
    selectedAttentionId.value = 'maintenance'
    selectedTodoId.value = null
    todoCreated.maintenance = false
    todoCreated.drift = false
    progress.maintenance = 0
    progress.drift = 0
    progress.fault = 0
    activeStage.maintenance = 0
    activeStage.drift = 0
    activeStage.fault = 0
    regularMaintenanceInFocus.value = false
    monitorStep.stable = 0
    monitorStep.drift = 1
    Object.keys(logs).forEach(id => { logs[id].splice(0) })
    Object.keys(openedStages).forEach(key=>delete openedStages[key])
    Object.keys(recordDrafts).forEach(key=>delete recordDrafts[key])
    Object.keys(situationVersions).forEach(key=>delete situationVersions[key])
    ;[taskResults,taskNotes,taskAttachments,workAcceptance,workAcceptanceNotes].forEach(data=>Object.keys(data).forEach(key=>delete data[key]))
    ;['maintenance','drift','fault'].forEach(id=>{observationReady[id]=false;observationRounds[id]=1;observationRecords[id].splice(0);observationHistory[id].splice(0);observationTargets[id]=observationConfig[id].days})
    selectAttention('maintenance')
  }

  selectAttention('maintenance')
  return { observationIndex, isTaskHandled, effectObservations, caseMaterials, situationObservationId, selectObservation, clearObservationFocus, sendObservation, completeObservation, attention, cases, selectedAttentionId, selectedAttention, selectedTodoId, selectedTodo, visibleTodos, todoCreated, progress, activeStage, currentStage, monitorStep, logs, inputDraft, detailTab, attentionInFocus, regularMaintenanceInFocus, recordDrafts, taskResults, taskNotes, taskAttachments, workAcceptance, workAcceptanceNotes, dataViews, observationRecords, observationHistory, observationTargets, getObservationResult, observationReady, observationRounds, reviewObservation, extendObservation, reopenTodo, confirmQuickRecord, enterSituation, selectAttention, createTodo, sendAttention, sendSituation, nextMonitor, selectTodo, closeTodo, selectStage, advanceTodo, sendTodo, resetDemo }
})
