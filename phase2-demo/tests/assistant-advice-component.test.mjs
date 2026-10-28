import test from 'node:test'
import assert from 'node:assert/strict'
import {createServer} from 'vite'
import {createRenderer,createSSRApp,ssrContextKey,reactive,nextTick} from 'vue'
import {renderToString} from '@vue/server-renderer'

function mount(component,props){
 const node=()=>({children:[]})
 const renderer=createRenderer({createElement:node,createText:node,createComment:node,insert(child,parent){child.parent=parent;parent.children.push(child)},remove(){},setText(){},setElementText(){},patchProp(){},parentNode:node=>node.parent,nextSibling:()=>null})
 const app=renderer.createApp({...component,render:()=>null},props);app.provide(ssrContextKey,{})
 const vm=app.mount(node());return {app,state:vm.$.setupState}
}

test('assistant advice has factual expandable evidence and a bounded one-shot presentation',async t=>{
 const server=await createServer({optimizeDeps:{noDiscovery:true,include:[]},server:{middlewareMode:true,hmr:false,ws:false},appType:'custom'})
 const original={raf:globalThis.requestAnimationFrame,cancel:globalThis.cancelAnimationFrame,match:globalThis.matchMedia}
 let nextFrame=0;const frames=new Map()
 globalThis.requestAnimationFrame=callback=>{frames.set(++nextFrame,callback);return nextFrame}
 globalThis.cancelAnimationFrame=id=>frames.delete(id)
 globalThis.matchMedia=()=>({matches:false})
 const tick=now=>{const pending=[...frames.values()];frames.clear();pending.forEach(callback=>callback(now))}
 try{
  const {default:Advice}=await server.ssrLoadModule('/src/components/messages/AssistantAdviceMessage.vue')
  const {default:Renderer}=await server.ssrLoadModule('/src/components/messages/MessageRenderer.vue')
  await t.test('only the current advice has an executable action and full text is not duplicated for live announcements',async()=>{
   const message={id:'advice-markup',role:'assistant',presentation:'advice',currentAdvice:true,analysis:'两项控制空气进口压力同期下降。',recommendation:'建议核实现场表计。',basis:[{label:'进口压力',text:'0.57 MPa'}],actionLabel:'填写核实结果'}
   const current=await renderToString(createSSRApp(Renderer,{message}))
   assert.match(current,/data-message-id="advice-markup"/)
   assert.match(current,/AI检修助手建议/);assert.match(current,/分析依据/)
   assert.match(current,/assistant-basis-content/);assert.match(current,/aria-live="off"/)
   assert.match(current,/<button[^>]*class="assistant-advice-action"/)
   assert.equal(current.split(message.analysis).length-1,1)
   const old=await renderToString(createSSRApp(Renderer,{message:{...message,currentAdvice:false,historical:true}}))
   assert.doesNotMatch(old,/<button/)
   assert.match(old,/0.57 MPa/)
  })
  await t.test('new reply reveals analysis then recommendation, completing once within 1.8 seconds',async()=>{
   const progress=[],complete=[],started=performance.now()
   const message=reactive({id:'animate-one',animate:true,currentAdvice:true,analysis:'现场压力核查。'.repeat(10),recommendation:'建议检查供气管路。'.repeat(8)})
   const panel=mount(Advice,{message,onStreamProgress:value=>progress.push(value),onStreamComplete:value=>complete.push(value)})
   try{
    assert.equal(panel.state.streaming,true);assert.equal(panel.state.visibleAnalysis,'')
    tick(started+450);await nextTick()
    assert.ok(panel.state.visibleAnalysis.length>0);assert.ok(panel.state.visibleAnalysis.length<message.analysis.length)
    assert.equal(panel.state.visibleRecommendation,'')
    tick(started+1801);await nextTick()
    assert.equal(panel.state.streaming,false)
    assert.equal(panel.state.visibleAnalysis,message.analysis);assert.equal(panel.state.visibleRecommendation,message.recommendation)
    assert.equal(complete.length,1);assert.equal(complete[0].messageId,'animate-one')
    assert.ok(progress.every(value=>value.messageId==='animate-one'))
    tick(started+3000);assert.equal(complete.length,1)
    message.analysis='后续更新不重播。';await nextTick()
    assert.equal(panel.state.visibleAnalysis,'后续更新不重播。');assert.equal(complete.length,1)
   }finally{panel.app.unmount()}
   const replay=[];const reopened=mount(Advice,{message,onStreamComplete:value=>replay.push(value)})
   assert.equal(reopened.state.streaming,false);assert.equal(replay.length,0);reopened.app.unmount()
  })
  await t.test('reduced motion completes immediately, and old static replies never start animating',async()=>{
   globalThis.matchMedia=()=>({matches:true})
   const completed=[],message=reactive({id:'reduce-motion',animate:true,analysis:'当前验收已提交。',recommendation:'请确认后续观察。'})
   const panel=mount(Advice,{message,onStreamComplete:value=>completed.push(value)})
   assert.equal(panel.state.streaming,false);assert.equal(panel.state.visibleAnalysis,message.analysis);assert.equal(completed.length,1)
   panel.app.unmount();globalThis.matchMedia=()=>({matches:false})
   const prior=reactive({id:'old-static',animate:false,analysis:'历史建议保留。'})
   const old=mount(Advice,{message:prior,onStreamComplete:()=>assert.fail('old reply must not stream')})
   prior.animate=true;await nextTick();assert.equal(old.state.streaming,false);old.app.unmount()
  })
  await t.test('message renderer forwards progress and completion with its own stable message ID',()=>{
   const progress=[],completed=[]
   const panel=mount(Renderer,{message:{id:'stable-id',role:'assistant'},onStreamProgress:value=>progress.push(value),onStreamComplete:value=>completed.push(value)})
   panel.state.forwardStream('stream-progress',{messageId:'stale',visibleCharacters:12,totalCharacters:25})
   panel.state.forwardStream('stream-complete',{messageId:'stale'})
   assert.deepEqual(progress,[{messageId:'stable-id',visibleCharacters:12,totalCharacters:25}])
   assert.deepEqual(completed,[{messageId:'stable-id'}]);panel.app.unmount()
  })
 }finally{
  globalThis.requestAnimationFrame=original.raf;globalThis.cancelAnimationFrame=original.cancel;globalThis.matchMedia=original.match
  await server.close()
 }
})
