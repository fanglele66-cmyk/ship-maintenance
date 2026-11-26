import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {createServer} from 'vite'
import {createRenderer,createSSRApp,h,nextTick,ssrContextKey} from 'vue'
import {renderToString} from '@vue/server-renderer'
import {createPinia,setActivePinia,disposePinia} from 'pinia'
import {createLifecycleState,decide,currentTask,submitTask,people} from '../src/workflow/eventLifecycle.js'
import {assistTaskStep as collaborate,applyTaskStepNote} from '../src/workflow/taskStepAssistance.js'
import {assistTaskStep as serve,enforceStepFollowUpPolicy} from '../server/step-assist.mjs'
import {buildStepAssistRequest,prepareStepAssistInput,normalizeStepAssistResult,MAX_STEP_FOLLOWUP_ROUNDS} from '../src/workflow/stepAssistContract.js'
import {lifecycleModelContext} from '../src/workflow/lifecycleModelContext.js'
import {STEP_ASSIST_DEMO_CASES} from '../src/workflow/stepAssistDemo.js'

const png={name:'现场检查照片.png',mimeType:'image/png',dataUrl:'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/lT8AAAAASUVORK5CYII='}
const config={source:'manual',enabled:true,apiKey:'test-key',model:'test-model',baseUrl:'https://example.test/v1',protocol:'openai',maxTokens:4096,timeoutMs:5000,knowledgeEnabled:false}
const streamResponse=value=>new Response('data: '+JSON.stringify({model:'test-model',choices:[{delta:{content:JSON.stringify(value)},finish_reason:'stop'}]})+'\n\ndata: [DONE]\n\n',{headers:{'Content-Type':'text/event-stream'}})

function fixture(){
 const state=createLifecycleState(),event=state.events['real-alarm-0430']
 decide(state,event.id,{action:'investigate',owner:people.engineer,deadline:new Date(Date.now()+86400000).toISOString()})
 state.role='engineer'
 const task=currentTask(event)
 task.draft.stepIndex=0
 return {state,event,task}
}

function mount(component,pinia,props){
 const node=()=>({children:[]})
 const renderer=createRenderer({createElement:node,createText:node,createComment:node,insert(child,parent){child.parent=parent;parent.children.push(child)},remove(){},setText(){},setElementText(){},patchProp(){},parentNode:node=>node.parent,nextSibling:()=>null})
 const app=renderer.createApp({...component,render:()=>null},props)
 app.config.warnHandler=()=>{};app.provide(ssrContextKey,{});app.use(pinia)
 const vm=app.mount(node());return {app,state:vm.$.setupState,props:vm.$.props}
}

test('T3: left-form step photos submit with step option & note, appear in records & reports, and strip base64 from text AI payloads',async()=>{
 const {state,event,task}=fixture()
 task.draft.records[0].result='发现异常'
 task.draft.records[0].note='二缸 ICU 动作发涩，已留存现场照片。'
 task.draft.records[0].photos=[png]
 task.draft.records[1].result='未见异常'
 task.draft.records[1].note='燃油供给已查范围未见异常。'

 // Step assist request sees photo names without duplicating raw dataUrl on record
 const req=buildStepAssistRequest({event,task,stepIndex:0,role:'engineer',text:'请整理当前记录'})
 const prepared=prepareStepAssistInput(req)
 assert.deepEqual(prepared.context.record.photoNames,['现场检查照片.png'])
 assert.equal(req.event.tasks[0].draft.records[0].photos[0].dataUrl,undefined)

 // Submit task preserves photos on submitted records & report snapshot
 const report=submitTask(state,event.id,task.id)
 assert.equal(task.records[0].photos.length,1)
 assert.equal(task.records[0].photos[0].dataUrl,png.dataUrl)
 assert.equal(report.submissionSnapshot.records[0].photos[0].name,'现场检查照片.png')
 assert.match(report.markdown,/附现场照片 1 张：现场检查照片\.png/)
 assert.match(report.markdown,/第 1 步「核查 C2 ICU 液压机构与反馈」现场照片：现场检查照片\.png/)

 // Text-only model context strips base64 dataUrl so report/chat calls stay under size cap
 const ctx=lifecycleModelContext(event,'captain')
 assert.equal(ctx.tasks[0].records[0].photos[0].name,'现场检查照片.png')
 assert.equal(ctx.tasks[0].records[0].photos[0].dataUrl,undefined)
 assert.equal(ctx.reports[0].submissionSnapshot.records[0].photos[0].dataUrl,undefined)
})

