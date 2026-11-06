import test from 'node:test'
import assert from 'node:assert/strict'
import {createServer} from 'vite'
import {createRenderer,createSSRApp,h,nextTick,ssrContextKey} from 'vue'
import {renderToString} from '@vue/server-renderer'
import {createPinia,setActivePinia,disposePinia} from 'pinia'
import {createLifecycleState,decide,currentTask,ensureTaskPlan,people} from '../src/workflow/eventLifecycle.js'

const id='real-alarm-0430'
const png='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aFh0AAAAASUVORK5CYII='
const photo={name:'现场.png',mimeType:'image/png',dataUrl:png}
function fixture(){const state=createLifecycleState(),event=state.events[id];ensureTaskPlan(event);decide(state,id,{action:'investigate',owner:people.engineer,deadline:new Date(Date.now()+86400000).toISOString(),reason:'核对二缸现场信息。'});state.role='engineer';return state}
function mount(component,pinia,props){
 const node=()=>({children:[]})
 const renderer=createRenderer({createElement:node,createText:node,createComment:node,insert(child,parent){child.parent=parent;parent.children.push(child)},remove(){},setText(){},setElementText(){},patchProp(){},parentNode:node=>node.parent,nextSibling:()=>null})
 const app=renderer.createApp({...component,render:()=>null},props)
 app.config.warnHandler=()=>{};app.provide(ssrContextKey,{});app.use(pinia)
 const vm=app.mount(node());return {app,state:vm.$.setupState,props:vm.$.props}
}

