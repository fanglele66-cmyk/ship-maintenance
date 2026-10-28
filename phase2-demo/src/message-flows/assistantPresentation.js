// Read-only presentation of the current workflow. Submitted records stay intact.
const plain = value => String(value || '').replace(/^#{1,6}\s+/gm, '').replace(/\*\*/g, '').trim()
export function briefText(value, limit = 150) {
 const text = plain(value).replace(/\s+/g, ' ')
 if(text.length <= limit)return text
 const sentences = text.match(/[^。！？]+[。！？]?/g) || [text]
 let result = ''
 for(const sentence of sentences){if(result && result.length + sentence.length > limit)break;result += sentence;if(result.length >= limit)break}
 return result.length > limit ? result.slice(0,limit).trimEnd()+'…' : result
}
const firstSentence = value => plain(value).match(/^[^。！？]*[。！？]?/)?.[0] || ''

export function workflowAdvice(store, id, {audience = 'captain', brief, context} = {}) {
 const item = store.cases?.[id], issue = context?.issue
 if(!item && !issue)return null
 const stage = item?.stages?.[store.progress?.[id] || 0]
 const assigned = Boolean(store.todoCreated?.[id])
 const assignment = store.assignments?.[id]
 const assessment = store.checkAssessments?.[id]
 const completed = store.completedTasks?.[id]
 const tracking = store.trackingDispositions?.[id]
 const handled = Boolean(store.isTaskHandled?.(id))
 const closed = store.eventStatus?.[id] === 'closed' || issue?.history || issue?.eventState === '已闭环'
 const round = store.workflowRounds?.[id] || stage?.round || 1
 const form = assigned && !handled ? store.stageFeedbackForm?.(id) : null
 const submission = form?.status === 'submitted' ? 'submitted' : 'pending'
 const quiet = audience === 'captain' && assigned && !handled && !completed && !closed && !['review','recommendation','observing'].includes(tracking?.status)
 // Only committed transitions identify a new recommendation. Draft fields, sensor
 // refreshes and the clock must never replace or multiply a prior reply.
 const phase = closed ? 'closed' : tracking && audience === 'captain' ? 'tracking:'+tracking.status+':'+(tracking.observationRound || 0) : completed ? 'complete:'+completed.action : !assigned ? 'dispatch' : handled ? 'observation' : quiet ? 'executing' : (stage?.id || stage?.kind || 'preparation')+':'+submission
 const committedRevision = audience==='assignee' && submission==='submitted' ? form?.submittedAt || '' : completed?.at || ''
 const lifecycleKey = [id,audience,round,phase,...(committedRevision?[committedRevision]:[])].join(':')
 const evidence = (brief?.facts || []).slice(0,3).map(fact=>({label:fact.label,text:`${fact.value}${fact.unit?' '+fact.unit:''} · ${fact.at}`}))
 const records = (assessment?.records || []).map(record=>({label:record.label,text:[record.result,record.note].filter(Boolean).join('；')}))
 let analysis = firstSentence(brief?.conclusion || context?.dossier?.conclusion || item?.report?.conclusion || stage?.summary)
 let recommendation = '', actionLabel = ''
 if(closed){
  analysis = briefText(completed?.reason || context?.dossier?.reference?.result || context?.next || '本轮处置与人工闭环确认已完成，相关记录已归档。')
  recommendation = '保留本轮结论与后续安排，继续关注设备运行；有新的异常时记录发生时刻和工况。'
 }else if(audience === 'captain' && tracking && ['review','recommendation','observing'].includes(tracking.status)){
  analysis = tracking.status==='recommendation'?'核实结果已形成维保建议，现在需要确定执行安排。':tracking.status==='observing'?'本次已安排专项观察，需结合新增结果决定后续处理。':'现场核实结果已回交，需要您确认变化解释及下一步安排。'
  recommendation = tracking.status==='recommendation'?'请确认维保负责人、计划窗口、实施范围和作业条件。':tracking.status==='observing'?'核对本轮观察结果，选择继续观察、安排维保或确认闭环。':'请结合回交结果，选择确认变化解释、形成维保建议或补证继续观察。'
  actionLabel = tracking.status==='recommendation'?'确认维保安排':'确认后续安排'
 }else if(completed){
  analysis = briefText(completed.reason || '本次核实已提交，已有结果和未确认项已保留。')
  recommendation = audience==='captain'?'请结合已回交结果确认后续安排。':'本次结果已回交轮机长，保留未完成项与后续交接记录。'
 }else if(!assigned){
  recommendation = briefText(brief?.captainDecision || context?.dossier?.recommendation || '建议明确现场核实范围，并安排负责人和完成时限。')
  actionLabel = '安排核实任务'
 }else if(handled && !item?.trackingOnly){
  const result = store.getObservationResult?.(id)
  analysis = briefText(result?.text || '维修验收已提交，当前进入处理后的效果观察。')
  recommendation = audience==='captain'?'建议结合自动观测和现场验收作决定：异常反复时提交复查；确认处理结果后可说明依据并闭环。':'执行与验收记录已回交，后续由轮机长结合效果观察确认复查或闭环。'
  if(audience==='captain')actionLabel = '确认观察结果'
 }else if(audience === 'captain'){
  analysis = assessment ? briefText(assessment.message || analysis) : `任务已派发给${assignment?.owner || item?.owner || '指定负责人'}，正在${['intro','overview'].includes(stage?.kind)?'等待现场核实':stage?.label || '执行'}。`
  recommendation = assessment?'建议核对现场发现和未完成项，协调所需备件、人员与作业窗口。':`建议关注${assignment?.due?' '+assignment.due.replace('T',' ')+' 前的':''}回交进度；如现场条件影响执行，及时调整安排。`
 }else if(stage?.kind === 'work'){
  const acceptedSteps = form?.status === 'submitted'
  analysis = acceptedSteps?'本轮作业步骤已保存，接下来需要逐项确认现场验收结果。':briefText(assessment?.message || stage.summary || '本轮已明确处置范围，请按获批措施开展作业。')
  recommendation = acceptedSteps?'请逐项记录验收结果、执行时间和实际措施；验收通过后进入效果观察。':'建议按步骤记录已实施、未完成或不适用的项目，再提交现场验收。'
  actionLabel = acceptedSteps?'填写验收结果':'填写作业反馈'
 }else if(stage?.kind === 'check'){
  const submitted = form?.status === 'submitted'
  analysis = submitted ? briefText(assessment?.message || '本轮检查结果已提交。') : firstSentence(stage.summary) || analysis
  const tasks = (stage.tasks || []).slice(0,2).map(task=>task.label).join('、')
  recommendation = submitted?'请根据已提交的检查发现确认下一步安排，仍需核实的项目可以继续补充。':`建议先对齐数据与发生时刻，再${tasks || '逐项核实现场情况'}，提交检查结果。`
  actionLabel = submitted?'确认本轮安排':'填写排查结果'
 }else{
  recommendation = '先查看数据观测与准备事项，再按当前步骤提交现场反馈。'
  actionLabel = '填写当前反馈'
 }
 const basis = records.length ? records : evidence.length ? evidence : [{label:'当前依据',text:context?.dossier?.conclusion || stage?.summary || analysis}]
 const initialAdvice = audience === 'captain' && assigned ? {
  analysis:firstSentence(brief?.conclusion || context?.dossier?.conclusion || item?.report?.conclusion),
  recommendation:briefText(brief?.captainDecision || '建议明确现场核实范围，并安排负责人和完成时限。'),
  basis:evidence, boundary:brief?.boundary || '', lifecycleKey:[id,audience,1,'dispatch'].join(':'),actionLabel:''
 } : null
 return {id:'assistant-advice:'+id,role:'assistant',presentation:'advice',title:'AI检修助手建议',analysis,recommendation,actionLabel,basis:basis.filter(row=>row.text),boundary:brief?.boundary || '',currentAdvice:true,lifecycleKey,audience,quiet,initialAdvice,executor:assignment?.owner || item?.owner || '任务负责人'}
}

const clone = value => JSON.parse(JSON.stringify(value))
function hash(value){let result=2166136261;for(const char of value)result=Math.imul(result^char.charCodeAt(0),16777619);return (result>>>0).toString(36)}
function messageKeys(messages){
 const counts=new Map()
 return messages.map(message=>{
  if(message.id)return message.id
  const base=hash([message.role,message.kind||message.type,message.stageId,message.task,message.title,message.text,message.at,message.submittedAt].join('|'))
  const count=counts.get(base)||0;counts.set(base,count+1)
  return 'workflow-message:'+base+':'+count
 })
}
const automaticNavigation = message => message.role==='user' && (/^(查看|进入)(任务概览|原因排查|对应处置|基线核实|维修|第\d+轮|专项检查|作业条件)/.test(message.text||'') || /^查看本轮反馈后的.+安排$/.test(message.text||''))
const hiddenSource = message => message.eventBaseline || message.issueSummary || message.id?.startsWith('task-dispatch:') || (message.type==='inquiry'||message.purpose==='execution-record') && message.status!=='submitted' || message.stageId && message.kind==='scene' || automaticNavigation(message)
function submittedSubject(message,previous){
 const source=[message.eventKind,message.title,message.text,previous?.text].filter(Boolean).join(' ')
 if(message.purpose==='execution-record'||/验收|实际执行与验收/.test(source))return '验收结果'
 if(/work-progress|维修步骤|作业记录|作业反馈/.test(source))return '作业记录'
 if(/基线核实|作业条件|核实结果/.test(source))return '核实结果'
 return '排查结果'
}

/** Store immutable render snapshots separately from reconciled business messages. */
export function reconcileWorkflowAdvice(conversation,messages,advice,{animate=false}={}){
 if(!advice)return false
 const history=conversation.adviceHistory ||= []
 // A returning captain may first mount after dispatch. Restore the original
 // event recommendation before the dispatch receipt, never invented dialogue.
 if(!history.length && advice.initialAdvice?.analysis){
  const seed={...advice,...advice.initialAdvice,initialAdvice:undefined,quiet:false,currentAdvice:false,animate:false,afterMessageId:null}
  seed.id='assistant-advice-history:'+seed.lifecycleKey
  history.push(clone(seed))
 }
 if(advice.quiet || history.some(item=>item.lifecycleKey===advice.lifecycleKey))return false
 const keys=messageKeys(messages)
 let anchor=null
 messages.forEach((message,index)=>{if(!hiddenSource(message))anchor=keys[index]})
 const snapshot=clone({...advice,id:'assistant-advice-history:'+(advice.lifecycleKey||advice.id),initialAdvice:undefined,animate,afterMessageId:anchor})
 history.push(snapshot)
 return true
}

function projectMessage(message,messages,index,advice){
 if(hiddenSource(message))return null
 // The structured receipt contains the exact submitted form. Avoid repeating
 // its entire contents as a second, synthetic user utterance.
 if(message.role==='user' && /^提交.+(反馈|步骤记录)[：:]/.test(message.text||'') && messages[index+1]?.kind==='feedbackRecord')return null
 if(message.role==='user' && /^确认实际执行记录[：:]/.test(message.text||'') && messages.some(row=>row.type==='inquiry'&&row.status==='submitted'&&row.purpose==='execution-record'))return null
 if(message.eventProcess){
  const returned=message.returnedRecord || message.role==='user'&&message.actor&&!message.actor.includes('轮机长')
  const title=returned?`AI检修助手已记录${message.actor||'执行人员'}提交的${submittedSubject(message)}`:message.title || (message.actor?.includes('轮机长')?'轮机长决定已记录':'已提交现场反馈')
  return {...message,role:returned?'assistant':message.role,presentation:'receipt',title}
 }
 if(['feedbackRecord','recordDraft'].includes(message.kind) || message.type==='inquiry'&&message.status==='submitted'){
  const title=message.title || message.text || '本轮反馈已提交'
  const actor=message.actor || message.executor || message.values?.executor || advice?.executor || '任务负责人'
  return {...message,presentation:'receipt',role:advice?.audience==='assignee'?'user':message.role,title:advice?.audience==='assignee'?actor+'提交了'+submittedSubject(message,messages[index-1]):title}
 }
 if(message.role==='assistant' && message.kind==='scene'){
  const sections=String(message.markdown||'').split(/\n(?=###? )/)
  const next=sections.find(section=>/^###? (下一步|当前安排|后续安排)/.test(section.trim()))?.replace(/^###? [^\n]+\n+/,'')
  const first=sections.find(section=>!/^###? (下一步|当前安排|后续安排)/.test(section.trim()))?.replace(/^###? [^\n]+\n+/,'')
  return {...message,presentation:'advice',analysis:briefText(first || message.paragraphs?.[0]?.text || message.text),recommendation:briefText(next || message.paragraphs?.find(row=>/下一步|安排/.test(row.label))?.text || ''),detailsMarkdown:message.markdown,basis:message.markdown?[]:message.paragraphs?.slice(1).map(row=>({label:row.label,text:row.text}))||[]}
 }
 return message
}

// A projection only: conversations retain original messages, IDs and ordering.
// Source paragraphs live on the left; submitted records and actual questions remain here.
export function presentWorkflowConversation(messages, advice, history) {
 if(!advice)return messages
 if(history){
  const keys=messageKeys(messages),known=new Set(keys),groups=new Map(),rows=[]
  history.forEach(snapshot=>{
   const anchor=snapshot.afterMessageId&&known.has(snapshot.afterMessageId)?snapshot.afterMessageId:null
   const list=groups.get(anchor)||[]
   const current=!advice.quiet&&snapshot.lifecycleKey===advice.lifecycleKey
   list.push({...snapshot,currentAdvice:current,actionLabel:current?advice.actionLabel:'',animate:Boolean(snapshot.animate&&current)})
   groups.set(anchor,list)
  })
  rows.push(...(groups.get(null)||[]))
  messages.forEach((message,index)=>{
   const projected=projectMessage(message,messages,index,advice)
   if(projected)rows.push({...projected,id:message.id||keys[index]})
   rows.push(...(groups.get(keys[index])||[]))
  })
  return rows
 }
 let inserted = false
 const rows = []
 for(const message of messages){
  if(message.eventBaseline)continue
  if(message.issueSummary){rows.push(advice);inserted = true;continue}
  if(message.id?.startsWith('task-dispatch:') || message.stageId && message.kind === 'scene')continue
  if(message.role === 'user' && /^(查看|进入)(任务概览|原因排查|对应处置|基线核实|维修|第\d+轮|专项检查|作业条件)/.test(message.text || ''))continue
  if(message.eventProcess){
   rows.push({...message,presentation:'receipt',title:message.title || (message.actor?.includes('轮机长')?'轮机长决定已记录':'已提交现场反馈')})
  }else if(['feedbackRecord','recordDraft'].includes(message.kind) || message.type==='inquiry'&&message.status==='submitted'){
   rows.push({...message,presentation:'receipt',title:message.title || message.text || '本轮反馈已提交'})
  }else if(message.role === 'assistant' && message.kind === 'scene'){
   const sections = String(message.markdown || '').split(/\n(?=###? )/)
   const next = sections.find(section=>/^###? (下一步|当前安排|后续安排)/.test(section.trim()))?.replace(/^###? [^\n]+\n+/, '')
   const first = sections.find(section=>!/^###? (下一步|当前安排|后续安排)/.test(section.trim()))?.replace(/^###? [^\n]+\n+/, '')
   rows.push({...message,presentation:'advice',analysis:briefText(first || message.paragraphs?.[0]?.text || message.text),recommendation:briefText(next || message.paragraphs?.find(row=>/下一步|安排/.test(row.label))?.text || ''),detailsMarkdown:message.markdown,basis:message.markdown?[]:message.paragraphs?.slice(1).map(row=>({label:row.label,text:row.text})) || []})
  }else rows.push(message)
 }
 if(!inserted)rows.push(advice)
 return rows
}
