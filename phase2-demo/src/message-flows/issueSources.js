import {trackingDispositionSummary} from '@/mock/trackingDisposition'
import {storyDossier} from '@/mock/fourStoryWorkflow'
import {storyRevision,healthStoryMarkdown} from '@/mock/storyRecords'
import {workbenchIssues} from '@/mock/captainWorkbench'
import {parentIssueId,isTrackingContainer,maintenanceChildIds} from '@/mock/issueRelationships'
import {eventProcessRecords} from '@/mock/eventProcessRecords'
import {eventBriefingFor} from '@/mock/eventBriefings'

function briefingReply(id,text,context){
 const brief=eventBriefingFor(id);if(!brief)return null
 const {assigned,next,dossier}=context
 const sections=[]
 const decision=/为什么|为何|指派|轮机长|判断|决定|风险|不处理|不派/.test(text)
 const sources=/来源|资料|报警.*产生|怎么发现|如何发现/.test(text)
 const branches=/分支|之后|然后|结果|正常|异常|无法|忽略|不采纳|误报|结束|闭环/.test(text)
 const evidence=/数据|读数|指标|证据|依据|压力|转速|温度|方向|基线|月度|历史|偏差/.test(text)
 if(decision)sections.push(['需要您确认',brief.captainDecision],['建议指派的原因',brief.dispatchReason])
 if(sources)sections.push(['事件如何形成',brief.discovery.text],['关联资料',brief.sources.map(s=>`- ${s.title} · ${s.date}：${s.summary}`).join('\n')])
 if(evidence)sections.push(['数据依据',brief.facts.map(f=>`- **${f.label}：${f.value}${f.unit?' '+f.unit:''}** · ${f.at}\n  ${f.meaning}`).join('\n')])
 if(branches)sections.push(['按核实结果分流',brief.branches.map(b=>`- **${b.condition}**：${b.next}`).join('\n')])
 if(!sources&&(!sections.length||/核实|检查|任务|安排|下一步|怎么/.test(text)))sections.push(['本次核实要取得什么',brief.tasks.map(t=>`- **${t.title}**：${t.detail}`).join('\n')])
 if(dossier.hasUpdate)sections.push(['已提交反馈后的进展',dossier.currentMarkdown])
 sections.push(['当前安排',next],['尚待确认',brief.boundary])
 return {role:'assistant',kind:'scene',expanded:true,title:decision?'决策依据与指派范围':sources?'事件来源与数据依据':branches?'核实结果与后续处置':'本事件核实要点',markdown:sections.map(([label,content])=>`### ${label}\n\n${content}`).join('\n\n'),actions:[{id:assigned?'issue:task':isTrackingContainer(id)?'issue:section:健康趋势观测':'issue:section:decision',label:assigned?'继续原待办':isTrackingContainer(id)?'查看维保评估建议':'查看决策区'},{id:'issue:section:证据资料',label:'核对数据与资料'}]}
}

