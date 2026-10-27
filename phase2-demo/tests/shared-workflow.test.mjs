import test from 'node:test'
import assert from 'node:assert/strict'
import {createServer} from 'vite'
import {createPinia,setActivePinia,disposePinia} from 'pinia'
import {createRenderer,createSSRApp,ssrContextKey,nextTick} from 'vue'
import {renderToString} from '@vue/server-renderer'

function mountSetup(component,props,pinia){
 const node=()=>({children:[],props:{}})
 const renderer=createRenderer({createElement:node,createText:node,createComment:node,insert(child,parent){child.parent=parent;parent.children.push(child)},remove(){},setText(){},setElementText(){},patchProp(){},parentNode:node=>node.parent,nextSibling:()=>null})
 const app=renderer.createApp({...component,render:()=>null},props);app.provide(ssrContextKey,{});app.use(pinia)
 const vm=app.mount(node());return {app,state:vm.$.setupState}
}

test('two work surfaces share drafts and submit explicit, traceable business records',async t=>{
 const server=await createServer({optimizeDeps:{noDiscovery:true,include:[]},server:{middlewareMode:true,hmr:false,ws:false},appType:'custom'})
 const originalNow=Date.now,pinias=[]
 Date.now=()=>Date.parse('2026-10-27T09:01:00+08:00')
 try{
  const {usePhase2DemoStore}=await server.ssrLoadModule('/src/stores/phase2DemoStore.js')
  const {useSensorStore}=await server.ssrLoadModule('/src/stores/sensorStore.js')
  const {assistantWorkflowTask,assistantWorkflowReply}=await server.ssrLoadModule('/src/message-flows/assistantWorkflow.js')
  const id='real-alarm-0430'
  function fresh(){const pinia=createPinia();pinias.push(pinia);setActivePinia(pinia);useSensorStore().configureSimulation({enabled:false});return {pinia,store:usePhase2DemoStore()}}
  function toCheck(store){store.ensureAssignmentDraft(id);assert.equal(store.submitSharedAssignment(id).ok,true);store.selectTodo(id);store.advanceTodo(id);assert.equal(store.cases[id].stages[store.progress[id]].kind,'check')}
  function fillFeedback(store,{work=false,incomplete=false}={}){
   const form=store.stageFeedbackForm(id),values={}
   for(const field of form.fields){if(field.key.startsWith('result_'))values[field.key]=work?(incomplete&&field.key==='result_0'?'未完成':'已完成'):(field.key==='result_0'?'发现异常':'未见异常');else values[field.key]='现场实际记录：'+field.label}
   assert.equal(store.updateStageFeedback(id,values,form.id),true)
   return {form,values}
  }
  function toWork(store){toCheck(store);const {form}=fillFeedback(store);assert.equal(store.submitStageFeedback(id,form.id).ok,true);assert.equal(store.cases[id].stages[store.progress[id]].kind,'work')}
  function executionValues(store){
   const form=store.executionInquiry(id)
   return {...form.values,...Object.fromEntries(form.fields.filter(field=>field.acceptanceItem).map(field=>[field.key,'现场验收已核对：'+field.label])),executedAt:'2026-10-27T09:00',measures:'按本轮实际发现完成批准范围内的措施',acceptance:'接口、动作与原异常现场验收记录已留存',verification:'resolved'}
  }
  function accept(store){const form=store.executionInquiry(id);assert.equal(store.confirmExecutionRecord(id,form.id,executionValues(store)),true);return form}

  await t.test('assignment draft is one shared object and a repeated submission adds no duplicate dispatch',()=>{
   const {store}=fresh(),left=store.ensureAssignmentDraft(id),right=store.ensureAssignmentDraft(id)
   assert.equal(left,right)
   store.updateAssignmentDraft(id,{owner:'王海涛（二管轮）',scope:'核对二缸指令、现场反馈与燃油供给',due:'2026-10-27T13:00'})
   assert.equal(left.owner,'王海涛（二管轮）')
   assert.equal(right.scope,'核对二缸指令、现场反馈与燃油供给')
   assert.equal(store.submitSharedAssignment(id).ok,true)
   const before=JSON.stringify([store.assignmentRecords[id],store.storyJournal,store.logs[id]])
   assert.equal(store.submitSharedAssignment(id).alreadySubmitted,true)
   assert.equal(JSON.stringify([store.assignmentRecords[id],store.storyJournal,store.logs[id]]),before)
   assert.equal(store.assignments[id].scope,left.scope)
   assert.equal(store.assignmentRecords[id].length,1)
  })

  await t.test('a required completion time must be a future date before any task is dispatched',()=>{
   const {store}=fresh(),draft=store.ensureAssignmentDraft(id)
   assert.match(draft.due,/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/)
   assert.ok(Date.parse(draft.due+'+08:00')>Date.now())
   for(const due of ['', '尽快核实', '2026-10-27T08:00']){
    store.updateAssignmentDraft(id,{due})
    assert.equal(store.submitSharedAssignment(id).ok,false)
    assert.equal(store.todoCreated[id],false)
    assert.equal(store.assignmentRecords[id]?.length||0,0)
   }
  })

  await t.test('check feedback mirrors the left task fields, preserves evidence and rejects stale stage submissions',()=>{
   const {store}=fresh();toCheck(store)
   const form=store.stageFeedbackForm(id),stage=store.cases[id].stages[store.progress[id]]
   assert.equal(form.fields.length,stage.tasks.length*2)
   assert.equal(store.submitStageFeedback(id,form.id).ok,false,'blank results cannot advance')
   const {values}=fillFeedback(store)
   assert.equal(store.taskResults[id+':'+stage.id+':0'],'发现异常')
   store.taskNotes[id+':'+stage.id+':0']='左侧补充的原始现场证据'
   assert.equal(store.stageFeedbackForm(id).values.note_0,'左侧补充的原始现场证据')
   assert.equal(store.submitStageFeedback(id,form.id).ok,true)
   assert.equal(store.checkAssessments[id].records[0].note,'左侧补充的原始现场证据')
   const progress=store.progress[id],journal=store.storyJournal.length
   assert.equal(store.submitStageFeedback(id,form.id).ok,false,'an old click cannot submit the next repair form')
   assert.equal(store.updateStageFeedback(id,values,form.id),false)
   assert.equal(store.progress[id],progress)
   assert.equal(store.storyJournal.length,journal)
   assert.ok(store.stageFeedbackForm(id).fields.every(field=>!field.key.startsWith('result_')||field.options.some(option=>option.value==='未完成')))
  })

  await t.test('step feedback has its own receipt and unfinished work blocks resolved acceptance',()=>{
   const {store}=fresh();toWork(store)
   const {form}=fillFeedback(store,{work:true,incomplete:true})
   assert.equal(store.submitStageFeedback(id,form.id).ok,true)
   const after=JSON.stringify([store.workStepRecords,store.storyJournal,store.logs[id]])
   assert.equal(store.submitStageFeedback(id,form.id).alreadySubmitted,true)
   assert.equal(JSON.stringify([store.workStepRecords,store.storyJournal,store.logs[id]]),after)
   assert.equal(store.stageFeedbackForm(id).status,'submitted')
   assert.equal(store.executionRecords[id]?.length||0,0)
   assert.equal(store.observationRecords[id].length,0)
   const execution=store.executionInquiry(id)
   assert.equal(store.confirmExecutionRecord(id,execution.id,executionValues(store)),false)
   assert.match(execution.submitError,/未完成/)
   assert.equal(store.isTaskHandled(id),false)
   const history=store.logs[id].findLast(message=>message.title==='维修步骤记录已保存')
   const revision=store.reviseWorkStepFeedback(id)
   assert.ok(revision===true||revision?.ok)
   assert.equal(store.stageFeedbackForm(id).status,'pending')
   assert.equal(store.stageFeedbackForm(id).values.result_0,'未完成','revision retains the original draft to amend')
   const revised=fillFeedback(store,{work:true})
   assert.equal(store.submitStageFeedback(id,revised.form.id).ok,true)
   assert.equal(history.records[0].result,'未完成','the earlier submitted receipt remains unchanged')
   assert.doesNotMatch(store.executionInquiry(id).values.measures,/未完成/,'a derived acceptance summary follows revised work records')
   assert.equal(store.confirmExecutionRecord(id,execution.id,executionValues(store)),true)
  })

  await t.test('work notes are optional while individual completion results remain required',()=>{
   const {store}=fresh();toWork(store)
   const form=store.stageFeedbackForm(id)
   assert.ok(form.fields.filter(field=>field.key.startsWith('note_')).every(field=>!field.required))
   const values=Object.fromEntries(form.fields.map(field=>[field.key,field.key.startsWith('result_')?'已完成':'']))
   store.updateStageFeedback(id,values,form.id)
   assert.equal(store.submitStageFeedback(id,form.id).ok,true)
   assert.equal(store.stageFeedbackForm(id).status,'submitted')
   assert.equal(store.executionInquiry(id).status,'pending','saving work does not submit acceptance')
  })

  await t.test('item acceptance is shared, creates one independent receipt and does not automatically close',()=>{
   const {store}=fresh();toWork(store)
   const {form}=fillFeedback(store,{work:true});assert.equal(store.submitStageFeedback(id,form.id).ok,true)
   const execution=store.executionInquiry(id),items=execution.fields.filter(field=>field.acceptanceItem)
   assert.ok(items.length,'the execution inquiry includes each real acceptance item')
   for(const field of items)store.updateExecutionRecord(id,execution.id,{[field.key]:'现场逐项结果：'+field.label})
   assert.ok(items.every(field=>store.executionInquiry(id).values[field.key].startsWith('现场逐项结果')))
   assert.ok(items.every(field=>store.executionInquiry(id).values.acceptance.includes(field.label.replace(' · 验收记录',''))))
   const values={...execution.values,executedAt:'2026-10-27T09:00',verification:'resolved'}
   assert.equal(store.confirmExecutionRecord(id,execution.id,values),true)
   const before=JSON.stringify([store.executionRecords[id],store.storyJournal,store.logs[id]])
   assert.equal(store.confirmExecutionRecord(id,execution.id,values),true)
   assert.equal(JSON.stringify([store.executionRecords[id],store.storyJournal,store.logs[id]]),before)
   assert.equal(execution.status,'submitted')
   assert.equal(store.executionRecords[id].length,1)
   assert.ok(items.every(field=>store.executionRecords[id][0].values[field.key].startsWith('现场逐项结果')))
   assert.equal(store.eventStatus[id],'observing')
  })

  await t.test('early closure needs accepted work and a human reason, then remains idempotent',()=>{
   const {store}=fresh();toWork(store)
   assert.equal(store.completeObservation(id,{reason:'尚未验收也请求闭环'}).ok,false)
   accept(store)
   assert.notEqual(store.getObservationResult(id).type,'archive')
   assert.equal(store.completeObservation(id).ok,false)
   const left=store.ensureObservationDecision(id),right=store.ensureObservationDecision(id)
   left.choice='stable';left.reason='现场验收已通过；剩余运行窗口继续常规跟踪，轮机长确认本轮结束。'
   assert.equal(right.reason,left.reason)
   assert.equal(store.completeObservation(id,{reason:right.reason}).ok,true)
   assert.equal(store.observationRecords[id].at(-1).earlyClosure,true)
   assert.equal(store.observationRecords[id].at(-1).values,null)
   assert.equal(store.observationRecords[id].at(-1).note,left.reason)
   const before=JSON.stringify([store.observationRecords[id],store.storyJournal,store.logs[id]])
   assert.equal(store.completeObservation(id,{reason:'重复点击'}).alreadySubmitted,true)
   assert.equal(JSON.stringify([store.observationRecords[id],store.storyJournal,store.logs[id]]),before)
  })

  await t.test('shared recurrence decisions archive the prior round and open an empty next-round draft',()=>{
   const {store}=fresh();toWork(store);accept(store)
   const draft=store.ensureObservationDecision(id);draft.choice='abnormal';draft.note='本轮运行中再次出现原异常，已留存时刻与现场证据。'
   assert.equal(store.ensureObservationDecision(id),draft)
   assert.equal(store.submitObservationReview(id,'abnormal',{note:draft.note}),true)
   assert.equal(store.completeObservation(id,{reason:'不能用闭环覆盖异常'}).ok,false)
   store.reopenTodo(id)
   assert.equal(store.observationHistory[id].at(-1).records.at(-1).note,draft.note)
   assert.deepEqual({...store.ensureObservationDecision(id)},{choice:'',note:'',reason:''})
   assert.equal(store.observationRounds[id],2)
   assert.equal(store.stageFeedbackForm(id).status,'pending')
   assert.ok(Object.values(store.stageFeedbackForm(id).values).every(value=>value===''),'a new round cannot inherit answers from the previous round')
  })

  await t.test('right-side forms call the shared API and are interactive without making transcript receipts editable',async()=>{
   const {default:AssistantWorkflowPanel}=await server.ssrLoadModule('/src/components/AssistantWorkflowPanel.vue')
   const {store,pinia}=fresh(),panel=mountSetup(AssistantWorkflowPanel,{taskId:id},pinia)
   try{
    const state=panel.state
    state.updateAssignment({messageId:state.assignmentForm.id,values:{owner:'王海涛（二管轮）',type:'检测排查',scope:'右侧指定核查范围',due:'2026-10-27T13:00'}})
    assert.equal(store.ensureAssignmentDraft(id).scope,'右侧指定核查范围')
    state.submitAssignment({messageId:state.assignmentForm.id,values:state.assignmentForm.values})
    assert.equal(store.todoCreated[id],true)
    await nextTick()
    assert.equal(state.assignmentForm.status,'submitted')
    const introApp=createSSRApp(AssistantWorkflowPanel,{taskId:id});introApp.use(pinia)
    assert.doesNotMatch(await renderToString(introApp),/开始本阶段核实|开始派发核实/,'assigned tasks proceed directly to their feedback form')
    await nextTick()
    assert.equal(state.feedbackForm.status,'pending')
    const rendered=createSSRApp(AssistantWorkflowPanel,{taskId:id});rendered.use(pinia)
    const html=await renderToString(rendered)
    assert.match(html,/当前事项操作|本轮整表排查反馈/)
    assert.match(html,/提交本轮反馈/)
    assert.match(html,/<textarea|<select/)
    const original=state.feedbackForm.id,{values}=fillFeedback(store)
    state.submitFeedback({messageId:original,values});await nextTick()
    const count=store.storyJournal.length
    state.submitFeedback({messageId:original,values});await nextTick()
    assert.equal(store.storyJournal.length,count)
    assert.equal(state.feedbackForm.status,'pending','next work form remains unsubmitted after a stale click')
   }finally{panel.app.unmount()}
  })

  await t.test('editing existing assistant forms preserves the reading position; only new forms request reveal',async()=>{
   const {default:AssistantWorkflowPanel}=await server.ssrLoadModule('/src/components/AssistantWorkflowPanel.vue')
   const {default:Phase2Assistant}=await server.ssrLoadModule('/src/components/Phase2Assistant.vue')
   const {store,pinia}=fresh();toCheck(store)
   const reveals=[],scrolls=[],originalFrame=globalThis.requestAnimationFrame
   globalThis.requestAnimationFrame=callback=>callback()
   const panel=mountSetup(AssistantWorkflowPanel,{taskId:id,onReveal:target=>reveals.push(target)},pinia)
   const assistant=mountSetup(Phase2Assistant,{mode:'todo'},pinia)
   assistant.state.scrollRef={scrollHeight:2000,scrollTo:options=>scrolls.push(options)}
   const settle=async()=>{await nextTick();await nextTick()}
   try{
    await settle();reveals.length=0;scrolls.length=0
    for(const values of [{result_0:'发现异常'},{note_0:'二缸液压活塞卡滞'},{result_1:'未见异常'}]){
     store.updateStageFeedback(id,values,panel.state.feedbackForm.id);await settle()
     assert.deepEqual(reveals,[],'changing an existing check form must not reveal it again')
     assert.deepEqual(scrolls,[],'updated transcript values must not scroll the assistant')
    }
    const check=fillFeedback(store);store.submitStageFeedback(id,check.form.id);await settle()
    assert.ok(reveals.length,'entering repair reveals its new form')
    reveals.length=0;scrolls.length=0
    for(const values of [{result_0:'已完成'},{note_0:'获批范围已隔离'},{result_2:'已完成'}]){
     store.updateStageFeedback(id,values,panel.state.feedbackForm.id);await settle()
     assert.deepEqual(reveals,[])
     assert.deepEqual(scrolls,[])
    }
    const work=fillFeedback(store,{work:true});store.submitStageFeedback(id,work.form.id);accept(store);await settle()
    const draft=store.ensureObservationDecision(id);draft.choice='stable';await settle()
    assert.ok(reveals.includes(panel.state.decisionForm.id),'a newly selected decision reveals the matching form')
    reveals.length=0;scrolls.length=0
    draft.reason='轮机长确认现场验收及后续安排';await settle()
    assert.deepEqual(reveals,[],'typing a reason must not request another reveal')
    assert.deepEqual(scrolls,[])
   }finally{panel.app.unmount();assistant.app.unmount();if(originalFrame)globalThis.requestAnimationFrame=originalFrame;else delete globalThis.requestAnimationFrame}
  })

  await t.test('normal chat explains missing fields without dispatching, confirming, or altering sensor evidence',async()=>{
   const {default:Phase2Assistant}=await server.ssrLoadModule('/src/components/Phase2Assistant.vue')
   const {store,pinia}=fresh();toWork(store)
   const assistant=mountSetup(Phase2Assistant,{mode:'todo'},pinia)
   try{
    const before=JSON.stringify([store.todoCreated,store.progress,store.executionRecords,store.observationRecords,store.taskResults,store.taskNotes])
    assistant.state.draft='确认已完成并闭环；还缺哪些验收证据？'
    assistant.state.send();await nextTick()
    assert.equal(JSON.stringify([store.todoCreated,store.progress,store.executionRecords,store.observationRecords,store.taskResults,store.taskNotes]),before)
    const reply=store.logs[id].at(-1)
    assert.match(reply.markdown,/当前尚待填写|当前步骤与依据/)
    assert.match(reply.markdown,/聊天不会替代签认/)
    const explanation=assistantWorkflowReply(store,id,'还缺哪些资料，下一步怎么做？')
    assert.ok(explanation.markdown.includes(store.cases[id].stages[store.progress[id]].tasks[0].label))
   }finally{assistant.app.unmount()}
  })

  await t.test('the right-side retry keeps unknown findings and offers a fresh draft without forcing repair',async()=>{
   const {default:AssistantWorkflowPanel}=await server.ssrLoadModule('/src/components/AssistantWorkflowPanel.vue')
   const {store,pinia}=fresh();toCheck(store)
   const form=store.stageFeedbackForm(id),values=Object.fromEntries(form.fields.map(field=>[field.key,field.key.startsWith('result_')?'无法确认':'缺少对应现场读数，已保留待核查范围。']))
   store.updateStageFeedback(id,values,form.id)
   assert.equal(store.submitStageFeedback(id,form.id).ok,true)
   assert.equal(store.stageFeedbackForm(id).status,'submitted')
   assert.equal(store.cases[id].stages[store.progress[id]].kind,'check')
   const original=store.logs[id].findLast(message=>message.kind==='feedbackRecord')
   const panel=mountSetup(AssistantWorkflowPanel,{taskId:id},pinia)
   try{
    const rendered=createSSRApp(AssistantWorkflowPanel,{taskId:id});rendered.use(pinia)
    assert.match(await renderToString(rendered),/补充本轮排查反馈/)
    const reply=assistantWorkflowReply(store,id,'缺少哪些证据？')
    assert.match(reply.markdown,/尚未取得的证据/)
    panel.state.retryCheck();await nextTick()
    assert.equal(store.stageFeedbackForm(id).status,'pending')
    assert.equal(store.stageFeedbackForm(id).values.result_0,'无法确认')
    assert.equal(original.records[0].result,'无法确认')
    assert.equal(store.executionRecords[id]?.length||0,0)
   }finally{panel.app.unmount()}
  })

  await t.test('event panels select only tasks belonging to that event',()=>{
   const {store}=fresh()
   assert.equal(assistantWorkflowTask(store,{issueId:id,taskId:'real-warning-0523'}),id)
   assert.equal(assistantWorkflowTask(store,{taskId:'ship'}),null)
   store.todoCreated['real-maintenance-c4-baseline']=true
   assert.equal(assistantWorkflowTask(store,{issueId:'real-health-c4-baseline',taskId:'real-maintenance-c4-baseline'}),'real-maintenance-c4-baseline')
  })
 }finally{Date.now=originalNow;pinias.forEach(disposePinia);await server.close()}
})
