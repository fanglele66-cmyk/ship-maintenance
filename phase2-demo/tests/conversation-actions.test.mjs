import test from 'node:test'
import assert from 'node:assert/strict'
import {createServer} from 'vite'
import {createSSRApp, createRenderer, h, ssrContextKey, nextTick} from 'vue'
import {renderToString} from '@vue/server-renderer'
import {createPinia,setActivePinia} from 'pinia'
import {conversationActions, dispatchConversationAction, isConversationQuestion} from '../src/message-flows/conversationActions.js'

const blocked=['device','todo','item:drift','todo:drift','todo:acceptance','issue:task','issue:section:decision','issue:section:效果观察','maintenance:event','maintenance:observation','maintenance:advice','maintenance:check','maintenance:execute','maintenance:supplement','maintenance:defer','ask:确认建立待办','unknown']

test('only known conversation questions can be displayed and dispatched',()=>{
  const calls=[]
  const handlers=Object.fromEntries(['issue','maintenance','situation'].map(channel=>[channel,text=>calls.push([channel,text])]))
  for(const id of blocked)assert.equal(dispatchConversationAction(id,handlers),false,id)
  assert.deepEqual(calls,[])
  assert.equal(dispatchConversationAction('issue:ask:evidence',handlers),true)
  assert.equal(dispatchConversationAction('maintenance:ask:arrangement',handlers),true)
  assert.equal(dispatchConversationAction('ask:当前哪些事项需要人工跟进？',handlers),true)
  assert.deepEqual(calls,[['issue','还需核实哪些信息？'],['maintenance','已有安排是否冲突？'],['situation','当前哪些事项需要人工跟进？']])
  assert.equal(dispatchConversationAction('issue:ask:next',{maintenance:handlers.maintenance}),false,'a question cannot dispatch into another assistant context')
  const actions=[...blocked.map(id=>({id,label:id})),{id:'issue:ask:next',label:'下一步如何安排？'}]
  assert.deepEqual(conversationActions(actions),[actions.at(-1)])
  assert.equal(actions.length,blocked.length+1,'source conversation history remains intact')
  assert.deepEqual(conversationActions(null),[])
  assert.equal(isConversationQuestion({action:'send',text:'今天有几件紧急事件？'}),true)
  for(const action of ['goto_event','start_check','chip_open_feedback','confirm_close','open_data'])assert.equal(isConversationQuestion({action,text:'今天有几件紧急事件？'}),false)
  assert.equal(isConversationQuestion({action:'send',text:'生成事件快照并跳转'}),false)
})

// A small Vue host exercises component event dispatch without a browser or DOM package.
function mountComponent(component,props,plugin){
  const node=(kind,text='')=>({kind,text,children:[],props:{}})
  const renderer=createRenderer({
    createElement:tag=>node(tag),createText:text=>node('#text',text),createComment:text=>node('#comment',text),
    insert(child,parent){child.parent=parent;parent.children.push(child)},remove(child){child.parent.children=child.parent.children.filter(item=>item!==child)},
    setText(target,text){target.text=text},setElementText(target,text){target.text=text},patchProp(target,key,old,value){target.props[key]=value},
    parentNode:target=>target.parent,nextSibling:()=>null
  })
  const app=renderer.createApp({...component,render:()=>null},props),root=node('root')
  app.provide(ssrContextKey,{})
  if(plugin)app.use(plugin)
  const vm=app.mount(root)
  return {app,root,instance:vm.$}
}