export function issueContext(id,store){
 id=parentIssueId(id)
 const issue=workbenchIssues(store).find(item=>item.id===id),dossier=storyDossier(store,id)
 if(!issue||!dossier.conclusion)return null
 const contextId=issue.taskId||issue.decisionId||issue.maintenanceRecommendations?.find(item=>item.decision)?.id||id
 const assigned=Boolean(issue.taskId&&!store.completedTasks?.[issue.taskId]&&!store.isTaskHandled?.(issue.taskId)&&issue.eventState!=='已闭环'),ignored=store.ignoredSuggestions[contextId]
 const disposition=store.trackingDispositions?.[id]
 const next=disposition?trackingDispositionSummary(disposition):issue.history?issue.outcome:store.completedTasks?.[contextId]?store.completedTasks[contextId].reason:assigned?`已派发给${store.assignments[contextId]?.owner||'原负责人'}，沿原任务查看现场反馈和当前进展，不重复安排。`:ignored?`本次不采纳依据：${ignored.reason}。原材料和周期计划保留；这不代表设备已恢复正常，可在健康趋势观测中重新评估。`:isTrackingContainer(id)?'在健康趋势观测中查看已形成的建议，分别确认提前必要性与作业条件；从建议派发评估，原跟踪继续。':dossier.recommendation
 return {issue,dossier,next,assigned,ignored,taskId:issue.taskId,decisionId:issue.decisionId}
}
export function initialIssueMessages(id,store){
 const context=issueContext(id,store);if(!context)return []
 const {issue,dossier,next}=context
 const current=dossier.currentMarkdown||store.checkAssessments?.[id]?.message||dossier.conclusion
 const revision=storyRevision(store,id)
 const node=(store.storyJournal||[]).find(entry=>entry.id===revision)
 const questions={sample:`查看${issue.device}${node?.title}的健康变化与下一步安排`,feedback:`查看${issue.device}本轮现场反馈后的判断与下一步`,decision:`查看${issue.device}本次核实决定及后续安排`,recommendation:`查看${issue.device}原健康跟踪新形成的提前维保评估依据`,assignment:`查看${issue.device}已派发任务的范围与安排`,execution:`查看${issue.device}本轮实际措施与验证记录`,closure:`查看${issue.device}本轮结束依据`}
 const question=questions[node?.kind]||`查看${issue.device}“${issue.title}”的当前进展和处理依据`
 return [{id:'issue-start-user:'+id+':'+revision,role:'user',text:question},{id:'issue-start-answer:'+id+':'+revision,role:'assistant',kind:'scene',expanded:true,title:'当前判断与安排',markdown:current,paragraphs:[{label:'初判',text:current},{label:'关键依据',text:issue.evidence.join('；')},{label:'判断边界',text:issue.limit},{label:'下一步',text:next}],actions:[{id:'issue:ask:evidence',label:'还需核实哪些信息？'},{id:'issue:ask:next',label:'下一步如何安排？'}]}]
}
// The captain receives submitted work as assistant reports, not as their own speech.
// The full original journal remains available in the event's processing records.
export function issueConversationMessages(id,store){
 const process=eventProcessRecords(store,parentIssueId(id))
 const messages=process.records.flatMap(record=>{
  const meta={eventProcess:true,eventRecordId:record.id,eventKind:record.kind,eventPhase:record.phase,eventBaseline:Boolean(process.reference)||record.kind==='source'||record.id===parentIssueId(id)+':analysis'||record.id.includes(':origin:'),at:[record.actor,record.at].filter(Boolean).join(' · ')}
  const returned=record.role==='user'&&!String(record.actor||'').includes('轮机长')
  if(returned)return [{...meta,id:'issue-process:'+id+':'+record.id,role:'assistant',kind:'scene',expanded:true,title:'现场回交 · '+record.title,markdown:`提交人：${record.actor||'任务负责人'}\n\n${[record.text,record.assessment].filter(Boolean).join('\n\n')}`,actor:record.actor,returnedRecord:true}]
  const message={...meta,id:'issue-process:'+id+':'+record.id,role:record.role,actor:record.actor,expanded:true,
   ...(record.role==='assistant'?{kind:'scene',title:record.title,markdown:[record.text,record.assessment].filter(Boolean).join('\n\n')}:{text:record.text})}
  return [message,...(record.role==='user'&&record.assessment?[{...meta,id:message.id+':reply',role:'assistant',kind:'scene',title:'本次反馈后的判断',markdown:record.assessment,expanded:true,at:['智能机舱研判',record.at].filter(Boolean).join(' · ')}]:[])]
 })
 const summary=initialIssueMessages(id,store).at(-1)
 if(summary)messages.push({...summary,issueSummary:true,issueRevision:storyRevision(store,id),afterEventRecordId:process.records.at(-1)?.id})
 return messages
}