test('T3: skill and server enforce per-step 3-round follow-up limit, Codex options, and always-adoptable draft after limit',async()=>{
 const skill=readFileSync(new URL('../.claude/skills/ship-task-assistant/SKILL.md',import.meta.url),'utf8')
 assert.match(skill,/最多 3 轮/)
 assert.match(skill,/停止追问/)
 assert.match(skill,/其他/)

 const {state,event,task}=fixture()
 const start=STEP_ASSIST_DEMO_CASES.find(item=>item.id==='investigationStart').input
 const backend={configuration:{read:async()=>config},knowledge:{search:async()=>[]},wait:async()=>{}}
 const ask=(text,fetcher,uploads={})=>collaborate(state,event.id,task.id,task.draft.stepIndex,text,uploads,(body,emit)=>serve(body,{...backend,fetcher:fetcher||(()=>assert.fail('scripted step must not call external model')),emit}),{})

 // Opening choice does not consume a follow-up round
 const openingMsg=await ask('我想先记录这次排查已经检查的情况。')
 assert.equal(openingMsg.isOpening,true)

 // Round 1/3 Codex options
 const r1=await ask(start,undefined,{images:[png]})
 assert.equal(r1.response.kind,'question')
 assert.equal(r1.response.followUpRound,1)
 assert.equal(r1.response.maxFollowUpRounds,MAX_STEP_FOLLOWUP_ROUNDS)
 assert.equal(r1.response.allowOther,true)
 assert.ok(r1.response.choices.length>=3)

 // Pick option 2 to trigger Round 2/3
 const r2=await ask(r1.response.choices[1].label)
 assert.equal(r2.response.kind,'question')
 assert.equal(r2.response.followUpRound,2)
 assert.equal(r2.response.maxFollowUpRounds,3)
 assert.ok(r2.response.choices.length>=2)

 // Pick option 1 of Round 2 to trigger Round 3/3
 const r3=await ask(r2.response.choices[0].label)
 assert.equal(r3.response.kind,'question')
 assert.equal(r3.response.followUpRound,3)
 assert.equal(r3.response.maxFollowUpRounds,3)
 assert.ok(r3.response.choices.length>=2)

 // After 3 follow-up rounds, answering reaches limit -> returns draft with limitReached=true
 const r4=await ask(r3.response.choices[0].label)
 assert.equal(r4.response.kind,'draft')
 assert.equal(r4.response.limitReached,true)
 assert.ok(r4.response.note.length>40)
 for(const reply of [r1,r2,r3])assert.ok(reply.response.choices.every(choice=>Object.keys(choice).sort().join(',')==='id,label'))
 for(const observed of ['液压活塞回位不畅','只检查了外部','尚未取得内部检验记录'])assert.ok(r4.response.note.includes(observed))
 assert.doesNotMatch(r4.response.note,/15:10|三次|已许可|已隔离|发涩|划痕|污染/)

 // Round 4+ (post-limit): even if external model attempts another question, server stops follow-up and forces adoptable draft
 const r5=await ask('还有什么要确认的？',async()=>streamResponse({kind:'question',text:'再问一个问题？',choices:[{id:'x',label:'选项'}]}))
 assert.equal(r5.response.kind,'draft')
 assert.equal(r5.response.limitReached,true)
 assert.doesNotMatch(r5.response.text,/追问|上限|轮次|再问一个问题/)
 assert.ok(r5.response.note.includes(r2.response.choices[0].label))

 // Round 5+ (post-limit): crew asks a consultation question -> model returns answer, server preserves answer text AND attaches adoptable draft
 const r6=await ask('为什么船上不能拆开活塞内部精修？',async()=>streamResponse({kind:'answer',text:'液压活塞为精密偶件，需送厂家认可车间检修，船端只按批准工单拆换总成。'}))
 assert.equal(r6.response.kind,'draft')
 assert.equal(r6.response.limitReached,true)
 assert.match(r6.response.text,/精密偶件/)
 assert.ok(r6.response.note.length>20)
 applyTaskStepNote(state,event.id,task.id,r6.id)
 assert.equal(task.draft.records[0].note,r6.response.note)

 // Switching to Step 2 has a fresh 3-round budget independent of Step 1
 task.draft.stepIndex=1
 const step2Req=buildStepAssistRequest({event,task,stepIndex:1,role:'engineer',text:'准备检查第二步',history:task.conversations.engineer.filter(m=>m.kind==='user'||m.kind==='step-assist').map(m=>({eventId:event.id,taskId:task.id,stepIndex:m.stepIndex,role:m.kind==='user'?'user':'assistant',text:m.kind==='step-assist'?m.response?.text||'':m.text||'',...(m.kind==='step-assist'&&m.response?.kind?{responseKind:m.response.kind}:{}),...(m.isOpening?{isOpening:true}:{})}))})
 const step2Prepared=prepareStepAssistInput(step2Req)
 assert.equal(step2Prepared.context.followUpState.used,0)
 assert.equal(step2Prepared.context.followUpState.limitReached,false)

 // Direct contract check on invalid choice schemas
 assert.throws(()=>normalizeStepAssistResult({kind:'question',text:'问',choices:[]}),/1—5/)
 assert.throws(()=>normalizeStepAssistResult({kind:'question',text:'问',choices:[{id:'a',label:'x',submit:true}]}),/未允许字段/)
 assert.equal(enforceStepFollowUpPolicy({kind:'question',text:'hi'},{followUpState:{used:3,max:3,limitReached:true},history:[],record:{},message:{text:'ok'}}).kind,'draft')
})

