import test from 'node:test'
import assert from 'node:assert/strict'
import {createServer} from 'vite'
import {createPinia,setActivePinia,disposePinia} from 'pinia'
import {createRenderer,ssrContextKey,nextTick,createSSRApp} from 'vue'
import {renderToString} from '@vue/server-renderer'

function mount(component,props,pinia){
 const node=()=>({children:[]})
 const renderer=createRenderer({createElement:node,createText:node,createComment:node,insert(child,parent){child.parent=parent;parent.children.push(child)},remove(){},setText(){},setElementText(){},patchProp(){},parentNode:node=>node.parent,nextSibling:()=>null})
 const app=renderer.createApp({...component,render:()=>null},props);app.provide(ssrContextKey,{});app.use(pinia)
 const vm=app.mount(node());return {app,state:vm.$.setupState}
}

test('captain and assignee workspaces keep their own conversations and task-read state',async t=>{
 const server=await createServer({optimizeDeps:{noDiscovery:true,include:[]},server:{middlewareMode:true,hmr:false,ws:false},appType:'custom'}),pinias=[]
 const id='real-alarm-0430'
 try{
  const {usePhase2DemoStore}=await server.ssrLoadModule('/src/stores/phase2DemoStore.js')
  const {useSensorStore}=await server.ssrLoadModule('/src/stores/sensorStore.js')
  const {default:Panel}=await server.ssrLoadModule('/src/components/AssistantWorkflowPanel.vue')
  const {default:Assistant}=await server.ssrLoadModule('/src/components/Phase2Assistant.vue')
  const {issueConversationMessages}=await server.ssrLoadModule('/src/message-flows/issueSources.js')
  const {assistantWorkflowReply}=await server.ssrLoadModule('/src/message-flows/assistantWorkflow.js')
  const fresh=()=>{const pinia=createPinia();pinias.push(pinia);setActivePinia(pinia);useSensorStore().configureSimulation({enabled:false});return {pinia,store:usePhase2DemoStore()}}
  const dispatch=(store,task=id)=>{store.ensureAssignmentDraft(task);assert.equal(store.submitSharedAssignment(task).ok,true)}
  const html=async(pinia,audience,task=id)=>{const app=createSSRApp(Panel,{taskId:task,audience});app.use(pinia);return renderToString(app)}

  await t.test('captain dispatch does not open the assignee stage or consume its unread notice',async()=>{
   const {pinia,store}=fresh(),panel=mount(Panel,{taskId:id,audience:'captain'},pinia)
   try{
    dispatch(store);await nextTick()
    assert.equal(store.progress[id],0)
    assert.equal(store.selectedTodoId,null)
    assert.deepEqual([...store.unreadTaskIds],[id])
    const rendered=await html(pinia,'captain')
    assert.match(rendered,/已派发任务进展/)
    assert.doesNotMatch(rendered,/提交本轮反馈|保存维修步骤记录|提交验收结果/)
    assert.equal(panel.state.importMessage,null)
    assert.match(assistantWorkflowReply(store,id,'下一步怎么做',{audience:'captain'}).markdown,/负责人|轮机长关注/)
    assert.doesNotMatch(assistantWorkflowReply(store,id,'下一步怎么做',{audience:'captain'}).markdown,/当前尚待填写/)
    store.selectTodo(id);store.advanceTodo(id);await nextTick()
    assert.deepEqual([...store.unreadTaskIds],[id],'progress and background selection do not acknowledge reading')
    store.markTaskRead(id);assert.deepEqual([...store.unreadTaskIds],[])
    const count=store.taskNoticeVersions[id]
    assert.equal(store.submitSharedAssignment(id).alreadySubmitted,true)
    assert.equal(store.taskNoticeVersions[id],count)
    store.updateAssignmentDraft(id,{owner:'王海涛（二管轮）'});store.submitSharedAssignment(id)
    assert.deepEqual([...store.unreadTaskIds],[id],'a revised assignment is unread again')
    store.resetRealScenario(id);assert.deepEqual([...store.unreadTaskIds],[])
   }finally{panel.app.unmount()}
  })

  await t.test('assignee sees task feedback while submitted evidence reaches captain as an attributed report',async()=>{
   const {pinia,store}=fresh();dispatch(store);store.selectTodo(id)
   const panel=mount(Panel,{taskId:id,audience:'assignee'},pinia)
   try{
    await nextTick();assert.match(await html(pinia,'assignee'),/提交本轮反馈/)
    assert.doesNotMatch(await html(pinia,'assignee'),/确认派发任务|效果观察人工决定/)
    const form=store.stageFeedbackForm(id),values=Object.fromEntries(form.fields.map(field=>[field.key,field.key.startsWith('result_')?'无法确认':'现场资料已回交，待补同刻测量依据。']))
    store.updateStageFeedback(id,values,form.id);store.submitStageFeedback(id,form.id)
    const messages=issueConversationMessages(id,store)
    assert.ok(messages.some(message=>message.role==='user'&&message.eventKind==='assignment'))
    assert.ok(messages.some(message=>message.role==='assistant'&&message.returnedRecord&&message.markdown.includes('现场资料已回交')))
    assert.ok(messages.filter(message=>message.role==='user').every(message=>message.actor?.includes('轮机长')))
    const historical=issueConversationMessages('real-health-c4-baseline',store)
    assert.ok(historical.some(message=>message.returnedRecord&&message.actor?.includes('大管轮')))
    assert.ok(historical.filter(message=>message.role==='user').every(message=>message.actor?.includes('轮机长')))
   }finally{panel.app.unmount()}
  })

  await t.test('drafts, free questions, histories and owner switches are isolated by workspace and person',async()=>{
   const {pinia,store}=fresh();dispatch(store);store.selectTodo(id);store.advanceTodo(id)
   const captain=mount(Assistant,{mode:'ship',issueId:id},pinia),assignee=mount(Assistant,{mode:'todo'},pinia)
   try{
    await nextTick()
    assert.notEqual(captain.state.agentId,assignee.state.agentId)
    captain.state.draft='轮机长专用问题：需要协调哪些备件？';captain.state.send()
    assignee.state.draft='大管轮专用问题：排查记录如何填写？';assignee.state.send();await nextTick()
    const captainText=JSON.stringify(captain.state.displayedMessages),assigneeText=JSON.stringify(assignee.state.displayedMessages)
    assert.ok(captainText.includes('轮机长专用问题'));assert.ok(!captainText.includes('大管轮专用问题'))
    assert.ok(assigneeText.includes('大管轮专用问题'));assert.ok(!assigneeText.includes('轮机长专用问题'))
    captain.state.draft='轮机长未发送草稿';assignee.state.draft='大管轮未发送草稿'
    const firstOwner=store.assignments[id].owner
    store.assignTask(id,{...store.assignments[id],owner:'王海涛（二管轮）'});await nextTick()
    assert.equal(assignee.state.draft,'');assert.ok(!JSON.stringify(assignee.state.displayedMessages).includes('大管轮专用问题'))
    assert.equal(captain.state.draft,'轮机长未发送草稿')
    store.assignTask(id,{...store.assignments[id],owner:firstOwner});await nextTick()
    assert.equal(assignee.state.draft,'大管轮未发送草稿')
   }finally{captain.app.unmount();assignee.app.unmount()}
  })
 }finally{pinias.forEach(disposePinia);await server.close()}
})
