import {captainSituationBrief} from './captainCoordination.js'

const action=(id,label)=>({id,label})
const now=()=>new Date().toLocaleTimeString('zh-CN',{hour:'2-digit',minute:'2-digit'})

export function shipOverviewConversation(store){
 const report=captainSituationBrief(store)
 return {role:'assistant',kind:'scene',title:'轮机长态势研判',at:now(),markdown:report.markdown,paragraphs:[
  {label:'当前态势',text:report.overview},{label:'运行风险',text:report.riskText},{label:'设备变化',text:report.changeText},{label:'待决策事项',text:report.decisionText}
 ],actions:[action('ask:当前哪些事项需要人工跟进？','当前哪些事项需要人工跟进？')]}
}

export function shipSituationReply(store,text){
 const report=captainSituationBrief(store),rows=report.rows
 const match=/四缸|维保|备件|检修/.test(text)?'real-health-c4-baseline':/一缸|基线|月度/.test(text)?'real-tracking-exhaust-baseline':/预警|空气|低压|0523/.test(text)?'real-warning-0523':/报警|二缸|0430/.test(text)?'real-alarm-0430':null
 const selected=match?rows.filter(row=>row.id===match):rows
 if(match)return {role:'assistant',kind:'scene',title:'事项当前进展',at:now(),paragraphs:selected.length?selected.map(row=>({label:row.title,text:row.processingState+' · '+row.finding})):[{label:'当前安排',text:'当前未闭环事项中没有这项事件，既有处置与结束记录保留在事件目录。'}]}
 if(/人工|处理|待办|优先/.test(text))return {role:'assistant',kind:'scene',title:'轮机长需要跟进的事项',at:now(),markdown:`${report.overview}\n\n### 待决策事项\n\n${report.decisionText}\n\n${report.coordination}`}
 return shipOverviewConversation(store)
}