test('T3 UI: left note photo uploader, Codex follow-up card with 其他, and submitted photo galleries render cleanly',async()=>{
 const oldWindow=globalThis.window,oldReader=globalThis.FileReader
 globalThis.window={addEventListener(){}}
 globalThis.FileReader=class{readAsDataURL(file){this.result=file.dataUrl;queueMicrotask(()=>this.onload())}}
 const server=await createServer({optimizeDeps:{noDiscovery:true,include:[]},server:{middlewareMode:true,hmr:false,ws:false},appType:'custom'}),pinia=createPinia()
 setActivePinia(pinia)
 let mounted
 try{
  const {useEventLifecycleStore}=await server.ssrLoadModule('/src/stores/eventLifecycleStore.js')
  const {useSensorStore}=await server.ssrLoadModule('/src/stores/sensorStore.js')
  const {default:NoteEditor}=await server.ssrLoadModule('/src/components/LifecycleNoteEditor.vue')
  const {default:QuestionCard}=await server.ssrLoadModule('/src/components/AssistantQuestionCard.vue')
  const {default:Assistant}=await server.ssrLoadModule('/src/components/LifecycleAssistant.vue')
  const {default:TaskRecords}=await server.ssrLoadModule('/src/components/LifecycleTaskRecords.vue')
  const {default:Report}=await server.ssrLoadModule('/src/components/LifecycleReport.vue')
  useSensorStore().configureSimulation({enabled:false})

  // 1. Note editor renders photo capture/upload entry & attached thumbnail strip
  const noteHtml=await renderToString(createSSRApp({render:()=>h(NoteEditor,{modelValue:'测试备注',photos:[png],photoEnabled:true,assistMode:true})}))
  assert.match(noteHtml,/aria-label="拍照"/);assert.match(noteHtml,/aria-label="上传照片"/)
  assert.match(noteHtml,/capture="environment"/)
  assert.match(noteHtml,/查看照片：现场检查照片\.png/)
  assert.match(noteHtml,/随本步骤选项和备注一并提交/)

  // The current reply already supplies the step context.
  const cardHtml=await renderToString(createSSRApp({render:()=>h(QuestionCard,{
   badge:'补充确认',title:'液压活塞动作检查做了吗？',allowOther:true,
   choices:[{id:'o1',label:'已检查，三次发涩'},{id:'o2',label:'尚未停机检查'}],
  })}))
  assert.match(cardHtml,/补充确认/)
  assert.match(cardHtml,/>确认<\/button>/);assert.doesNotMatch(cardHtml,/第 1 步|追问上限|追问 \d\/\d|round-dots/)
  assert.match(cardHtml,/已检查，三次发涩/)
  assert.match(cardHtml,/其他（自行填写现场情况）/)

  // 3. LifecycleAssistant mounts Codex follow-up card and sends selected choice or 其他 text
  const store=useEventLifecycleStore(),f=fixture()
  store.state.events=f.state.events;store.state.role='engineer'
  const event=store.state.events['real-alarm-0430'],task=currentTask(event)
  task.conversations={captain:[],engineer:[
   {id:'u1',kind:'user',stepIndex:0,text:'插头线束未见异常',at:new Date().toISOString()},
   {id:'q1',kind:'step-assist',stepIndex:0,status:'complete',at:new Date().toISOString(),response:{
    kind:'question',text:'已记录插头和线束的目视结果。',question:'液压活塞动作检查做了吗？',note:'可接近的插头和线束未见异常。',
    choices:[{id:'opt1',label:'已检查，回位不畅',value:'做过动作检查，三次发涩回位不畅。'}],
    allowOther:true,followUpRound:1,maxFollowUpRounds:3,
   }},
  ]}
  mounted=mount(Assistant,pinia,{event,taskId:task.id,activeStepIndex:0})
  const sent=[];store.assistStep=async(...args)=>sent.push(args)
  assert.equal(mounted.state.decisionQuestion.title,'液压活塞动作检查做了吗？')
  assert.equal(mounted.state.decisionQuestion.allowOther,true)
  const chat=await renderToString(createSSRApp({render:()=>h(Assistant,{event,taskId:task.id,activeStepIndex:0})}).use(pinia))
  const reply=chat.match(/data-message-id="q1"[^>]*>([\s\S]*?)<\/article>/)?.[1]
  const textAt=reply.indexOf('已记录插头和线束的目视结果'),noteAt=reply.indexOf('可接近的插头和线束未见异常。'),decisionAt=reply.indexOf('class="assistant-question')
  assert.ok(textAt>=0 && textAt<noteAt && noteAt<decisionAt,'reply and draft precede the single decision card')
  const decisions=reply.slice(decisionAt)
  assert.match(decisions,/>确认<\/button>/);assert.doesNotMatch(decisions,/第\s*1\s*步|直接询问助手|直接输入/)
  assert.match(decisions,/<legend[^>]*>液压活塞动作检查做了吗？/);assert.match(decisions,/<label[^>]*class="draft-option[^"]*"[^>]*>[\s\S]*?采用到本步骤<\/span>\s*<\/label>/)
  assert.match(decisions,/其他（补充或修改）/);assert.equal((decisions.match(/<button\b/g)||[]).length,1);assert.doesNotMatch(reply,/三次发涩|将发送：|step-draft-actions/)
  assert.equal(task.draft.records[0].note,'')
  mounted.state.input='尚未发送的咨询';mounted.state.images=[png]
  const question=task.conversations.engineer.find(item=>item.id==='q1')
  mounted.state.confirmStepChoice(question,'opt1');await nextTick()
  assert.equal(sent.at(-1)[3],'已检查，回位不畅')
  assert.deepEqual(sent.at(-1)[4].images,[]);assert.equal(mounted.state.input,'尚未发送的咨询');assert.equal(mounted.state.images.length,1)
  mounted.state.confirmStepChoice(question,'__other__','现场只做了外观目视，还没具备停机条件。');await nextTick()
  assert.equal(sent.at(-1)[3],'现场只做了外观目视，还没具备停机条件。')

  question.baseStep=JSON.stringify(task.steps[0]);question.baseNote=''
  task.draft.records[0].result='无法确认'
  const mixed=mount(QuestionCard,pinia,{...mounted.state.decisionQuestion,draftAvailable:true,onAdopt:()=>mounted.state.applyStepNote(question.id),onConfirm:()=>assert.fail('adoption must not send a choice')})
  try{
   mixed.state.selected=mixed.state.adoptKey
   mixed.state.submit();await nextTick()
   assert.equal(task.draft.records[0].note,question.response.note)
   assert.equal(task.draft.records[0].result,'无法确认')
   assert.equal(task.conversations.engineer.at(-1).response.kind,'receipt')
   assert.equal(sent.length,2)
   assert.equal(mounted.state.input,'尚未发送的咨询')
  }finally{mixed.app.unmount()}

  // 4. Submitted TaskRecords & Report render step photo galleries
  task.draft.records[0].result='发现异常';task.draft.records[0].note='记录含照片';task.draft.records[0].photos=[png]
  task.draft.records[1].result='未见异常'
  const report=submitTask(store.state,event.id,task.id)
  const recordsHtml=await renderToString(createSSRApp({render:()=>h(TaskRecords,{event,task,records:task.records})}))
  assert.match(recordsHtml,/现场照片（1 张）/);assert.match(recordsHtml,/查看现场照片：现场检查照片\.png/)
  const reportHtml=await renderToString(createSSRApp({render:()=>h(Report,{report})}))
  assert.match(reportHtml,/本轮现场照片/);assert.match(reportHtml,/查看照片：现场检查照片\.png/)
 }finally{mounted?.app.unmount();disposePinia(pinia);await server.close();if(oldWindow===undefined)delete globalThis.window;else globalThis.window=oldWindow;if(oldReader===undefined)delete globalThis.FileReader;else globalThis.FileReader=oldReader}
})
