import test from 'node:test'
import assert from 'node:assert/strict'
import {createSpeechDraftInput} from '../src/workflow/speechDraftInput.js'
import {createServer} from 'vite'
import {createRenderer,createSSRApp,h,nextTick,ssrContextKey} from 'vue'
import {renderToString} from '@vue/server-renderer'
import {createPinia,setActivePinia,disposePinia} from 'pinia'
import {createLifecycleState} from '../src/workflow/eventLifecycle.js'

class Recognition{
 static instances=[]
 constructor(){Recognition.instances.push(this)}
 start(){this.started=true}
 stop(){this.stopped=true}
 abort(){this.aborted=true}
 result(...items){this.onresult?.({results:items.map(([transcript,isFinal])=>Object.assign([{transcript}],{isFinal}))})}
}
const latest=()=>Recognition.instances.at(-1)

test('speech appends finalized results to the current draft and does not overwrite intervening manual edits',()=>{
 let draft='  现场原文  ',state
 const voice=createSpeechDraftInput({readDraft:()=>draft,writeDraft:text=>draft=text,onChange:value=>state=value,getRecognition:()=>Recognition})
 voice.start();const recognition=latest()
 assert.equal(recognition.started,true);assert.equal(recognition.lang,'zh-CN')
 assert.equal(recognition.continuous,true);assert.equal(recognition.interimResults,true)
 recognition.result(['尚未确认',false]);assert.equal(draft,'  现场原文  ');assert.equal(state.interim,'尚未确认')
 draft+='人工补录'
 recognition.result(['检查接口',true],['准备记录',false])
 assert.equal(draft,'  现场原文  人工补录\n检查接口')
 draft+='，手动改字'
 recognition.result(['检查接口',true],['保留读数',true])
 assert.equal(draft,'  现场原文  人工补录\n检查接口，手动改字\n保留读数')
 recognition.result(['检查接口',true],['保留读数',true])
 assert.equal(draft,'  现场原文  人工补录\n检查接口，手动改字\n保留读数','repeated final results are not duplicated')
 voice.toggle();assert.equal(recognition.stopped,true);assert.equal(state.stopping,true)
 recognition.result(['检查接口',true],['保留读数',true],['结束前的结果',true])
 assert.match(draft,/\n结束前的结果$/,'a normal stop still accepts the final recognition result')
 recognition.onend();assert.equal(state.listening,false);assert.equal(state.interim,'')
 voice.dispose()
})

test('pending, context cancellation and disposal stop recognition and ignore late callbacks',()=>{
 let draft='原文',disabled=true
 const voice=createSpeechDraftInput({readDraft:()=>draft,writeDraft:text=>draft=text,disabled:()=>disabled,getRecognition:()=>Recognition})
 const count=Recognition.instances.length;voice.start();voice.toggle();assert.equal(Recognition.instances.length,count)
 disabled=false;voice.start();const recognition=latest(),lateResult=recognition.onresult
 disabled=true;recognition.result(['发送后的迟到结果',true])
 assert.equal(recognition.aborted,true);assert.equal(draft,'原文');assert.equal(voice.state.listening,false)
 disabled=false;voice.start();const next=latest();voice.cancel();assert.equal(next.aborted,true)
 lateResult({results:[Object.assign([{transcript:'旧会话迟到结果'}],{isFinal:true})]});assert.equal(draft,'原文')
 voice.start();const last=latest();voice.dispose();assert.equal(last.aborted,true)
 assert.equal(last.onresult,null);assert.equal(last.onend,null);assert.equal(last.onerror,null)
 const disposedCount=Recognition.instances.length;voice.start();assert.equal(Recognition.instances.length,disposedCount)
})

