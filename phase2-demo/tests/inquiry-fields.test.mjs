import test from 'node:test'
import assert from 'node:assert/strict'
import { assertInquiry, inquiryValues, validateInquiry, displayInquiryValue } from '../src/message-flows/inquiryFields.js'
import { attentionInquiry } from '../src/message-flows/attentionInquiry.js'
import { resolveMessageFlow } from '../src/message-flows/resolveMessageFlow.js'
const message={id:'request-1',fields:[
  {key:'value',label:'读数',type:'number',min:0,max:100,required:true},
  {key:'state',label:'状态',type:'select',required:true,options:[{label:'零',value:0},{label:'正常',value:'ok'}]},
  {key:'tags',label:'标签',type:'multiselect',options:[{label:'A',value:'a'}]},
  {key:'note',label:'说明',type:'textarea',required:true},
  {key:'checked',label:'确认',type:'boolean',required:true}
]}
test('inquiry defaults, validation, enum labels and numeric zero',()=>{
  assert.deepEqual(inquiryValues(message),{value:'',state:'',tags:[],note:'',checked:false})
  const valid={value:0,state:0,tags:['a'],note:'未见异常',checked:true}
  assert.deepEqual(validateInquiry(message,valid),{})
  assert.deepEqual(Object.keys(validateInquiry(message,{...valid,value:101,state:'invalid',tags:['b'],note:' ',checked:false})),['value','state','tags','note','checked'])
  assert.equal(displayInquiryValue(message.fields[1],0),'零')
  assert.equal(displayInquiryValue(message.fields[2],['a']),'A')
  assert.equal(displayInquiryValue(message.fields[0],0),'0')
})
test('invalid schemas are rejected by flow resolver too',()=>{
  for(const fields of [[],[...message.fields,message.fields[0]],[{key:'x',label:'X',type:'unknown'}],[{key:'x',label:'X',type:'select',options:[]}],[{key:'__proto__',label:'X',type:'text'}]]) assert.throws(()=>assertInquiry({...message,fields}))
  const config={version:1,messages:[{id:'request',type:'inquiry',source:'request'}]}
  assert.equal(resolveMessageFlow(config,{request:message})[0].type,'inquiry')
  assert.throws(()=>resolveMessageFlow(config,{request:{fields:[]}}))
})
test('attention adapter requests required feedback then renders receipt',()=>{
  const store={attentionAction:()=>({required:false}),attentionFeedback:{}}
  assert.equal(attentionInquiry(store,'drift'),null)
  store.attentionAction=()=>({required:true})
  const request=attentionInquiry(store,'drift')
  assert.equal(request.status,'pending')
  const draft={reading:432,conditions:'稳定负荷，08:00',phenomenon:'未见异常',confirmed:true}
  assert.deepEqual(attentionInquiry(store,'drift',{[request.id]:draft}).values,draft)
  assert.deepEqual(validateInquiry(request,draft),{})
  store.attentionFeedback.drift={...draft,at:'08:02'}
  store.attentionAction=()=>({required:false})
  assert.equal(attentionInquiry(store,'drift').status,'submitted')
  assert.equal(attentionInquiry(store,'drift').submittedAt,'08:02')
})
