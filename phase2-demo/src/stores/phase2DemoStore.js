import {isMaintenanceWorkflow,isTrackingContainer,parentIssueId} from '@/mock/issueRelationships'
import {sourceTrack,storyDate,healthStoryMarkdown} from '@/mock/storyRecords'
import additionalScenarios from '@/mock/additionalScenarios.json'
import { defineStore } from 'pinia'
import { computed, reactive, ref, watch } from 'vue'
import { useSensorStore } from '@/stores/sensorStore'
import { attentionItems, scenarioCases } from '@/mock/phase2Scenarios'
import { attentionScene, stageScene, causeContent } from '@/mock/phase2Content'
import { observationConfig, observationResult, observationScene } from '@/mock/phase2Observation'
import { r02Reply, r02InitialMessage } from '@/mock/r02Stories'
import { shipSituationReply } from '@/mock/phase2ShipConversation'
import { deviceHealthReply } from '@/mock/r05Overview'
import { eventQuestionReply } from '@/mock/r06Events'
import executionRecordTemplate from '@/message-flows/execution-record.json'
import { validateInquiry } from '@/message-flows/inquiryFields'
import { assessCheckFeedback } from '@/mock/eventFeedbackRules'
import {workflowCases,workflowIds,isWorkflow,composeRepair,workflowReply,healthTracks,deviceStoryAssessment,stageReport} from '@/mock/fourStoryWorkflow'
import {realCaseFor} from '@/mock/realCaseAdapter'

