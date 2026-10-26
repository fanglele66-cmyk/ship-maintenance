export const observationReviewOptions = [
  {key:'continue',label:'已有改善，继续观察'},
  {key:'incomplete',label:'资料不足，延长观察'},
  {key:'abnormal',label:'原异常反复，返回复查'},
  {key:'stable',label:'持续稳定，待确认闭环'},
]

export function observationReviewFields(config, key) {
  if(!['continue','incomplete'].includes(key))return []
  const incomplete=key==='incomplete'
  return [
    {key:'day',label:'距本轮执行的完整天数',type:'number',min:0,required:true},
    ...config.names.map((name,i)=>({key:'value'+i,label:name+'（'+config.units[i]+'）'+(incomplete?' · 已取得时填写':''),type:'number',required:!incomplete})),
    {key:'conditions',label:incomplete?'缺失时段或不可比工况':'可比工况与测量时间',type:'text',required:true},
    {key:'note',label:incomplete?'缺项说明与补充安排':'本次观察情况与记录来源',type:'textarea',required:true},
  ]
}

export function parseObservationReview(config,key,values={},lastDay=0) {
  if(!observationReviewOptions.some(option=>option.key===key))return null
  if(!['continue','incomplete'].includes(key))return {day:lastDay,values:null,note:''}
  const day=Number(values.day),conditions=String(values.conditions||'').trim(),note=String(values.note||'').trim()
  if(values.day==null||values.day===''||!Number.isInteger(day)||day<lastDay||!conditions||!note)return null
  const numbers=config.names.map((_,i)=>values['value'+i]==null||String(values['value'+i]).trim()===''?null:Number(values['value'+i]))
  if(numbers.some(value=>value!==null&&!Number.isFinite(value))||key==='continue'&&numbers.some(value=>value===null))return null
  return {day,values:numbers.every(value=>value===null)?null:numbers,conditions,note:conditions+'；'+note}
}