test('unsupported browsers, microphone refusal and start failure show actionable errors',()=>{
 const options={readDraft:()=>'',writeDraft:()=>{}}
 const unsupported=createSpeechDraftInput({...options,getRecognition:()=>undefined});unsupported.start()
 assert.match(unsupported.state.error,/不支持语音识别/)
 for(const [code,message] of [['not-allowed','麦克风权限'],['audio-capture','可用麦克风'],['network','连接失败'],['no-speech','未识别到语音']]){
  const voice=createSpeechDraftInput({...options,getRecognition:()=>Recognition});voice.start();latest().onerror({error:code})
  assert.match(voice.state.error,new RegExp(message));assert.equal(voice.state.listening,false);assert.equal(latest().aborted,true)
 }
 const failing=createSpeechDraftInput({...options,getRecognition:()=>class extends Recognition{start(){throw Error('blocked')}}})
 failing.start();assert.match(failing.state.error,/无法开始语音输入/);assert.equal(failing.state.listening,false)
})

function mount(component,pinia,props){
 const node=()=>({children:[]})
 const renderer=createRenderer({createElement:node,createText:node,createComment:node,insert(child,parent){child.parent=parent;parent.children.push(child)},remove(){},setText(){},setElementText(){},patchProp(){},parentNode:node=>node.parent,nextSibling:()=>null})
 const app=renderer.createApp({...component,render:()=>null},props)
 app.config.warnHandler=()=>{};app.provide(ssrContextKey,{});app.use(pinia)
 const vm=app.mount(node());return {app,state:vm.$.setupState}
}

test('the assistant renders an accessible icon-only microphone and connects speech, send, pending and unmount',async()=>{
 const oldWindow=globalThis.window;globalThis.window={addEventListener(){},webkitSpeechRecognition:Recognition}
 const server=await createServer({optimizeDeps:{noDiscovery:true,include:[]},server:{middlewareMode:true,hmr:false,ws:false},appType:'custom'})
 const pinia=createPinia();setActivePinia(pinia)
 let mounted
 try{
  const {useEventLifecycleStore}=await server.ssrLoadModule('/src/stores/eventLifecycleStore.js')
  const {useSensorStore}=await server.ssrLoadModule('/src/stores/sensorStore.js')
  const {default:Assistant}=await server.ssrLoadModule('/src/components/LifecycleAssistant.vue')
  useSensorStore().configureSimulation({enabled:false})
  const store=useEventLifecycleStore(),state=createLifecycleState(),id='real-alarm-0430'
  store.state.events=state.events;store.state.role='engineer'
  const props={event:store.state.events[id]}
  const render=()=>renderToString(createSSRApp({render:()=>h(Assistant,props)}).use(pinia))
  const html=await render(),button=html.match(/<button[^>]*class="composer-voice"[^>]*>([\s\S]*?)<\/button>/)
  assert.ok(button);assert.match(button[0],/aria-label="开始语音输入"/);assert.match(button[0],/title="开始语音输入"/)
  assert.match(button[0],/aria-pressed="false"/);assert.match(button[1],/<svg/)
  assert.equal(button[1].replace(/<[^>]+>/g,'').trim(),'','no visible microphone label')
  mounted=mount(Assistant,pinia,props)
  let sent=[];store.ask=async(...args)=>sent.push(args)
  mounted.state.input='原有草稿';mounted.state.voice.toggle();latest().result(['新增口述',true])
  assert.equal(mounted.state.input,'原有草稿\n新增口述');assert.equal(sent.length,0,'dictation does not send')
  const active=latest();await mounted.state.ask(mounted.state.input)
  assert.equal(active.aborted,true);assert.equal(sent.length,1);assert.equal(sent[0][1],'原有草稿\n新增口述')
  mounted.state.voice.start();const beforePending=latest();store.pendingRequests[id+':engineer']=true;await nextTick()
  assert.equal(beforePending.aborted,true)
  const pendingHtml=await render(),pendingButton=pendingHtml.match(/<button[^>]*class="composer-voice"[^>]*>/)?.[0]
  assert.match(pendingButton,/disabled/)
  delete store.pendingRequests[id+':engineer'];await nextTick()
  mounted.state.voice.start();const beforeUnmount=latest();mounted.app.unmount();mounted=null
  assert.equal(beforeUnmount.aborted,true);assert.equal(beforeUnmount.onresult,null)
 }finally{mounted?.app.unmount();disposePinia(pinia);await server.close();if(oldWindow===undefined)delete globalThis.window;else globalThis.window=oldWindow}
})