export const usePhase2DemoStore = defineStore('phase2-demo', () => {
  const attention = attentionItems
  // Task-local copies prevent a repair scope in one run from rewriting shared fixtures.
  const cases = reactive(JSON.parse(JSON.stringify(scenarioCases)))
  const checkAssessments=reactive({}),completedTasks=reactive({}),eventStatus=reactive({})
  const healthUpdates=reactive({}),stageHistory=reactive({}),workflowRounds=reactive({})
  const unlockedRecommendations=reactive({})
  const storyJournal=reactive([]),dailyHealthReports=reactive([])
  let storySequence=0
  function recordStory(id,kind,title,text,assessment='',at=''){
    const context={healthUpdates},track=sourceTrack(id,context)
    if(!at&&['observation','closure'].includes(kind)){const execution=executionRecords[id]?.at(-1);if(execution){const date=new Date(execution.values.executedAt+'Z');date.setDate(date.getDate()+(observationRecords[id]?.at(-1)?.day||0));at=date.toISOString().slice(0,16).replace('T',' ')}}
    const entry={id:'story-'+(++storySequence),order:storySequence,taskId:id,rootId:track?.id||id,kind,title,text,assessment,storyAt:at||storyDate(id,context),recordedAt:new Date().toISOString(),actor:kind==='analysis'||kind==='sample'||kind==='recommendation'?'AI设备健康分析':kind==='assignment'?'陈志远（轮机长）':taskActors[id]||'陈志远（轮机长）'}
    if(cases[id]?.realCaseId){entry.isSimulation=true}
    storyJournal.push(JSON.parse(JSON.stringify(entry)))
    if(track?.id==='aux2-health')captureHealthSnapshot(entry.storyAt)
    return storyJournal.at(-1)
  }
  function captureHealthSnapshot(at='2026-10-15 08:00'){
    const report=deviceStoryAssessment({healthUpdates,checkAssessments,executionRecords,observationRecords,todoCreated,assignments,completedTasks,isTaskHandled},'aux-engine-2')
    dailyHealthReports.push({id:'health-review-'+(dailyHealthReports.length+1),deviceId:'aux-engine-2',date:at.slice(0,10),at,report:JSON.parse(JSON.stringify(report))})
  }
  const selectedAttentionId = ref('maintenance')
  const selectedTodoId = ref(null)
  const captainEntry=ref(0)
  function showCaptainWorkbench(){captainEntry.value++}
  const todoCreated = reactive({ maintenance: false, drift: false, fault: false })
  const assignmentRequest=ref(null)
  const assignments=reactive({})
  const taskActors=reactive({fault:"王海涛（二管轮）",drift:"李建国（大管轮）",maintenance:"李建国（大管轮）"})
  const assignmentRecords=reactive({})
  const ignoredSuggestions=reactive({})
  const suggestionDecisions=reactive([])
  function defaultAssignment(id){return {owner:cases[id]?.owner||'李建国（大管轮）',collaborator:'',type:['maintenance','fault'].includes(id)?'检测排查':'现场核实',due:'尽快完成首轮核实',scope:cases[id]?.report?.human||'核对现场读数与工况，记录实际检查结果。',assignedBy:'陈志远（轮机长）'}}
  assignments.fault=defaultAssignment('fault')
  const stageAssignments=reactive({})
  function assignStage(id,index,owner){
    const stage=cases[id]?.stages[index]
    if(!todoCreated[id]||!stage||!owner)return false
    const previous=assignments[id]||defaultAssignment(id)
    if(!assignTask(id,{...previous,owner,type:stage.label,scope:stage.summary,due:stage.kind==='work'?'具备作业条件后按计划执行':previous.due,stageId:stage.id,stageIndex:index}))return false
    ;(stageAssignments[id] ||= {})[stage.id]={...assignments[id]}
    return true
  }
  function assignTask(id,values){if(!todoCreated[id]||!values.owner||!values.scope?.trim()||!values.due?.trim())return false;const record={...values,assignedBy:'陈志远（轮机长）',at:new Date().toLocaleString('zh-CN',{timeZone:'Asia/Shanghai'})};assignments[id]=record;taskActors[id]=record.owner;(assignmentRecords[id] ||= []).push({...record});addLog(id,'user',`任务指派：${record.owner}负责${record.type}；${record.scope}；计划：${record.due}`);if(isWorkflow(id))recordStory(id,'assignment','轮机长派发任务',`${record.assignedBy}指定${record.owner}；${record.scope}；计划：${record.due}`);return true}
  function ignoreSuggestion(id,reason){if(todoCreated[id]||!reason.trim())return false;ignoredSuggestions[id]={reason:reason.trim(),actor:'陈志远（轮机长）',at:new Date().toLocaleString('zh-CN',{timeZone:'Asia/Shanghai'})};suggestionDecisions.push({id,...ignoredSuggestions[id]});registerDossierNote(id,'忽略本次建议：'+reason.trim());if(isWorkflow(id))recordStory(id,'decision','本次不采纳建议',reason.trim(),'原健康记录及周期计划保留，不代表设备恢复。');return true}
  function confirmFalseAlarm(id,reason){
    if(cases[id]?.cardType!=='报警事件'||todoCreated[id]||eventStatus[id]==='closed'||!reason?.trim())return false
    completedTasks[id]={title:'误报决定已留档',reason:reason.trim(),actor:'陈志远（轮机长）',at:new Date().toLocaleString('zh-CN',{timeZone:'Asia/Shanghai'}),action:'false-alarm'}
    eventStatus[id]='closed';eventUpdatedAt[id]=completedTasks[id].at
    recordStory(id,'decision','确认误报并留档',reason.trim(),'原报警与快照保留。')
    addLog(id,'user','确认误报依据：'+reason.trim());addLog(id,'assistant','本次误报决定已留档，原报警、快照和确认依据继续保留。')
    return true
  }
  const eventUpdatedAt=reactive({fault:'2026/10/12 07:50'})
  const progress = reactive({ maintenance: 0, drift: 0, fault: 0 })
  const activeStage = reactive({ maintenance: 0, drift: 0, fault: 0 })
  const monitorStep = reactive({ stable: 0, drift: 1 })
  const logs = reactive({ ship: [], device: [], sensor: [], maintenance: [], stable: [], 'cyl4-watch':[], drift: [], 'cyl2-ended': [], 'vibration-trend': [], fault: [] })
  const inputDraft = ref('')
  const detailTab = ref('概览')
  const attentionInFocus = ref(false)
  const regularMaintenanceInFocus = ref(false)
  const situationObservationId = ref(null)
  const observationTimers = {}
  const openedStages = reactive({})
  const recordDrafts = reactive({})
  const executionRecords = reactive({})
  let executionSequence=0
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
  const attentionFeedback = reactive({})
  const dossierNotes = reactive({})
  const deviceDataTopic=ref(null)
  const dossierReviews=reactive({})
  let dossierNoteSequence = 0
  function sendR02Message(id,text,topic=id){
    const reply=r02Reply({attentionFeedback,todoCreated,dossierReviews},topic,text)
    if(!reply || !logs[id] || !text.trim())return false
    addLog(id,'user',text.trim())
    if(reply.review){
      const entry={type:reply.review,text:reply.text,at:new Date().toLocaleString('zh-CN',{timeZone:'Asia/Shanghai'})}
      dossierReviews[id]={...entry,history:[...(dossierReviews[id]?.history||[]),entry]}
    }
    const message={role:'assistant',text:reply.text,...(reply.supplement && !reply.newSituation?{noteCandidate:{text:text.trim(),registered:false}}:{}),...(reply.review==='check'?{r02Check:true}:{})}
    addLog(id,'assistant',message)
    if(reply.newSituation)addLog(id,'assistant',{
      id:`r02-new-situation-${++dossierNoteSequence}`,type:'inquiry',purpose:'r02-note',role:'assistant',status:'pending',
      text:'请补充这条新现场情况。登记后作为人员补充留存，不自动改写历史结束或确认复发。',
      fields:[{key:'time',label:'发生时间',type:'text',required:true},{key:'context',label:'当时工况与具体位置',type:'text',required:true},{key:'phenomenon',label:'现象描述',type:'textarea',value:text.trim(),required:true}],values:{phenomenon:text.trim()},submitLabel:'登记新的现场补充'
    })
    return true
  }
  function confirmR02Check(id){
    if(id!=='drift' || !attentionFeedback[id] || dossierReviews[id]?.type!=='check')return false
    return createTodo(id)
  }
  function deferR02Check(id,reason){
    if(id!=='drift' || dossierReviews[id]?.type!=='check' || todoCreated[id] || !reason.trim())return false
    dossierReviews[id].decision='deferred'
    registerDossierNote(id,'暂不安排进一步检查。原因：'+reason.trim())
    return true
  }
  function askDossierQuestion(id, text, reply) {
    if (!logs[id] || !text.trim()) return
    addLog(id,'user',text.trim())
    addLog(id,'assistant',{text:reply,noteCandidate:{text:text.trim(),registered:false}})
  }
  function registerDossierNote(id, text) {
    const value = text.trim()
    if (!value || !logs[id] || (!cases[id] && !attention.some(item=>item.id===id && item.tab==='attention') && !isTaskHandled(id))) return false
    const record = {id:`note-${++dossierNoteSequence}`,label:'人员留言',createdAt:Date.now(),at:new Date().toLocaleString('zh-CN',{timeZone:'Asia/Shanghai'}),actor:'轮机长',text:value,assessment:'人员补充，尚未经现场核实；不自动修改判断、完成要求或创建事件。',type:'note'}
    ;(dossierNotes[id] ||= []).push(record)
    addLog(id,'user',{text:value,dossierNoteId:record.id})
    addLog(id,'assistant','留言已登记到本事项的跟踪记录。原文已保留，尚不作为已核实事实；本次不触发新的检测或自动推进事件。')
    return true
  }
  function attentionAction(id) {
    if(ignoredSuggestions[id]&&!todoCreated[id])return {phase:'已忽略本次建议',text:ignoredSuggestions[id].reason}
    if (isTaskHandled(id)) {
      const result = getObservationResult(id)
      if (result.type === 'reinspect') return { phase:'处理后观察', linked:true, text:'进入关联事件，核实反复现象并补充复查结果' }
      if (result.type === 'extend') return { phase:'处理后观察', linked:true, text:'补充缺失或不可比的运行记录，在关联事件中记录；按建议延长观察' }
      return { phase:result.type === 'archive' ? '已结束' : '处理后观察', text:result.type === 'archive' ? '无需操作，可回看结束依据' : '系统继续跟踪处理效果；有新现场现象可补充' }
    }
    if (id === 'drift' && todoCreated.drift) return { phase:'检查处置中', linked:true, text:'检查在关联事件中进行，请进入事件完成当前阶段' }
    if(id==='drift' && dossierReviews[id]?.type==='check' && dossierReviews[id].decision!=='deferred')return {phase:'待人员决定',required:true,decisionRequired:true,text:'确认是否针对3#缸开展进一步检查；仅是检查安排，不是已经诊断或维修。'}
    if (id === 'drift' && monitorStep.drift && !attentionFeedback[id]) return { phase:'待现场核实', required:true, text:'核对稳定负荷下的现场排温读数、运行工况与现场现象' }
    const ended = id === 'cyl2-ended'
    return { phase:ended ? '已结束' : '系统跟踪中', text:ended ? '无需操作，可回看过程与结束依据' : dossierReviews[id]?.decision === 'deferred' ? '已记录暂不安排检查的决定与原因，系统继续跟踪；不代表设备正常或事项结束' : dossierReviews[id] ? '研判已更新，系统继续跟踪；当前证据不等于确认或排除故障' : attentionFeedback[id] ? '现场核实已提交，后续分析尚未更新；本次反馈不等于确认无故障' : '暂不需要人员操作，系统继续比较可比工况下的变化' }
  }
  function submitAttentionFeedback(id, evidence) {
    if(attentionAction(id).decisionRequired || attentionFeedback[id])return false
    if (!attentionAction(id).required || !evidence.conditions?.trim() || !evidence.phenomenon?.trim() || !evidence.confirmed || evidence.reading === '' || !Number.isFinite(Number(evidence.reading)) || Number(evidence.reading) < 0) return false
    attentionFeedback[id] = { ...evidence, createdAt:Date.now(), at:new Date().toLocaleString('zh-CN',{timeZone:'Asia/Shanghai'}) }
    addLog(id,'user',`现场核实已提交：排温 ${evidence.reading}°C；工况：${evidence.conditions}；现场现象：${evidence.phenomenon}`)
    addLog(id,'assistant','本次核实已提交，这项要求已完成；不等于确认或排除故障，没有自动创建事件。后续分析尚未更新，待取得结果后再补充。')
    return true
  }
  const sensors=useSensorStore()
  watch(()=>[progress.fault,progress.drift,progress.maintenance,monitorStep.stable,monitorStep.drift,observationRecords.fault.at(-1),observationRecords.drift.at(-1),observationRecords.maintenance.at(-1)],()=>{
    const faultRecord=observationRecords.fault.filter(r=>r.values).at(-1),driftRecord=observationRecords.drift.filter(r=>r.values).at(-1)
    const maintenanceRecord=observationRecords.maintenance.filter(r=>r.values).at(-1)
    sensors.setSimulationBaselines({
      's-007':{value:isTaskHandled('fault')&&executionObservationReady('fault')?(faultRecord?.values[0]??79.1):92.4},
      's-017':{value:isTaskHandled('fault')&&executionObservationReady('fault')?(faultRecord?.values[1]??86.5):68.2},
      's-005':{value:432},
      's-015':{value:monitorStep.stable>=2?0.395:0.40},
      's-018':{value:isTaskHandled('maintenance')&&executionObservationReady('maintenance')?(maintenanceRecord?.values[0]??2.2):3.0,status:isTaskHandled('maintenance')&&executionObservationReady('maintenance')?'normal':'warning'},
      's-019':{value:isTaskHandled('maintenance')&&executionObservationReady('maintenance')?(maintenanceRecord?.values[1]??64):65},
    })
  },{immediate:true,deep:true})

  const extraIds=additionalScenarios.map(item=>item.id)
  for(const item of additionalScenarios){const id=item.id;todoCreated[id]=item.initialCreated!==false;progress[id]=0;activeStage[id]=0;logs[id]=[];taskActors[id]=item.owner;assignments[id]={owner:item.owner,type:'检测排查',scope:item.report.human,due:'尽快核实并反馈',assignedBy:'陈志远（轮机长）'};eventUpdatedAt[id]='2026/10/12 07:30';observationReady[id]=false;observationRounds[id]=1;observationRecords[id]=[];observationHistory[id]=[];observationTargets[id]=item.observation.days}
  function initializeWorkflows(){
    for(const id of workflowIds){todoCreated[id]=false;progress[id]=0;activeStage[id]=0;logs[id] ||= [];taskActors[id]=cases[id].owner;assignments[id]=defaultAssignment(id);observationReady[id]=false;observationRounds[id]=1;observationRecords[id]=[];observationHistory[id]=[];observationTargets[id]=cases[id].observation.days;eventStatus[id]='pending';workflowRounds[id]=1}
  }
  initializeWorkflows()
  function openRealCase(id){
    if(isTrackingContainer(id)){
      unlockedRecommendations[id]=true
      // This track already formed its recommendation in the retained source.
      // Opening other tracks must not reveal their future recommendation node.
      if(id==='bearing-health')unlockedRecommendations.maintenance=true
      return true
    }
    if(!realCaseFor(id)||!cases[id])return false
    unlockedRecommendations[id]=true
    return true
  }
  const selectedAttention = computed(() => attention.find(item => item.id === selectedAttentionId.value) || attention[0])
  const selectedTodo = computed(() => selectedTodoId.value ? cases[selectedTodoId.value] : null)
  const taskPortfolio=computed(()=>visibleTodos.value)
  const eventPortfolio=computed(()=>[...new Set(visibleTodos.value.map(item=>parentIssueId(item.id)))].map(id=>cases[id]))
  const visibleTodos = computed(() => workflowIds.filter(id => todoCreated[id]&&!isTrackingContainer(id)).map(id => cases[id]))
  for(const id of [...new Set(['fault','maintenance','drift',...extraIds,...workflowIds])])watch(()=>[todoCreated[id],progress[id]],()=>{
    if(todoCreated[id])eventUpdatedAt[id]=new Date().toLocaleString('zh-CN',{timeZone:'Asia/Shanghai'})
    else delete eventUpdatedAt[id]
  },{flush:'sync'})
  function observationIndex(id) { return cases[id].stages.findIndex(stage => stage.kind === 'observe') }
  function isTaskHandled(id) { if(isTrackingContainer(id))return false; return Boolean(completedTasks[id]) || Boolean(cases[id]) && progress[id] >= observationIndex(id) }
  const effectObservations = computed(() => visibleTodos.value.filter(item => !item.trackingOnly&&isTaskHandled(item.id)&&executionRecords[item.id]?.length&&executionObservationReady(item.id)))
  const caseMaterials = computed(() => Object.fromEntries(visibleTodos.value.filter(item=>executionRecords[item.id]?.some(record=>record.values.completion==='completed')||observationHistory[item.id].length).map(item => [item.id, {
    sourceId: item.eventId || 'EVT-ME-' + ({fault:'001',maintenance:'002',drift:'003'})[item.id],
    sourceTitle: item.initialTitle,
    status: eventStatus[item.id]==='closed'?'已汇集，待审阅':'持续补充中',
    content: '已自动汇集原始证据、原因分析、人员反馈和实际措施；后续效果记录继续关联补充。'
  }])))
  function handledReceipt(id) {
    if(completedTasks[id])return {id:'handled',kind:'handled',label:'处理记录',title:completedTasks[id].title,summary:completedTasks[id].reason,evidence:[completedTasks[id].reason],judgement:cases[id].trackingOnly?'本次人工任务结束，原健康记录继续。':'原始资料和本次判断保留。'}
    const work = cases[id].stages[observationIndex(id) - 1]
    return { id:'handled', kind:'handled', label:'处理完成', title:'本轮人工处理已完成', summary:'现场措施与验收已提交，待办记为已处理。', evidence:work.evidence, judgement:'处理后的持续效果由设备态势跟踪，事件保留本轮检查、处置和人员反馈。' }
  }
  const currentStage = computed(() => {
    const id = selectedTodoId.value, selected = selectedTodo.value?.stages[activeStage[id]]
    return selected && ['observe','closed'].includes(selected.kind) ? handledReceipt(id) : selected || null
  })
  function selectObservation(id) { if(!isTaskHandled(id)||cases[id]?.trackingOnly||completedTasks[id]||!executionRecords[id]?.length)return; situationObservationId.value=id; attentionInFocus.value=false; startObservation(id); scheduleObservation(id) }
  function clearObservationFocus() { situationObservationId.value=null }
  function completeObservation(id) {
    if (!isTaskHandled(id) || getObservationResult(id).type !== 'archive') return
    if (progress[id] === cases[id].stages.length - 1) return
    const wasInReceipt=activeStage[id]>=observationIndex(id)
    progress[id]=cases[id].stages.length-1
    if(wasInReceipt)activeStage[id]=progress[id]
    observationReady[id]=true
    eventStatus[id]='closed'
    if(isWorkflow(id))recordStory(id,'closure','人工确认闭环','已核对本轮措施、可比观察和现场反馈，确认本轮跟进结束。')
    addLog(id,'user','确认本轮观察无新异常，闭环归档')
    addLog(id,'assistant','已记录人工闭环确认。现场反馈、实际措施与后续观察关联保留，可从设备动态回查。')
  }
  function scheduleObservation(id) {
    if(isWorkflow(id))return
    if (!executionObservationReady(id) || observationTimers[id] || !isTaskHandled(id) || getObservationResult(id).type !== 'continue') return
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
    addLog(id,'user',{text:value,observationContext:true,observationRound:observationRounds[id]})
    if(eventStatus[id]==='closed'){addLog(id,'assistant',{observationContext:true,observationRound:observationRounds[id],text:'本轮已人工确认闭环，实际措施、验收与观察依据可回查。新增情况请保留具体时间、工况与现象，不能自动改写本轮结束记录。'});return}
    const noIssue=/没有.*异常|未见.*异常|未再.*反复|未再.*异响|无异常|无反复|无异响/.test(value)
    if (!noIssue && /再次|反复|又升|仍有异响|未恢复/.test(value)) recordObservationEvidence(id,'abnormal',value)
    else if (/数据缺失|数据不足|采集不全|工况不同/.test(value)) recordObservationEvidence(id,'incomplete',value)
    else addLog(id,'assistant',{kind:'scene',observationContext:true,observationRound:observationRounds[id],...observationScene(id,observationRecords[id],observationTargets[id])})
  }

  function addLog(id, role, text) {
    logs[id].push({ role, ...(typeof text === 'string' ? { text } : text), at: new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }) })
  }

  function selectAttention(id) {
    selectedAttentionId.value = id
    inputDraft.value = ''
    const item = attention.find(entry => entry.id === id)
    if (!item || item.tab==='data' || !logs[id])return
    if (!logs[id].length) {
      addLog(id, 'user', `查看${item.title}`)
      addLog(id, 'assistant', r02InitialMessage({attentionFeedback,todoCreated,dossierReviews},id) || { kind: 'scene', ...attentionScene(id, monitorStep[id] || 0) })
    }
  }

  function createTodo(id) {
    if (!cases[id] || todoCreated[id] || isTrackingContainer(id)) return false
    if(cases[id].latent&&!unlockedRecommendations[id])return false
    if (id === 'drift' && monitorStep.drift < 1) return false
    delete ignoredSuggestions[id]
    assignments[id] ||= defaultAssignment(id)
    todoCreated[id] = true
    eventStatus[id]='assigned'
    addLog(id, 'assistant', `已建立“${cases[id].initialTitle}”待办，来源资料已关联保留。派发完成后可继续处理态势中的其他事项。`)
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
    if (id === 'stable') return false
    if (id === 'drift' && monitorStep.drift < 1) {
      monitorStep.drift = 1
      addLog(id, 'assistant', { kind: 'scene', ...attentionScene(id, 1) })
    }
  }

  function selectTodo(id) {
    if(!cases[id]||isTrackingContainer(id))return false
    selectedTodoId.value = id
    activeStage[id] = progress[id]
    inputDraft.value = ''
    openStageConversation(id)
  }

  function closeTodo() { selectedTodoId.value = null }

  function selectStage(id, index) {
    if(completedTasks[id]&&index>completedTasks[id].completedAtIndex&&index<observationIndex(id))return false
    if (index <= progress[id]) { activeStage[id] = index; openStageConversation(id) }
  }

  function openStageConversation(id, context = '') {
    const rawStage = cases[id].stages[activeStage[id]]
    const stage = ['observe','closed'].includes(rawStage.kind) ? handledReceipt(id) : rawStage
    if (stage.kind === 'handled') { startObservation(id); scheduleObservation(id) }
    const key = `${id}:${stage.id}`
    if (openedStages[key]) return
    openedStages[key] = true
    addLog(id, 'user', context?`查看本轮反馈后的${stage.label}安排`:stage.kind === 'handled' ? '查看处理结果' : stage.kind === 'overview' ? id==='maintenance'?'查看维保建议':stage.id==='attention'?'查看异动跟踪当前情况':'查看事件当前情况' : `进入${stage.label}`)
    const scene=sceneFor(id, stage)
    if(context)scene.paragraphs=[{label:'本轮结果',text:context},...(scene.paragraphs||[])]
    addLog(id, 'assistant', { kind: 'scene', stageId: stage.id, ...scene })
    if(stage.kind==='work')requestExecutionRecord(id)
  }

  function executionInquiry(id) { return logs[id]?.findLast(message=>message.purpose==='execution-record'&&message.status==='pending') || null }
  function requestExecutionRecord(id) {
    if(!cases[id]||isTaskHandled(id))return null
    const stage=cases[id].stages[progress[id]]
    if(stage.kind!=='work')return null
    const existing=executionInquiry(id);if(existing)return existing
    const previous=executionRecords[id]?.findLast(record=>!isWorkflow(id)||record.round===workflowRounds[id])
    const fields=stage.tasks.flatMap((task,i)=>[{key:'task'+i,label:task.label,type:'select',required:true,options:[{value:'已完成',label:'已完成'},{value:'待补充',label:'待补充'}]},{key:'note'+i,label:task.label+'备注',type:'textarea'}])
    const values={...(previous?.values||{}),equipment:previous?.values.equipment||cases[id].device,executor:taskActors[id]||assignments[id]?.owner}
    stage.tasks.forEach((task,i)=>{values['task'+i]=taskResults[id+':'+stage.id+':'+i]||values['task'+i]||'';values['note'+i]=taskNotes[id+':'+stage.id+':'+i]||values['note'+i]||''})
    const recordFields=JSON.parse(JSON.stringify(executionRecordTemplate.fields))
    if(isWorkflow(id)){
      recordFields.find(field=>field.key==='completion').options[0].label='本轮作业已完成'
      if(isMaintenanceWorkflow(cases[id])){
        const verification=recordFields.find(field=>field.key==='verification')
        verification.label='本次维保验收结果'
        verification.options=[{value:'resolved',label:'本次范围验收通过'},{value:'unresolved',label:'仍有问题，返回评估'},{value:'pending',label:'尚未完成验收'}]
      }
    }
    const message={...JSON.parse(JSON.stringify(executionRecordTemplate)),id:'execution-'+id+'-'+(++executionSequence),stageId:stage.id,round:workflowRounds[id]||1,fields:[...fields,...recordFields],values}
    if(stage.recordCutoff)message.hint='本页记录截至 '+stage.recordCutoff.slice(0,10)+'。按实际检查与作业填写时间、措施及验收，不预填完成。'
    addLog(id,'assistant',message);return executionInquiry(id)
  }
  function updateExecutionRecord(id,messageId,values) {
    const message=executionInquiry(id);if(!message||message.id!==messageId)return false
    const preset=values.scenarioPreset??message.values.scenarioPreset
    message.values={...values,...(preset?{scenarioPreset:preset}:{})};delete message.submitError
    const stage=cases[id].stages.find(entry=>entry.id===message.stageId)
    stage.tasks.forEach((task,i)=>{taskResults[id+':'+stage.id+':'+i]=values['task'+i]||'';taskNotes[id+':'+stage.id+':'+i]=values['note'+i]||''})
    return true
  }
  function confirmExecutionRecord(id,messageId,values) {
    const message=executionInquiry(id),stage=cases[id]?.stages[progress[id]]
    if(!message||message.id!==messageId||stage?.kind!=='work'||message.stageId!==stage.id)return false
    const errors=validateInquiry(message,values)
    if(Object.keys(errors).length){message.submitError='请补齐执行记录的必填信息。';return false}
    // Future story nodes have an explicit record date; ordinary tasks retain the wall-clock boundary.
    const recordLimit=Math.max(Date.now(),Date.parse(stage.recordCutoff||'')||0)
    if(!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(values.executedAt)||Date.parse(values.executedAt)>recordLimit){message.submitError='执行时间须有效，且不晚于当前记录时间。';return false}
    if(values.completion==='completed'&&stage.tasks.some((_,i)=>values['task'+i]!=='已完成')){message.submitError='仍有未完成步骤，请保留进展或补齐实际结果。';return false}
    // A checkbox is not a new post-work sample. Historical case data must never
    // be reused as if it were monitoring after the user's rehearsal action.
    if(cases[id].realCaseId){const preset=values.scenarioPreset??message.values.scenarioPreset;values={...values,scenarioPreset:preset,comparable:preset==='complete'&&values.comparable==='available'?'available':'missing'}}
    updateExecutionRecord(id,messageId,values)
    const at=new Date().toLocaleString('zh-CN',{timeZone:'Asia/Shanghai'})
    const record={id:messageId,values:JSON.parse(JSON.stringify(values)),source:'人员确认',isSimulation:Boolean(cases[id].realCaseId),executor:values.executor||taskActors[id]||assignments[id]?.owner,assignedBy:assignments[id]?.assignedBy||'陈志远（轮机长）',confirmedAt:at,stageId:stage.id,round:workflowRounds[id]||1,scope:stage.tasks.map(task=>task.label)}
    ;(executionRecords[id] ||= []).push(record)
    if(isWorkflow(id))recordStory(id,'execution','实际执行与验收记录',values.measures,values.acceptance,values.executedAt.replace('T',' '))
    message.status='submitted';message.submittedAt=at;message.receiptText=values.completion==='completed'?'实际执行与验收已确认；不修改原工单。':'已保留进展，当前阶段不推进。'
    addLog(id,'user','确认实际执行记录：'+values.measures+'；执行时间：'+values.executedAt)
    if(isWorkflow(id)){
      eventUpdatedAt[id]=at
      if(values.completion!=='completed'){message.receiptText='已保留实际进展，未完成项目继续处理。';addLog(id,'assistant',message.receiptText);requestExecutionRecord(id);return true}
      if(values.verification==='unresolved'){
        message.receiptText='实际作业已保存，原异常仍存在；沿原事件返回排查。'
        addLog(id,'assistant',message.receiptText);returnForInvestigation(id);return true
      }
      if(values.verification!=='resolved'){
        message.receiptText='作业记录已保存，验收尚未完成；当前不进入效果观察。'
        addLog(id,'assistant',message.receiptText);requestExecutionRecord(id);return true
      }
      message.receiptText=values.comparable==='available'?'执行及现场验收已保存，接续后续可比节点观察，最终闭环仍需人工确认。':'执行及现场验收已保存，待补充可比数据；当前不生成改善结论。'
      addLog(id,'assistant',message.receiptText)
      progress[id]=observationIndex(id);activeStage[id]=progress[id];eventStatus[id]='observing';openStageConversation(id)
      return true
    }
    addLog(id,'assistant',values.completion==='completed'?(values.comparable==='available'?'执行记录已保存，以实际执行时间为比较分界进入效果观察。':'执行记录已保存。缺少可比监测数据，效果观察待补充，不生成改善结论。'):'执行进展已保存，未完成的作业继续在当前事件补充。')
    if(values.completion==='completed'){
      progress[id]=observationIndex(id);activeStage[id]=progress[id];openStageConversation(id)
    }else requestExecutionRecord(id)
    return true
  }
  function executionObservationReady(id) { const record=executionRecords[id]?.at(-1);return isWorkflow(id)?Boolean(record&&record.values.completion==='completed'&&record.values.verification==='resolved'&&record.values.comparable==='available'):!record||record.values.completion==='completed'&&record.values.comparable==='available' }
  function advanceWorkflow(id,feedback){
    const stage=cases[id].stages[activeStage[id]]
    if(stage.kind==='work')return {saved:false,advanced:false,message:'请在标准执行记录中确认实际措施与验收。'}
    if(stage.kind==='check'){
      const outcome=assessCheckFeedback(id,stage,feedback)
      if(!outcome.valid)return {saved:false,advanced:false,message:outcome.message}
      const previous=checkAssessments[id]
      if(previous?.stageId===stage.id&&JSON.stringify(previous.records)===JSON.stringify(outcome.records))return {saved:true,advanced:false,message:previous.message}
      checkAssessments[id]={...outcome,stageId:stage.id,round:workflowRounds[id],at:new Date().toLocaleString('zh-CN',{timeZone:'Asia/Shanghai'})}
      ;(stageHistory[id] ||= []).push({round:workflowRounds[id],stageId:stage.id,...JSON.parse(JSON.stringify(checkAssessments[id]))})
      feedback.forEach((record,i)=>{taskResults[id+':'+stage.id+':'+i]=record.result;taskNotes[id+':'+stage.id+':'+i]=record.note||'';taskAttachments[id+':'+stage.id+':'+i]=[...(record.attachments||[])]})
      addLog(id,'user',`提交${stage.label}反馈：`+feedback.map(record=>`${record.label}：${record.result}${record.note?'；'+record.note:''}`).join('；'))
      addLog(id,'assistant',{kind:'feedbackRecord',title:outcome.title,task:stage.title,records:outcome.records,actor:taskActors[id],submittedAt:checkAssessments[id].at})
      eventUpdatedAt[id]=checkAssessments[id].at
      if(cases[id].trackingOnly){
        const track=healthTracks.find(item=>item.requestId===id)
        healthUpdates[track.id]={...(healthUpdates[track.id]||{}),feedback:outcome.records,at:checkAssessments[id].at,conclusion:outcome.message}
      }
      recordStory(id,'feedback',stage.label+'反馈',feedback.map(record=>`${record.label}：${record.result}；${record.note||'未附备注'}`).join('\n'),outcome.message)
      if(!outcome.advance)return {saved:true,advanced:false,message:outcome.message}
      if(outcome.packages?.length){const repair=composeRepair(cases[id],outcome.packages);Object.assign(cases[id].stages.find(item=>item.kind==='work'),repair,{summary:outcome.message});cases[id].workDetails=repair.workDetails}
      if(stage.id==='check'&&cases[id].cardType==='预警事件')cases[id].stages.find(item=>item.id==='event').evidence=feedback.map(record=>record.label+'：'+record.result+'；'+(record.note||'未附备注'))
    }
    const next=activeStage[id]+1
    progress[id]=next;activeStage[id]=next;delete recordDrafts[id]
    openStageConversation(id,checkAssessments[id]?.stageId===stage.id?checkAssessments[id].message:'')
    return {saved:true,advanced:true,message:checkAssessments[id]?.message||'已接续下一阶段。'}
  }
  function decideCheck(id,action,reason=''){
    const assessment=checkAssessments[id]
    if(!assessment||assessment.stageId!==cases[id].stages[progress[id]]?.id||!assessment.actions?.includes(action))return false
    if(action==='retry'){delete checkAssessments[id];return true}
    if(!reason.trim())return false
    const record={title:action==='finish-tracking'?'本次核实已结束，健康跟踪继续':action==='end-warning'?'本次预警核实已结束':'本次提前评估已结束',reason:reason.trim(),actor:taskActors[id],at:new Date().toLocaleString('zh-CN',{timeZone:'Asia/Shanghai'}),completedAtIndex:progress[id],action}
    if(action==='supplement'){registerDossierNote(id,record.reason);return true}
    completedTasks[id]=record;eventStatus[id]='closed';eventUpdatedAt[id]=record.at
    progress[id]=observationIndex(id);activeStage[id]=progress[id]
    if(action==='finish-tracking'){
      const track=healthTracks.find(item=>item.requestId===id)
      healthUpdates[track.id]={...(healthUpdates[track.id]||{}),taskComplete:true,decision:record.reason,at:record.at}
    }
    ;(stageHistory[id] ||= []).push({round:workflowRounds[id],stageId:'decision',title:record.title,at:record.at,reason:record.reason,actor:record.actor})
    recordStory(id,'decision',record.title,record.reason,action==='finish-tracking'?'本次核实任务已结束，原健康链继续。':'本次决定与原计划、来源资料分别保留。')
    addLog(id,'user',record.title+'：'+record.reason)
    addLog(id,'assistant',action==='finish-tracking'?'本次人工核实已归档，反馈和限制保留在原健康记录；长期趋势继续。':action==='end-maintenance'?'本次提前评估结束，原周期计划保持有效；决定与依据可在设备记录回查。':'本次核实结论及依据已保存，原始预警和人员记录保留；不据此声明设备所有部位健康。')
    return true
  }
  function returnForInvestigation(id){
    const index=cases[id].stages.findIndex(item=>item.id===(isMaintenanceWorkflow(cases[id])?'check':'investigate'))
    if(index<0)return
    ;(stageHistory[id] ||= []).push({round:workflowRounds[id],stageId:'return',title:'原异常仍存在，返回原事件排查',execution:JSON.parse(JSON.stringify(executionRecords[id]?.at(-1)||{}))})
    recordStory(id,'return','返回原任务继续核实','本轮实际执行与验收已保存，原问题仍存在；不重复建单。')
    workflowRounds[id]++;delete completedTasks[id];delete checkAssessments[id];eventStatus[id]='assigned'
    cases[id].stages.slice(index).forEach(stage=>{delete openedStages[id+':'+stage.id];stage.tasks?.forEach((_,i)=>{delete taskResults[id+':'+stage.id+':'+i];delete taskNotes[id+':'+stage.id+':'+i];delete taskAttachments[id+':'+stage.id+':'+i]})})
    progress[id]=index;activeStage[id]=index
    openStageConversation(id,'前轮实际措施和验收已保存，原异常仍存在；本轮需重新核实原因，不重复创建事件。')
  }
  function advanceHealthTrack(id){
    const track=healthTracks.find(item=>item.id===id)
    const state=healthUpdates[id],index=state?.laterNodes?.length||0
    if(!track?.laterNodes?.[index]||!state?.taskComplete)return false
    const node={...track.laterNodes[index]}
    if(node.recommendationId&&state.feedback?.[0]?.result!=='现场与系统一致'){
      delete node.recommendationId;node.judgement='测量可信度仍待核对，当前不据此形成提前维保建议。'
    }
    ;(state.laterNodes ||= []).push(node)
    state.conclusion=node.values+'。'+node.judgement
    if(node.recommendationId){unlockedRecommendations[node.recommendationId]=true;state.recommendationId=node.recommendationId;eventUpdatedAt[node.recommendationId]=new Date().toLocaleString('zh-CN',{timeZone:'Asia/Shanghai'})}
    const entry=recordStory(track.requestId||track.recommendationId||id,'sample',node.label,node.values+'；'+node.context,node.judgement,node.at)
    entry.sampleKey=node.label
    if(node.recommendationId)recordStory(node.recommendationId,'recommendation','形成相关提前维保评估建议','累积趋势与原季度项目、可用窗口关联；仅建议提前评估相关范围，不预定更换。','已取得的现场信息及缺项继续沿用。',node.at)
    if(track.requestId){addLog(track.requestId,'user',`查看${track.device}${node.label}的后续健康变化`);addLog(track.requestId,'assistant',{kind:'scene',title:'后续健康变化与安排',expanded:true,markdown:healthStoryMarkdown({healthUpdates,checkAssessments,todoCreated,assignments,executionRecords,observationRecords},track.requestId)})}
    return true
  }
  function supplementObservation(id,values){
    if(!isTaskHandled(id)||!executionRecords[id]?.length||!values?.conditions?.trim()||!values.note?.trim())return false
    if(eventStatus[id]==='closed')return false
    const real=Boolean(cases[id].realCaseId),day=real?Number(values.day):0
    if(real&&(values.day===''||values.day==null||!Number.isInteger(day)||day<0||day<(observationRecords[id].at(-1)?.day||0)))return false
    const parsed=observationConfig[id].names.map((_,i)=>Number(values['value'+i]))
    if(parsed.some((value,i)=>values['value'+i]===''||values['value'+i]==null||!Number.isFinite(value)))return false
    const latest=executionRecords[id].at(-1)
    latest.values.comparable='available'
    observationRecords[id].push({day,label:real?'第'+day+'日补充':'人员补充首测',values:parsed,status:real?'pending-review':'normal',source:'人员补充',isSimulation:real,note:(real?'【待判读】':'')+values.conditions+'；'+values.note})
    return true
  }
  function advanceTodo(id, feedback = []) {
    const stage = cases[id].stages[activeStage[id]]
    if (!stage?.action) return
    if(activeStage[id]<progress[id]){selectStage(id,completedTasks[id]&&activeStage[id]>=completedTasks[id].completedAtIndex?observationIndex(id):activeStage[id]+1);return}
    if(isWorkflow(id))return advanceWorkflow(id,feedback)
    let checkResult
    if(stage.kind==='check'){
      checkResult=assessCheckFeedback(id,stage,feedback)
      if(!checkResult.valid)return {saved:false,advanced:false,message:checkResult.message}
      const records=feedback.map(record=>({...record,attachments:[...(record.attachments||[])]}))
      const last=logs[id].filter(entry=>entry.kind==='feedbackRecord'&&entry.task===stage.title).at(-1)
      if(JSON.stringify(last?.records)!==JSON.stringify(records)){
        addLog(id,'assistant',{kind:'feedbackRecord',title:`${stage.label}反馈已提交`,task:stage.title,records,actor:taskActors[id],submittedAt:new Date().toLocaleString('zh-CN',{timeZone:'Asia/Shanghai'})})
        eventUpdatedAt[id]=new Date().toLocaleString('zh-CN',{timeZone:'Asia/Shanghai'})
      }
      if(!checkResult.advance){
        if(last?.submissionMessage!==checkResult.message){addLog(id,'assistant',checkResult.message);const latest=logs[id].filter(entry=>entry.kind==='feedbackRecord'&&entry.task===stage.title).at(-1);if(latest)latest.submissionMessage=checkResult.message}
        return {saved:true,advanced:false,message:checkResult.message}
      }
    }
    if(stage.kind==='observe'&&getObservationResult(id).type!=='archive')return
    if (feedback.length && stage.kind!=='check') addLog(id, 'assistant', { kind:'feedbackRecord', title:`${stage.label}反馈已提交`, task:stage.title, records:feedback })
    const next = activeStage[id] + 1
    progress[id] = Math.max(progress[id], next)
    activeStage[id] = next
    delete recordDrafts[id]
    addLog(id, 'assistant', checkResult?.reply || stage.reply)
    openStageConversation(id)
    return {saved:true,advanced:true,message:checkResult?.message||'本轮反馈已保存。'}
  }

  function sendTodo(text) {
    const id = selectedTodoId.value
    if (!id || !text.trim()) return
    addLog(id, 'user', text.trim())
    inputDraft.value = ''
    if(isWorkflow(id)){
      if(cases[id].stages[activeStage[id]]?.kind==='work'&&!isTaskHandled(id)){
        const request=requestExecutionRecord(id)
        if(request&&/补充|已完成|清洗|处理|复装|复测|换件|措施/.test(text))updateExecutionRecord(id,request.id,{...request.values,supplement:[request.values.supplement,text.trim()].filter(Boolean).join('\n')})
      }
      addLog(id,'assistant',isTaskHandled(id)?completedTasks[id]?.reason||'本轮人工处理已完成，后续观察与闭环在设备态势接续。':workflowReply({cases,activeStage,progress,checkAssessments,stageHistory,healthUpdates,completedTasks,executionRecords,todoCreated,assignments,storyJournal},id,text))
      return
    }
    const stage = cases[id].stages[activeStage[id]]
    if(isTaskHandled(id)){addLog(id,'assistant','本轮人工处理已完成。持续观测由设备态势自动跟踪；案例材料已按事件来源汇集，等待岸端审阅。');return}
    if(activeStage[id]<progress[id]){addLog(id,'assistant','当前显示已完成阶段，原反馈已保留。请切换到当前阶段后补充新的处理记录。');return}
    if(stage.kind==='work'){
      if(/记录|补充|已完成|处理|更换|清洗|验收|复测/.test(text)){const request=requestExecutionRecord(id);if(request)updateExecutionRecord(id,request.id,{...request.values,supplement:[request.values.supplement,text.trim()].filter(Boolean).join('\n')});addLog(id,'assistant','已保留这条补充，请在执行记录卡片中核对对应字段、实际时间及验收，再确认。原文保留在对话中，不自动认定完成。')}
      else addLog(id,'assistant',{kind:'scene',...sceneFor(id,stage)})
      return
    }
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
      const evidenceOk=extraIds.includes(id)?true:stage.kind==='work'? /复测|校验|试运转/.test(evidenceText)&&/合格|正常|稳定|恢复|无泄漏|2\.2|79\.1|86\.5|3°C/.test(evidenceText)&&/清洗|清洁|更换|处理/.test(evidenceText): id==='maintenance'?/偏磨/.test(evidenceText)&&/间隙/.test(evidenceText)&&/备件/.test(evidenceText): id==='drift'&&stage.id==='check'?/一致/.test(evidenceText)&&/异响/.test(evidenceText)&&/复现/.test(evidenceText):id==='fault'?/滤器/.test(evidenceText)&&/堵塞|脏污/.test(evidenceText)&&/温控阀/.test(evidenceText)&&/正常|未见异常/.test(evidenceText):/喷油器/.test(evidenceText)&&/积炭/.test(evidenceText)&&/排气阀/.test(evidenceText)&&/正常|未见异常/.test(evidenceText)
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

  function applyObservationPreset(id,key){
    if(!cases[id]?.realCaseId||!['continue','stable','incomplete','abnormal'].includes(key)||eventStatus[id]==='closed'||!isTaskHandled(id))return false
    const execution=executionRecords[id]?.at(-1),config=observationConfig[id]
    if(!execution||execution.values.completion!=='completed'||execution.values.verification!=='resolved'||!config.samples.length)return false
    execution.values.comparable='available'
    const records=observationRecords[id],lastDay=records.at(-1)?.day||0
    const append=(day,status,values,label)=>records.push({day,status,values:values?[...values]:null,label,preset:key,isSimulation:true,source:'处理后观察记录',note:'本轮处理后'+label+'，结合可比工况与观察窗口判断。'})
    if(key==='incomplete')append(lastDay,'incomplete',null,'资料不足／工况不可比')
    else if(key==='abnormal')append(lastDay,'abnormal',config.abnormal,'原异常反复')
    else {
      if(!records.some(record=>record.preset&&record.status==='normal'&&record.day===0))append(0,'normal',config.samples[0],'处理后首测')
      if(key==='stable')append(Math.max(lastDay,observationTargets[id]),'normal',config.samples.at(-1),'覆盖观察窗口')
    }
    observationReady[id]=getObservationResult(id).type==='archive'
    recordStory(id,'observation','更新效果观察：'+records.at(-1).label,records.at(-1).note,getObservationResult(id).text)
    return true
  }
  function resetRealScenario(id){
    if(!cases[id]?.realCaseId)return false
    cases[id]=JSON.parse(JSON.stringify(workflowCases[id]))
    for(const collection of [checkAssessments,completedTasks,executionRecords,ignoredSuggestions,stageHistory,assignmentRecords,recordDrafts,dossierNotes,dossierReviews,stageAssignments])delete collection[id]
    for(const collection of [taskResults,taskNotes,taskAttachments,workAcceptance,workAcceptanceNotes,openedStages])for(const key of Object.keys(collection))if(key.startsWith(id+':'))delete collection[key]
    for(let i=storyJournal.length-1;i>=0;i--)if(storyJournal[i].taskId===id)storyJournal.splice(i,1)
    for(let i=suggestionDecisions.length-1;i>=0;i--)if(suggestionDecisions[i].id===id)suggestionDecisions.splice(i,1)
    delete healthUpdates[id+'-track'];delete eventUpdatedAt[id]
    todoCreated[id]=false;progress[id]=0;activeStage[id]=0;logs[id]=[];assignments[id]=defaultAssignment(id);workflowRounds[id]=1
    taskActors[id]=cases[id].owner
    if(assignmentRequest.value===id)assignmentRequest.value=null
    observationReady[id]=false;observationRounds[id]=1;observationRecords[id]=[];observationHistory[id]=[];observationTargets[id]=cases[id].observation.days
    if(selectedTodoId.value===id)selectedTodoId.value=null
    if(situationObservationId.value===id)situationObservationId.value=null
    eventStatus[id]='pending'
    return true
  }
  function startObservation(id){
    if(cases[id].realCaseId)return
    if(!executionObservationReady(id)||observationRecords[id].length)return
    observationRecords[id].push({day:0,label:'处理后首测',values:[...observationConfig[id].samples[0]],status:'normal',executedAt:executionRecords[id]?.at(-1)?.values.executedAt||null,source:'处理后观测节点',note:'处理后首测，仍需后续可比记录验证持续效果'})
    if(isWorkflow(id))recordStory(id,'observation','处理后首测',observationConfig[id].names.map((name,i)=>name+' '+observationRecords[id].at(-1).values[i]+' '+observationConfig[id].units[i]).join('；'),'首测不能证明持续恢复，后续在可比窗口验证。')
  }
  function getObservationResult(id){return observationResult(id,observationRecords[id],observationTargets[id])}
  function sceneFor(id,stage){if(stage.kind==='handled')return {title:stage.title,paragraphs:completedTasks[id]?[{label:'本次结果',text:completedTasks[id].reason},{label:'后续安排',text:cases[id].trackingOnly?'本次人工核实已结束，原长期健康记录继续保留与更新。':'本次决定及来源记录保留，原计划不自动取消。'}]:[{label:'实际措施',text:executionRecords[id]?.at(-1)?.values.measures||'请查看实际执行记录。'},{label:'后续验证',text:executionObservationReady(id)?'现场验收已提交，后续可比节点在设备态势查看；最终闭环需人工确认。':'尚缺可比记录，当前不生成改善结论。'}]};if(stage.kind==='observe')return observationScene(id,observationRecords[id],observationTargets[id]);if(stage.kind==='closed'){const scene=stageScene(id,stage);scene.paragraphs.push({label:'观察结论',text:getObservationResult(id).text});return scene}if(isWorkflow(id))return {title:stage.title,expanded:true,markdown:stageReport({cases,checkAssessments,stageHistory},id,stage)};return stageScene(id,stage)}
  function reviewObservation(id){
    if(cases[id].realCaseId){if(getObservationResult(id).type==='continue')applyObservationPreset(id,'stable');return}
    if(!executionObservationReady(id)||!isTaskHandled(id)||getObservationResult(id).type!=='continue')return
    startObservation(id)
    const day=observationRecords[id].at(-1).day+1,c=observationConfig[id]
    observationRecords[id].push({day,label:`第${day}日`,values:[...c.samples[Math.min(day,c.samples.length-1)]],status:'normal',note:id==='drift'?'同工况偏差收敛，未见异响复现':'同工况复测稳定，未见原异常反复'})
    observationReady[id]=getObservationResult(id).type==='archive'
    if(isWorkflow(id))recordStory(id,'observation',`第${day}日效果记录`,c.names.map((name,i)=>name+' '+observationRecords[id].at(-1).values[i]+' '+c.units[i]).join('；'),getObservationResult(id).text)
    addLog(id,'user','查看后续可比观测节点')
    addLog(id,'assistant',{kind:'scene',...observationScene(id,observationRecords[id],observationTargets[id])})
  }
  function recordObservationEvidence(id,status,text){
    if(!isTaskHandled(id)||!executionObservationReady(id)||eventStatus[id]==='closed'){
      addLog(id,'assistant','当前尚不能更新效果判断；请先核对任务状态并补充可比记录，已闭环资料继续保留。');return false
    }
    startObservation(id)
    const day=observationRecords[id].at(-1)?.day||0
    observationRecords[id].push({day,label:`第${day}日补充`,values:status==='abnormal'&&!cases[id].realCaseId?[...observationConfig[id].abnormal]:null,status,note:text,isSimulation:Boolean(cases[id].realCaseId)})
    observationReady[id]=false
    if(isWorkflow(id))recordStory(id,'observation',status==='abnormal'?'观察出现反复':'观察资料待补',text,'保留前轮措施与本轮观察，沿原任务继续。')
    addLog(id,'assistant',{kind:'scene',...observationScene(id,observationRecords[id],observationTargets[id])})
  }
  function extendObservation(id){
    if(getObservationResult(id).type!=='extend')return
    if(cases[id].realCaseId){observationTargets[id]++;observationRecords[id].push({day:observationRecords[id].at(-1).day,label:'延长观察窗口',values:null,status:'extended',note:'延长24小时，等待另外补充可比记录；没有生成新的采样。',isSimulation:true});return}
    const day=observationRecords[id].at(-1).day+1,c=observationConfig[id]
    observationTargets[id]=Math.max(observationTargets[id],day-1)+1
    observationRecords[id].push({day,label:`第${day}日`,values:[...c.samples[Math.min(day,c.samples.length-1)]],status:'normal',note:'延长跟踪24小时后，同工况记录已补齐，未见原异常反复'})
    observationReady[id]=getObservationResult(id).type==='archive'
    addLog(id,'assistant',{kind:'scene',...observationScene(id,observationRecords[id],observationTargets[id])})
    if(!observationReady[id])scheduleObservation(id)
  }
  function reopenTodo(id){
    delete openedStages[id+':handled']
    if(observationTimers[id]){clearTimeout(observationTimers[id]);delete observationTimers[id]}
    if(getObservationResult(id).type!=='reinspect')return
    if(isWorkflow(id)){workflowRounds[id]++;eventStatus[id]='assigned';delete checkAssessments[id];delete completedTasks[id]}
    const index=cases[id].stages.findIndex(s=>s.id===(isMaintenanceWorkflow(cases[id])?'check':'investigate'))
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
    addLog(mode,'assistant',{kind:'scene',title:mode==='ship'?'船舶运行概况 · 自动播报':mode==='device'?'主机每日健康回顾':'传感器趋势',paragraphs:mode==='ship'?[{label:'运行概要',text:'远洋6号当前航行中，接入10台设备，4台重点设备在线展示。'},{label:'关注分布',text:`主机有${attention.filter(item=>item.tab==='attention' && attentionAction(item.id).phase!=='已结束').length}项未结束关注、${todoCreated.maintenance?0:1}项待确认维保建议，${visibleTodos.value.filter(t=>!isTaskHandled(t.id)).length}项未处理待办。`}]:mode==='device'?[{label:'当前结论',text:`${todoCreated.drift?(progress.drift>=2?'3#缸异常已确立，排查由关联待办接续，持续效果由设备态势跟踪':'3#缸检查待办已建立，等待现场确认'):'3#缸排温单缸偏离正在监测'}；4#缸反复偏差由系统跟踪；压力与机体振动为普通数据，不计入关注。`},{label:'计划与执行',text:`1#缸连杆轴承${todoCreated.maintenance?'维保待办已建立':'有1项提前维保建议'}；冷却水温异常${progress.fault===4?'已闭环':'仍需跟进'}。`}]:[{label:'数据查看',text:'可切换传感器、时间范围或多趋势对比，查看同一工况下的变化。'}],question:mode==='ship'?'以下为系统连续推送的设备变化、证据与待办建议。':mode==='device'?'优先核对3#缸异动和冷却系统处理进展；稳定监测仍由系统持续跟踪。有现场发现可以直接补充。':'哪个时间段或现场现象需要一起核对？'})
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
    if(mode==='device') {const report=deviceStoryAssessment({todoCreated,isTaskHandled,completedTasks,ignoredSuggestions},'main-engine-1');addLog(id,'assistant',/依据|原因|数据/.test(value)?report.basis:report.conclusion+'\n\n'+report.next);return}
    if (/维保|轴承|1#缸/.test(value)) addLog(id, 'assistant', '主机的1#缸连杆轴承接近计划检修时数，振动缓升。请进入轴承异动跟踪的“健康趋势观测”查看建议，并决定是否建立人工检查待办。')
    else if (/关注|排温|3#缸/.test(value)) addLog(id, 'assistant', '主机的3#缸需要核实，4#缸反复偏差由系统跟踪；2#缸已结束。压力和机体振动保留为普通数据，不计入关注。')
    else addLog(id, 'assistant', mode === 'sensor' ? '可在左侧选择传感器查看趋势；设备层的异动跟踪及其阶段性建议保留在上一层。' : '请先进入左侧主机设备层。健康趋势内保留阶段性建议，人工待办沿原任务接续。')
  }

  function resetDemo() {
    storyJournal.splice(0);dailyHealthReports.splice(0)
    for(const collection of [checkAssessments,completedTasks,eventStatus,healthUpdates,stageHistory,workflowRounds,unlockedRecommendations])Object.keys(collection).forEach(key=>delete collection[key])
    Object.assign(cases,JSON.parse(JSON.stringify(scenarioCases)))
    Object.keys(stageAssignments).forEach(id=>delete stageAssignments[id])
    Object.values(observationTimers).forEach(clearTimeout)
    Object.keys(observationTimers).forEach(id=>delete observationTimers[id])
    situationObservationId.value=null
    selectedAttentionId.value = 'maintenance'
    selectedTodoId.value = null
    todoCreated.fault = false
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
    for(const records of [assignments,assignmentRecords,ignoredSuggestions])Object.keys(records).forEach(key=>delete records[key])
    suggestionDecisions.splice(0)
    assignmentRequest.value=null
    assignments.fault=defaultAssignment('fault')
    for(const id of ['fault','drift','maintenance'])taskActors[id]=defaultAssignment(id).owner
    Object.keys(executionRecords).forEach(key=>delete executionRecords[key])
    Object.keys(attentionFeedback).forEach(key=>delete attentionFeedback[key])
    Object.keys(dossierNotes).forEach(key=>delete dossierNotes[key])
    Object.keys(dossierReviews).forEach(key=>delete dossierReviews[key])
    deviceDataTopic.value=null
    Object.keys(situationVersions).forEach(key=>delete situationVersions[key])
    ;[taskResults,taskNotes,taskAttachments,workAcceptance,workAcceptanceNotes].forEach(data=>Object.keys(data).forEach(key=>delete data[key]))
    Object.keys(eventUpdatedAt).forEach(id=>delete eventUpdatedAt[id])
    eventUpdatedAt.fault='2026/10/12 07:50'
    ;['maintenance','drift','fault'].forEach(id=>{observationReady[id]=false;observationRounds[id]=1;observationRecords[id].splice(0);observationHistory[id].splice(0);observationTargets[id]=observationConfig[id].days})
    for(const item of additionalScenarios){const id=item.id;todoCreated[id]=item.initialCreated!==false;progress[id]=0;activeStage[id]=0;taskActors[id]=item.owner;assignments[id]={owner:item.owner,type:'检测排查',scope:item.report.human,due:'尽快核实并反馈',assignedBy:'陈志远（轮机长）'};eventUpdatedAt[id]='2026/10/12 07:30';observationReady[id]=false;observationRounds[id]=1;observationRecords[id].splice(0);observationHistory[id].splice(0);observationTargets[id]=item.observation.days}
    initializeWorkflows()
    captureHealthSnapshot()
    selectAttention('maintenance')
  }

  captureHealthSnapshot()
  selectAttention('maintenance')
  // Action completion is explicit and independent from chat and event progress.
  return {eventPortfolio,applyObservationPreset,resetRealScenario,openRealCase,storyJournal,dailyHealthReports,unlockedRecommendations,recordObservationEvidence,confirmFalseAlarm,checkAssessments,completedTasks,eventStatus,healthUpdates,stageHistory,workflowRounds,decideCheck,advanceHealthTrack,supplementObservation, captainEntry,showCaptainWorkbench,taskPortfolio,stageAssignments,assignStage,suggestionDecisions,assignmentRequest,taskActors,assignments,assignmentRecords,ignoredSuggestions,defaultAssignment,assignTask,ignoreSuggestion,executionRecords,executionInquiry,requestExecutionRecord,updateExecutionRecord,confirmExecutionRecord,executionObservationReady,eventUpdatedAt, deferR02Check, deviceDataTopic, sendR02Message, confirmR02Check, dossierReviews, askDossierQuestion, dossierNotes, registerDossierNote, attentionFeedback, attentionAction, submitAttentionFeedback, observationIndex, isTaskHandled, effectObservations, caseMaterials, situationObservationId, selectObservation, clearObservationFocus, sendObservation, completeObservation, attention, cases, selectedAttentionId, selectedAttention, selectedTodo, selectedTodoId, visibleTodos, todoCreated, progress, activeStage, currentStage, monitorStep, logs, inputDraft, detailTab, attentionInFocus, regularMaintenanceInFocus, recordDrafts, taskResults, taskNotes, taskAttachments, workAcceptance, workAcceptanceNotes, dataViews, observationRecords, observationHistory, observationTargets, getObservationResult, observationReady, observationRounds, reviewObservation, extendObservation, reopenTodo, confirmQuickRecord, enterSituation, selectAttention, createTodo, sendAttention, sendSituation, nextMonitor, selectTodo, closeTodo, selectStage, advanceTodo, sendTodo, resetDemo }
})
