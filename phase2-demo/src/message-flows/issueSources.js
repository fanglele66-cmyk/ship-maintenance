import {pendingTrackingExample} from '@/mock/pendingTrackingExample'
import dossiers from '@/mock/issueDossiers.json'
import {issueCatalog} from '@/mock/captainWorkbench'

export function issueContext(id,store){
 const issue=issueCatalog.find(item=>item.id===id),dossier=id===pendingTrackingExample.id?{conclusion:pendingTrackingExample.baseline.conclusion,recommendation:pendingTrackingExample.config.scope,comparisons:[]}:dossiers[id]
 if(!issue||!dossier)return null
 const assigned=store.todoCreated[id],ignored=store.ignoredSuggestions[id]
 const next=assigned?`已派发给${store.assignments[id]?.owner||'原负责人'}，沿原任务查看现场反馈和当前进展，不重复安排。`:ignored?`本次不采纳依据：${ignored.reason}。原材料和周期计划保留；这不代表设备已恢复正常，可在左侧重新评估。`:dossier.recommendation
 return {issue,dossier,next,assigned,ignored}
}
export function initialIssueMessages(id,store){
 const context=issueContext(id,store);if(!context)return []
 const {issue,dossier,next}=context
 return [{id:'issue-start-user:'+id,role:'user',text:`查看${issue.device}“${issue.title}”的判断依据和处理建议`},{id:'issue-start-answer:'+id,role:'assistant',kind:'scene',expanded:true,title:'当前判断与安排',paragraphs:[{label:'初判',text:dossier.conclusion},{label:'关键依据',text:issue.evidence.join('；')},{label:'判断边界',text:issue.limit},{label:'下一步',text:next}],actions:[{id:'issue:ask:evidence',label:'还需核实哪些信息？'},{id:'issue:ask:next',label:'下一步如何安排？'}]}]
}
export function issueReply(id,text,store){
 const context=issueContext(id,store);if(!context)return {role:'assistant',text:'当前事项材料未找到，请返回态势中心核对。'}
 const {issue,dossier,next,assigned}=context
 const evidence=/依据|证据|原因|核实|数据|为什么/.test(text)
 const explanation=evidence?[{label:'已有依据',text:issue.evidence.join('；')},{label:'尚需核对',text:[...new Set((dossier.comparisons||[]).map(row=>row.missing).filter(Boolean))].join('；')||issue.limit},{label:'判断范围',text:issue.limit}]:[{label:'当前安排',text:next},{label:'处理边界',text:assigned?'具体检查、排查和验收在原待办中接续，轮机长无需重复派发。':'先审阅依据，再在左侧决定是否采纳并选择负责人；当前不会自动建立任务。'}]
 return {role:'assistant',kind:'scene',expanded:true,title:evidence?'核实依据与缺项':'下一步安排',paragraphs:explanation,actions:[{id:evidence?'issue:section:证据资料':assigned?'issue:task':'issue:section:decision',label:evidence?'查看证据资料':assigned?'查看原待办':'查看决策区'}]}
}