test('right-side messages retain content while navigation and confirmation controls stay unavailable',async t=>{
  const server=await createServer({optimizeDeps:{noDiscovery:true,include:[]},server:{middlewareMode:true,hmr:false,ws:false},appType:'custom'})
  try{
    const {default:MessageRenderer}=await server.ssrLoadModule('/src/components/messages/MessageRenderer.vue')
    const {default:InquiryMessage}=await server.ssrLoadModule('/src/components/messages/InquiryMessage.vue')
    const render=(message)=>renderToString(createSSRApp({render:()=>h(MessageRenderer,{message},{actions:()=>h('button','旧业务插槽')})}))
    const actions=[...blocked.map(id=>({id,label:'业务操作 '+id})),{id:'issue:ask:next',label:'下一步如何安排？'}]
    await t.test('scene messages filter saved actions and reject directly emitted workspace commands',async()=>{
      const message={role:'assistant',kind:'scene',title:'本轮判断',paragraphs:[{label:'事实',text:'现场反馈与前轮措施完整保留'}],actions}
      const html=await render(message)
      assert.match(html,/现场反馈与前轮措施完整保留/)
      assert.match(html,/下一步如何安排/)
      assert.doesNotMatch(html,/业务操作|旧业务插槽/)
      const emitted=[],mounted=mountComponent(MessageRenderer,{message,onAction:id=>emitted.push(id)})
      try{
        const ask=mounted.instance.setupState.ask
        assert.equal(typeof ask,'function')
        for(const id of blocked)ask(id)
        assert.deepEqual(emitted,[])
        ask('issue:ask:next')
        assert.deepEqual(emitted,['issue:ask:next'])
      }finally{mounted.app.unmount()}
    })
    await t.test('task receipts keep conclusions and only conversation questions',async()=>{
      const html=await render({role:'assistant',type:'taskReceipt',title:'跟踪任务回执',executionStatus:'completed',conclusion:'偏差仍需复核',arrangement:'等待左侧决策',actions})
      assert.match(html,/偏差仍需复核/)
      assert.match(html,/下一步如何安排/)
      assert.doesNotMatch(html,/业务操作|旧业务插槽/)
    })
    await t.test('pending inquiry remains readable, while the same left-side component stays editable',async()=>{
      const message={id:'execution-1',type:'inquiry',role:'assistant',status:'pending',text:'本轮执行记录',fields:[{key:'measures',type:'textarea',label:'实际措施',required:true},{key:'confirmed',type:'boolean',label:'验收确认'}],values:{measures:'保留已填现场措施'},submitLabel:'确认执行'}
      const html=await render(message)
      assert.match(html,/实际措施/)
      assert.match(html,/保留已填现场措施/)
      assert.match(html,/未填写/)
      assert.doesNotMatch(html,/<form|<input|<textarea|<button/)
      const left=await renderToString(createSSRApp(InquiryMessage,{message}))
      assert.match(left,/<textarea/)
      assert.match(left,/<button type="submit">确认执行/)
      const receipt=await render({...message,status:'submitted',submittedAt:'10:00'})
      assert.match(receipt,/已提交 · 10:00/)
      assert.match(receipt,/保留已填现场措施/)
      const updates=[],mounted=mountComponent(InquiryMessage,{message,readOnly:true,onSubmitInquiry:value=>updates.push(value),onUpdateInquiry:value=>updates.push(value)})
      try{
        mounted.instance.setupState.update()
        await mounted.instance.setupState.submit()
        assert.deepEqual(updates,[],'read-only forms cannot dispatch writes even through a stale event')
      }finally{mounted.app.unmount()}
    })
    await t.test('record drafts keep their evidence without a confirmation button',async()=>{
      const html=await render({kind:'recordDraft',role:'assistant',title:'现场反馈草稿',task:'二轮排查',records:[{label:'喷射控制',result:'仍需复测',note:'原反馈内容'}]})
      assert.match(html,/仍需复测/)
      assert.match(html,/原反馈内容/)
      assert.doesNotMatch(html,/<button|旧业务插槽/)
    })
    await t.test('actual event, maintenance, task and ship assistants reject stale commands without changing workspace state',async()=>{
      const {default:Phase2Assistant}=await server.ssrLoadModule('/src/components/Phase2Assistant.vue')
      const {usePhase2DemoStore}=await server.ssrLoadModule('/src/stores/phase2DemoStore.js')
      for(const props of [{mode:'issue',issueId:'real-alarm-0430'},{mode:'attention',maintenanceDetail:true},{mode:'todo'},{mode:'ship'}]){
        const pinia=createPinia();setActivePinia(pinia)
        const store=usePhase2DemoStore(),mounted=mountComponent(Phase2Assistant,props,pinia)
        try{
          await nextTick()
          const before=JSON.stringify(pinia.state.value)
          for(const id of blocked)assert.equal(mounted.instance.setupState.runDemoAction(id),false)
          await nextTick()
          assert.equal(JSON.stringify(pinia.state.value),before)
          const workspace=()=>JSON.stringify([store.todoCreated,store.assignments,store.progress,store.detailTab,store.selectedTodoId,store.selectedAttentionId])
          const workspaceBefore=workspace()
          const question=props.issueId?'issue:ask:next':props.maintenanceDetail?'maintenance:ask:basis':props.mode==='ship'?'ask:当前哪些事项需要人工跟进？':null
          if(question){
            assert.equal(mounted.instance.setupState.runDemoAction(question),true)
            await nextTick()
            assert.equal(workspace(),workspaceBefore,'follow-up questions do not navigate, dispatch tasks or advance stages')
          }
        }finally{mounted.app.unmount()}
      }
    })
    // Compile the legacy and knowledge views too, to catch template regressions.
    for(const name of ['AssistantPanel','KnowledgeAIPanel'])await server.ssrLoadModule(`/src/components/${name}.vue`)
  }finally{await server.close()}
})