// Reconcile automatic records by their stable IDs, retaining user questions next to
// the event revision they concerned. This also upgrades an already-open old session.
export function mergeIssueConversation(existing,incoming){
 const records=incoming.filter(message=>message.eventProcess),summary=incoming.find(message=>message.issueSummary)
 const recordIds=new Set(records.map(message=>message.eventRecordId)),lastId=records.at(-1)?.eventRecordId
 const initialId=records.findLast(message=>message.eventBaseline)?.eventRecordId||records[0]?.eventRecordId||lastId
 let anchor=initialId
 const groups=new Map(),seen=new Set()
 for(const message of existing){
  if(message.eventProcess){anchor=message.eventRecordId;continue}
  if(message.issueSummary||message.id?.startsWith('issue-start-')){
   const revision=message.issueRevision||message.id.split(':').at(-1)
   anchor=revision==='origin'?initialId:recordIds.has(revision)?revision:lastId
   continue
  }
  if(message.id&&seen.has(message.id))continue
  if(message.id)seen.add(message.id)
  const target=recordIds.has(message.afterEventRecordId)?message.afterEventRecordId:recordIds.has(anchor)?anchor:lastId
  const rows=groups.get(target)||[];rows.push({...message,afterEventRecordId:target});groups.set(target,rows)
 }
 const result=[]
 records.forEach((message,index)=>{
  result.push(message)
  if(records[index+1]?.eventRecordId===message.eventRecordId)return
  if(message.eventRecordId===lastId&&summary)result.push(summary)
  result.push(...(groups.get(message.eventRecordId)||[]))
 })
 if(!records.length)result.push(...(summary?[summary]:[]),...(groups.get(lastId)||[]))
 existing.splice(0,existing.length,...result)
 return existing
}
export function issueReply(id,text,store){
 const context=issueContext(id,store);if(!context)return {role:'assistant',text:'当前事件材料未找到，请返回态势中心核对。'}
 const {issue,dossier,next,assigned}=context
 const disposition=store.trackingDispositions?.[issue.id]
 if(disposition)return {role:'assistant',kind:'scene',expanded:true,title:'异动处置与后续安排',markdown:dossier.currentMarkdown,actions:[{id:'issue:section:decision',label:disposition.status==='closed'?'查看闭环结果与关联任务':'查看处置决策'},{id:'issue:section:处置记录',label:'查看完整处置记录'}]}
 const handledTaskId=[issue.taskId,issue.id,...maintenanceChildIds(issue.id)].find(id=>id&&store.todoCreated?.[id]&&store.isTaskHandled?.(id))
 if(issue.history||issue.eventState==='已闭环')return {role:'assistant',kind:'scene',expanded:true,title:'本事件闭环依据与记录',markdown:`### 闭环结果\n\n${dossier.reference?.result||next||dossier.conclusion}\n\n### 如何回查\n\n本对话保留发现、研判、派发、执行反馈与人工确认；左侧处置记录及证据资料保留来源和结果。已闭环事件不会再次进入待办。`,actions:[{id:'issue:section:处置记录',label:'查看处置记录'},{id:'issue:section:证据资料',label:'查看证据资料'}]}
 if(handledTaskId&&!assigned)return {role:'assistant',kind:'scene',expanded:true,title:'人工任务结果与事件后续',markdown:`### 已提交的人工结果\n\n${dossier.currentMarkdown||next}\n\n### 后续安排\n\n本次人工任务已结束，已提交的反馈与判断保留在事件处置记录。${store.cases?.[issue.id]?.trackingOnly?'原健康趋势继续观察，新的现场核实需要重新明确范围。':'在本事件接续效果观察，依据可比记录和人工确认决定是否闭环。'}`,actions:[{id:'issue:section:处置记录',label:'查看处置记录'},{id:store.cases?.[issue.id]?.trackingOnly?'issue:section:健康趋势观测':'issue:section:效果观察',label:store.cases?.[issue.id]?.trackingOnly?'查看健康趋势观测':'接续效果观察'}]}
 if(id==='aux-health'&&store.healthUpdates?.['aux2-health'])return {role:'assistant',kind:'scene',expanded:true,title:'原健康记录与当前进展',markdown:healthStoryMarkdown(store,id),actions:[{id:'issue:section:证据资料',label:'查看原始数据与记录'}]}
 const briefResponse=briefingReply(parentIssueId(id),text,context)
 if(briefResponse)return briefResponse
 const evidence=/依据|证据|原因|核实|数据|为什么/.test(text)
 const explanation=evidence?[{label:'已有依据',text:issue.evidence.join('；')},{label:'尚需核对',text:[...new Set((dossier.comparisons||[]).map(row=>row.missing).filter(Boolean))].join('；')||issue.limit},{label:'判断范围',text:issue.limit}]:[{label:'当前安排',text:next},{label:'处理边界',text:assigned?'具体检查、排查和验收在原待办中接续，轮机长无需重复派发。':'先审阅依据，再在左侧决定是否采纳并选择负责人；当前不会自动建立任务。'}]
 const specific=id==='main-warning'&&/独立|压差|联合/.test(text)?'### 证据之间的关系\n\n压差由同刻上游减下游计算，与滤后供油压力共享原始测量，不能重复计作独立证明。上游也下降，因此还应核对上游供油及调节，不能只凭压差认定滤器堵塞。':id==='main-warning'&&/辅机|健康跟踪|长期/.test(text)?'### 两次核实的目标\n\n本次核实当前润滑供油风险，成立后继续原因排查；辅机核实补充长期健康背景，本次任务可结束，原趋势仍继续。动作都可能是读数和现场观察，目标及后续去向不同。':id==='main-warning'&&/更换|换件|滤芯/.test(text)?'### 是否可以决定换件\n\n读数一致只能支持当前供油变化，具体部件仍需实际检查。取得过滤段或其他方向的实际发现后，才确定相应措施；暂不预定更换。':id==='aux-health'&&/拆|寿命|换件/.test(text)?'### 当前判断范围\n\n持续排温偏移值得保留并核实，温度与其比较量仍不足以确定损坏部件或剩余寿命。先补测点、实际读数与背景；实际反馈决定如何解释，不能自动安排拆机。':''
 const health=isTrackingContainer(parentIssueId(id))
 return {role:'assistant',kind:'scene',expanded:true,title:evidence?'核实依据与缺项':'下一步安排',markdown:specific||explanation.map(item=>`### ${item.label}\n\n${item.text}`).join('\n\n'),paragraphs:explanation,actions:[{id:evidence?'issue:section:证据资料':assigned?'issue:task':health?'issue:section:健康趋势观测':'issue:section:decision',label:evidence?'查看证据资料':assigned?'查看原待办':health?'查看健康趋势观测':'查看决策区'}]}
}