test('C2 step collaboration scopes drafts, routes complete current-step scripts and requires explicit send and adoption',async t=>{
 const oldWindow=globalThis.window,oldReader=globalThis.FileReader
 globalThis.window={addEventListener(){}}
 globalThis.FileReader=class{readAsDataURL(file){this.result=file.dataUrl;queueMicrotask(()=>this.onload())}}
 const server=await createServer({optimizeDeps:{noDiscovery:true,include:[]},server:{middlewareMode:true,hmr:false,ws:false},appType:'custom'}),pinia=createPinia()
 setActivePinia(pinia)
 let mounted
 try{
  const {useEventLifecycleStore}=await server.ssrLoadModule('/src/stores/eventLifecycleStore.js')
  const {useSensorStore}=await server.ssrLoadModule('/src/stores/sensorStore.js')
  const {default:Assistant}=await server.ssrLoadModule('/src/components/LifecycleAssistant.vue')
  const {default:Proposal}=await server.ssrLoadModule('/src/components/StepNoteProposal.vue')
  const {STEP_ASSIST_DEMO_CASES}=await server.ssrLoadModule('/src/workflow/stepAssistDemo.js')
  useSensorStore().configureSimulation({enabled:false})
  const store=useEventLifecycleStore(),fixtureState=fixture();store.state.events=fixtureState.events;store.state.role='engineer'
  const event=store.state.events[id],task=currentTask(event),props={event,taskId:task.id,activeStepIndex:0}
  mounted=mount(Assistant,pinia,props)
  const state=mounted.state,sent=[]
  store.assistStep=async(...args)=>{sent.push(args)}

  await t.test('focus and continue editing preserve manual text and never send automatically',async()=>{
   state.input='人工输入尚未发送';assert.equal(state.assistStep(0),true);await nextTick()
   assert.equal(state.mode,'step');assert.equal(state.input,'人工输入尚未发送');assert.equal(sent.length,0)
   state.reviseStep({id:'draft-0',stepIndex:0});await nextTick()
   assert.equal(state.input,'人工输入尚未发送');assert.equal(state.editingMessageId,'draft-0');assert.equal(sent.length,0)
   state.askFollowup('还需哪些信息？');assert.equal(state.input,'人工输入尚未发送\n还需哪些信息？');assert.equal(sent.length,0,'a follow-up does not discard a prepared draft')
   state.input='人工输入尚未发送'
   state.images=[photo];state.attachments=[{name:'记录.txt',text:'待复核的现场记录'}]
   mounted.props.activeStepIndex=1;await nextTick()
   assert.equal(state.mode,'chat');assert.equal(state.input,'');assert.deepEqual(state.images,[])
   assert.equal(state.assistStep(1),true);state.input='第二步未发送'
   mounted.props.activeStepIndex=0;await nextTick();state.assistStep(0)
   assert.equal(state.input,'人工输入尚未发送');assert.equal(state.images[0].name,'现场.png');assert.equal(state.attachments[0].name,'记录.txt')
   assert.equal(state.assistStep(1),false);assert.match(state.submitError,/先返回第 2 步/)
  })

  await t.test('images and text files have removable previews and are passed to the selected step',async()=>{
   state.images=[];state.attachments=[]
   const file={name:'照片.png',type:'image/png',size:68,dataUrl:png}
   await state.attachPhotos({target:{files:[file],value:'fakepath'}})
   assert.equal(state.images.length,1);assert.equal(state.images[0].dataUrl,png)
   state.images.splice(0,1);assert.equal(state.images.length,0)
   await state.attachPhotos({target:{files:[{...file,size:3*1024*1024+1}],value:''}})
   assert.match(state.fileNotice,/3 MB/);assert.equal(state.images.length,0)
   await state.attachPhotos({target:{files:[{...file,type:'image/svg+xml'}],value:''}})
   assert.match(state.fileNotice,/PNG、JPEG 或 WebP/);assert.equal(state.images.length,0)
   await state.attachPhotos({target:{files:[file],value:''}})
   await state.attach({target:{files:[{name:'现场.txt',size:20,text:async()=> 'ICU 检查记录，原因待核实。'}],value:''}})
   assert.equal(state.attachments[0].name,'现场.txt')
   await state.ask('请结合现场照片整理备注')
   assert.equal(sent.length,1);assert.deepEqual(sent[0].slice(0,4),[id,task.id,0,'请结合现场照片整理备注'])
   assert.equal(sent[0][4].images[0].dataUrl,png);assert.equal(sent[0][4].attachments[0].text,'ICU 检查记录，原因待核实。')
   assert.equal(state.input,'');assert.equal(state.images.length,0);assert.equal(state.attachments.length,0)
   assert.equal(task.draft.records[0].result,'');assert.equal(task.draft.records[0].note,'')
  })

  await t.test('a failed request restores original material without overwriting new input',async()=>{
   let rejectRequest
   store.assistStep=()=>new Promise((resolve,reject)=>{rejectRequest=reject})
   state.input='原始待发送记录';state.images=[photo]
   const request=state.ask(state.input);state.input='等待期间新增的人工记录';rejectRequest(Error('网络中断'));await request
   assert.equal(state.input,'原始待发送记录\n等待期间新增的人工记录');assert.equal(state.images[0].dataUrl,png)
   assert.match(state.submitError,/网络中断/)
  })

  await t.test('adoption writes only the note and emits one receipt while proposal UI reflects its state',async()=>{
   const proposal={id:'proposal-0',kind:'step-assist',stepIndex:0,baseNote:'',baseStep:JSON.stringify(task.steps[0]),status:'complete',at:new Date().toISOString(),response:{kind:'draft',text:'请核对下面的记录草稿。',note:'现场检查尚待补充独立读数；原因暂未确认。'}}
   task.conversations.engineer.push(proposal)
   assert.equal(task.draft.records[0].note,'','receiving a proposal does not adopt it')
   const render=message=>renderToString(createSSRApp(Proposal,{message}))
   const draftHtml=await render(proposal);assert.match(draftHtml,/采用到本步骤/);assert.match(draftHtml,/继续修改/);assert.doesNotMatch(draftHtml,/radio|checkbox/)
   state.applyStepNote(proposal.id)
   assert.equal(task.draft.records[0].note,proposal.response.note);assert.equal(task.draft.records[0].result,'')
   assert.equal(task.conversations.engineer.filter(m=>m.response?.kind==='receipt').length,1)
   assert.match(await render(proposal),/disabled[^>]*>已采用到本步骤/)
   assert.doesNotMatch(await render({response:{kind:'question',text:'现场核对的读数是多少？'}}),/采用到本步骤|继续修改/)
   assert.match(await render({status:'streaming',progress:'正在核对现场图片…'}),/正在核对现场图片/)
  })

  await t.test('image entry and conversation thumbnails are accessible and limited to C2 tasks',async()=>{
   task.conversations.engineer.push({id:'photo-user',kind:'user',text:'现场照片',stepAssistance:true,stepIndex:0,images:[photo],attachments:[{name:'附记.txt',text:'附记'}],at:new Date().toISOString()})
   const render=extra=>renderToString(createSSRApp({render:()=>h(Assistant,{...props,...extra})}).use(pinia))
   const html=await render();assert.match(html,/aria-label="添加现场照片"/);assert.match(html,/capture="environment"/);assert.match(html,/查看图片：现场.png/);assert.match(html,/附件 · 附记.txt/)
   assert.ok(html.indexOf('aria-label="添加文件"')<html.indexOf('aria-label="添加现场照片"'));assert.ok(html.indexOf('aria-label="添加现场照片"')<html.indexOf('class="composer-voice"'));assert.ok(html.indexOf('class="composer-voice"')<html.indexOf('class="composer-send"'))
   assert.doesNotMatch(await render({taskId:''}),/aria-label="添加现场照片"/)
  })

  await t.test('receipt emphasis preserves plain text and cannot inject HTML',async()=>{
   const render=message=>renderToString(createSSRApp(Proposal,{message}))
   const html=await render({response:{kind:'receipt',text:'本步骤已记录。可以点击“下一步”继续；下一步核对接口 <img src=x onerror=alert(1)>。'}})
   assert.equal((html.match(/<strong class="step-note-next"[^>]*>下一步<\/strong>/g)||[]).length,2)
   assert.match(html,/本步骤已记录/);assert.match(html,/核对接口/);assert.match(html,/&lt;img/);assert.doesNotMatch(html,/<img|<script/)
   assert.doesNotMatch(await render({response:{kind:'receipt',text:'已到最后一步，请核对记录后提交。'}}),/step-note-next/)
   assert.doesNotMatch(await render({response:{kind:'question',text:'下一步需要哪些信息？'}}),/step-note-next/)
  })

  await t.test('note presentation removes legacy framing while retaining raw messages and material limits',async()=>{
   const note='【虚构演示】液压活塞三次回位不畅；未继续内部拆修，具体原因未确认。所述图片为 AI 生成示意样例，不作本轮现场证据。'
   const message={id:'legacy-draft',kind:'step-assist',source:'scripted-demo',stepIndex:0,response:{kind:'draft',text:'请核对草稿。',note}}
   const html=await renderToString(createSSRApp(Proposal,{message}))
   assert.match(html,/液压活塞三次回位不畅/);assert.match(html,/未继续内部拆修，具体原因未确认/)
   assert.doesNotMatch(html,/【虚构演示】|AI 生成示意样例/)
   assert.equal(message.response.note,note);assert.equal(message.source,'scripted-demo')
   task.conversations.engineer.push({id:'legacy-user',kind:'user',text:note,at:new Date().toISOString()})
   const conversation=await renderToString(createSSRApp({render:()=>h(Assistant,props)}).use(pinia))
   const userHtml=conversation.match(/<article[^>]*data-message-id="legacy-user"[^>]*>([\s\S]*?)<\/article>/)?.[1]
   assert.match(userHtml,/【虚构演示】/);assert.match(userHtml,/AI 生成示意样例/)
  })

  await t.test('sending a complete current-step script enters step mode without restoring stale cached material',async()=>{
   const script=STEP_ASSIST_DEMO_CASES.find(item=>item.kind==='investigation'&&item.stepIndex===1),sentStep=[],sentChat=[]
   assert.ok(script)
   store.assistStep=async(...args)=>{sentStep.push(args)};store.ask=async(...args)=>{sentChat.push(args)}
   mounted.props.activeStepIndex=1;task.draft.stepIndex=1;await nextTick()
   state.assistStep(1);state.input='本步骤上次未发送的草稿';state.images=[{...photo,name:'旧照片.png'}];state.setMode('chat')
   const newPhoto={...photo,name:'当前照片.png'},file={name:'本次记录.txt',text:'仅属于本次输入的现场信息'}
   state.input=script.input;state.images=[newPhoto];state.attachments=[file]
   await state.ask(state.input)
   assert.equal(state.mode,'step');assert.equal(state.stepIndex,1);assert.equal(sentChat.length,0);assert.equal(sentStep.length,1)
   assert.deepEqual(sentStep[0].slice(0,4),[id,task.id,1,script.input])
   assert.deepEqual(sentStep[0][4],{images:[newPhoto],attachments:[file]})
   assert.equal(state.input,'');assert.deepEqual(state.images,[]);assert.deepEqual(state.attachments,[])
   assert.equal(task.draft.records[1].result,'');assert.equal(task.draft.records[1].note,'')
  })

  await t.test('failed automatic routing restores the visible input and materials for the current step',async()=>{
   const script=STEP_ASSIST_DEMO_CASES.find(item=>item.kind==='investigation'&&item.stepIndex===1)
   state.setMode('chat');state.input=script.input;state.images=[photo]
   store.assistStep=async()=>{throw Error('暂时无法处理，请重试。')}
   await state.ask(state.input)
   assert.equal(state.mode,'step');assert.equal(state.stepIndex,1)
   assert.equal(state.input,script.input);assert.deepEqual(state.images,[photo]);assert.match(state.submitError,/暂时无法处理/)
  })

  await t.test('automatic script routing never intercepts ordinary chat, another step, or report and plan modes',async()=>{
   const current=STEP_ASSIST_DEMO_CASES.find(item=>item.kind==='investigation'&&item.stepIndex===1),other=STEP_ASSIST_DEMO_CASES.find(item=>item.kind==='investigation'&&item.stepIndex===0),sentStep=[],sentChat=[]
   store.assistStep=async(...args)=>{sentStep.push(args)};store.ask=async(...args)=>{sentChat.push(args)}
   for(const [mode,text] of [['chat','请解释燃油供给的工作原理'],['chat',other.input],['chat',current.input+' 另外现场还有一个新异常。'],['report',current.input],['plan',current.input]]){
    state.setMode(mode);state.input=text;await state.ask(state.input)
    assert.equal(sentChat.at(-1)[1],text);assert.equal(sentChat.at(-1)[2].mode,mode)
   }
   assert.equal(sentStep.length,0);assert.equal(sentChat.length,5)
  })

  await t.test('automatic routing is disabled for another owner and submitted tasks',async()=>{
   const script=STEP_ASSIST_DEMO_CASES.find(item=>item.kind==='investigation'&&item.stepIndex===1),sentStep=[],sentChat=[]
   store.assistStep=async(...args)=>{sentStep.push(args)};store.ask=async(...args)=>{sentChat.push(args)}
   store.state.role='captain';await nextTick()
   state.input=script.input;await state.ask(state.input)
   assert.equal(state.stepAvailable,false);assert.equal(sentChat.at(-1)[2].mode,'chat');assert.equal(sentStep.length,0)
   store.state.role='engineer';await nextTick();task.status='submitted';await nextTick()
   state.input=script.input;await state.ask(state.input)
   assert.equal(state.stepAvailable,false);assert.equal(sentChat.at(-1)[2].mode,'chat');assert.equal(sentStep.length,0)
   task.status='assigned';await nextTick()
  })

  await t.test('questions and drafts show live progress and retain an expandable, safely rendered completed log',async()=>{
   const render=message=>renderToString(createSSRApp(Proposal,{message})),progressLog=[{stage:'context',label:'正在核对当前步骤…'},{stage:'organize',label:'正在整理已提供的现场信息…'},{stage:'compose',label:'正在整理 <现场记录>…'}]
   for(const kind of ['question','draft']){
    const message={stepIndex:1,status:'streaming',response:{kind,text:'',...(kind==='draft'?{note:''}:{})},progressLog}
    const html=await render(message)
    assert.match(html,/role="status"[^>]*aria-live="polite"[^>]*aria-busy="true"/);assert.match(html,/step-progress-spinner/)
    assert.match(html,/正在核对当前步骤/);assert.match(html,/正在整理已提供的现场信息/);assert.match(html,/&lt;现场记录&gt;/);assert.doesNotMatch(html,/<现场记录>/)
    const complete=await render({...message,status:'complete',response:{kind,text:kind==='question'?'现场独立读数是多少？':'请核对备注草稿。',note:'现场读数仍待核对。'},progressLog:[...progressLog,{stage:'complete',label:kind==='question'?'已整理待确认的问题':'备注草稿已生成，待您核对'}]})
    assert.match(complete,/<details[^>]*class="step-note-progress-history"/);assert.match(complete,/<summary[^>]*>处理进度<\/summary>/)
    assert.match(complete,/正在核对当前步骤/);assert.doesNotMatch(complete,/step-progress-spinner|aria-busy="true"/)
   }
   assert.match(await render({status:'complete',progress:'旧版本处理记录',response:{kind:'question',text:'请补充读数。'}}),/旧版本处理记录/)
   assert.match(await render({status:'streaming'}),/正在结合本步骤记录整理/)
   assert.doesNotMatch(await render({status:'complete',response:{kind:'receipt',text:'本步骤已记录。'}}),/处理进度|step-progress-spinner/)
  })
 }finally{mounted?.app.unmount();disposePinia(pinia);await server.close();if(oldWindow===undefined)delete globalThis.window;else globalThis.window=oldWindow;if(oldReader===undefined)delete globalThis.FileReader;else globalThis.FileReader=oldReader}
})
