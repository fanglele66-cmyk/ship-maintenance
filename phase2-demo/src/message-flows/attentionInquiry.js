const fields = [
  {key:'reading',type:'number',label:'现场排温读数（°C）',required:true,min:0},
  {key:'conditions',type:'text',label:'运行工况与核对时间',placeholder:'转速／负荷、核对时间',required:true},
  {key:'phenomenon',type:'textarea',label:'现场现象',placeholder:'异响、波动等；未见异常也请说明',required:true},
  {key:'confirmed',type:'boolean',label:'已核对现场仪表与上述记录',required:true}
]
export function attentionInquiry(store,id,drafts={}) {
  const action=store.attentionAction(id),feedback=store.attentionFeedback[id]
  if(!action.required && !feedback)return null
  const messageId=`attention:${id}:field-verification:v1`
  return {id:messageId,type:'inquiry',role:'assistant',text:feedback?'本次现场核实记录':'请补充本次现场核实记录。',hint:feedback?'保留原提交信息，供后续分析与回看。':'普通留言不自动完成核实；提交不代表确认故障，也不会自动创建事件。',fields,
    status:feedback?'submitted':action.linked?'inactive':'pending',
    values:feedback || drafts[messageId] || {},submitLabel:'提交现场核实',submittedAt:feedback?.at,
    receiptText:store.dossierReviews?.[id]?'该项核实已完成，演示研判分支已更新。':'该项核实已完成，后续分析尚未更新。'}
}
