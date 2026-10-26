import {deviceStoryAssessment} from './fourStoryWorkflow.js'
import {workbenchIssues} from './captainWorkbench.js'

const action=(id,label)=>({id,label})
const mainEntry=action('device','查看主机设备态势')
const now=()=>new Date().toLocaleTimeString('zh-CN',{hour:'2-digit',minute:'2-digit'})

export function shipOverviewConversation(store){
 const report=deviceStoryAssessment(store,'main-engine-1')
 return {role:'assistant',kind:'scene',title:'船舶事项与处理安排',at:now(),paragraphs:[
  {label:'当前事项',text:report.conclusion},{label:'判断依据',text:report.basis},{label:'下一步',text:report.next},
  {label:'资料背景',text:'二缸报警、控制空气低压与一缸、四缸长期排温基线来自各自数据窗口。原始采样用于核对起因，月度相对偏差用于持续健康跟踪。'}
 ],actions:[mainEntry,action('ask:当前哪些事项需要人工跟进？','查看待跟进事项'),action('item:real-maintenance-c4-baseline','查看四缸专项检查建议')]}
}

export function shipSituationReply(store,text){
 const rows=workbenchIssues(store).filter(row=>store.cases[row.id]?.realCaseId)
 const match=/四缸|维保|备件|检修/.test(text)?'real-maintenance-c4-baseline':/一缸|基线|月度/.test(text)?'real-tracking-exhaust-baseline':/预警|空气|低压|0523/.test(text)?'real-warning-0523':/报警|二缸|0430/.test(text)?'real-alarm-0430':null
 const selected=match?rows.filter(row=>row.id===match):rows
 if(match||/人工|处理|待办|优先/.test(text))return {role:'assistant',kind:'scene',title:'事项当前进展',at:now(),paragraphs:selected.map(row=>({label:row.title,text:row.state+' · '+(store.checkAssessments[row.id]?.message||store.completedTasks[row.id]?.reason||row.summary)})),actions:selected.map(row=>action('item:'+row.id,'查看'+row.title))}
 return shipOverviewConversation(store)
}
