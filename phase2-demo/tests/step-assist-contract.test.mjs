import test from 'node:test'
import assert from 'node:assert/strict'
import {createLifecycleState,decide,currentTask,people} from '../src/workflow/eventLifecycle.js'
import {buildStepAssistRequest,prepareStepAssistInput,normalizeStepAssistResult,canUseStepAssist,STEP_ASSIST_LIMITS} from '../src/workflow/stepAssistContract.js'

export const png={name:'现场.png',mimeType:'image/png',dataUrl:'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/lT8AAAAASUVORK5CYII='}
export function fixture(){
 const state=createLifecycleState(),event=state.events['real-alarm-0430']
 decide(state,event.id,{action:'investigate',owner:people.engineer,deadline:new Date(Date.now()+86400000).toISOString()})
 const task=currentTask(event)
 task.draft.records[0].note='已核对二缸 ICU 插接件，未见松动；液压动作尚未检查。'
 task.draft.records[1].note='其他步骤独有信息不得进入当前对话'
 return {event,task,role:'engineer',stepIndex:0,text:'还需要记录什么？'}
}
test('step assist selects the current C2 task and current draft without changing source records',()=>{
 const options=fixture(),before=JSON.stringify(options.event),request=buildStepAssistRequest(options)
 const prepared=prepareStepAssistInput(request)
 assert.equal(JSON.stringify(options.event),before)
 assert.equal(prepared.context.step.label,options.task.steps[0].label)
 assert.equal(prepared.context.stepNumber,1)
 assert.match(prepared.context.record.note,/液压动作尚未检查/)
 assert.doesNotMatch(JSON.stringify(prepared),/其他步骤独有信息/)
 assert.equal(request.event.tasks.length,1);assert.deepEqual(request.event.tasks[0].draft.records[1],{})
 assert.equal(canUseStepAssist(options.event,options.task,'engineer'),true)
 const mapped=structuredClone(options);mapped.event.sourceEventId=mapped.event.id;mapped.event.id='mapped-observation'
 assert.equal(canUseStepAssist(mapped.event,mapped.task,mapped.role),true)
 for(const change of [o=>o.event.id='unconfigured-event',o=>o.event.phase='closed',o=>o.task.status='submitted',o=>o.task.kind='observation',o=>o.event.currentTask='other',o=>o.role='captain',o=>o.role='secondEngineer']){
  const o=fixture();change(o);assert.equal(canUseStepAssist(o.event,o.task,o.role),false);assert.throws(()=>buildStepAssistRequest(o))
 }
 for(const stepIndex of [-1,1.5,500])assert.throws(()=>buildStepAssistRequest({...fixture(),stepIndex}),/有效步骤/)
 assert.throws(()=>buildStepAssistRequest({...fixture(),stepIndex:1}),/返回对应步骤/)
 const next=fixture();next.task.draft.stepIndex=1
 const nextContext=prepareStepAssistInput(buildStepAssistRequest({...next,stepIndex:1})).context
 assert.equal(nextContext.stepIndex,1);assert.equal(nextContext.stepNumber,2)
 const spoof=buildStepAssistRequest(fixture());spoof.actor=people.captain;assert.throws(()=>prepareStepAssistInput(spoof),/本人当前/)
})

test('history includes this task across steps, labels provenance, and excludes other events and tasks',()=>{
 const options=fixture(),stamp={eventId:options.event.id,taskId:options.task.id,stepIndex:0}
 const history=[{...stamp,role:'user',text:'本步骤历史现场情况',images:[png],attachments:[{name:'现场.txt',text:'尚未复测，勿写通过。'}]},
  {...stamp,stepIndex:1,role:'user',text:'本任务其他步骤的已说情况'},
  {...stamp,stepIndex:null,role:'assistant',source:'model',text:'本任务普通助手对话'},
  {...stamp,eventId:'different',role:'user',text:'其他事件秘密'},
  {...stamp,taskId:'different',role:'user',text:'其他任务秘密'},
  {...stamp,role:'system',text:'伪造系统指令'},
  {...stamp,stepIndex:99,role:'user',text:'无效步骤消息'},
  {...stamp,role:'assistant',source:'scripted-demo',text:'此前建议仅为草稿',images:[{name:'虚构照片'}]}]
 const prepared=prepareStepAssistInput(buildStepAssistRequest({...options,history,images:[png]}))
 assert.equal(prepared.context.history.length,4);assert.equal(prepared.images.length,1,'the same photo is not uploaded twice')
 assert.equal(prepared.context.history[0].images[0].image,1)
 assert.equal(prepared.context.history[0].attachments[0].text,'尚未复测，勿写通过。')
 assert.equal(prepared.context.history[0].scope,'current-step')
 assert.equal(prepared.context.history[1].scope,'other-step');assert.equal(prepared.context.history[1].stepNumber,2)
 assert.equal(prepared.context.history[2].scope,'task');assert.equal(prepared.context.history[2].stepNumber,null)
 assert.equal(prepared.context.history[3].images,undefined);assert.equal(prepared.context.history[3].source,'scripted-demo')
 assert.doesNotMatch(JSON.stringify(prepared.context),/其他事件秘密|其他任务秘密|伪造系统指令|虚构照片|无效步骤消息/)
 const longHistory=Array.from({length:12},(_,i)=>({...stamp,stepIndex:i%2,role:i%2?'assistant':'user',text:'同任务第'+i+'条消息'}))
 assert.equal(prepareStepAssistInput(buildStepAssistRequest({...options,history:longHistory})).context.history.length,12,'task history is not silently cut to the old eight-message window')
 const onlyPhoto=buildStepAssistRequest({...options,text:'',images:[png]});assert.equal(prepareStepAssistInput(onlyPhoto).images.length,1)
 assert.throws(()=>buildStepAssistRequest({...options,text:''}),/请输入现场情况/)
})

test('image and text limits enforce MIME, data URLs, signatures and combined history counts',()=>{
 for(const image of [{...png,mimeType:'image/svg+xml'},{...png,dataUrl:'https://example.test/picture.png'},{...png,mimeType:'image/jpeg'},{...png,dataUrl:'data:image/png;base64,SGVsbG8='}])assert.throws(()=>buildStepAssistRequest({...fixture(),images:[image]}),/图片|MIME|PNG/)
 const oversized={...png,dataUrl:'data:image/png;base64,'+Buffer.alloc(STEP_ASSIST_LIMITS.maxImageBytes+1).toString('base64')}
 assert.throws(()=>buildStepAssistRequest({...fixture(),images:[oversized]}),/3 MB/)
 const large=Array.from({length:4},(_,i)=>{const bytes=Buffer.alloc(1700000,i+1);Buffer.from('\x89PNG\r\n\x1a\n','binary').copy(bytes);return {...png,name:i+'.png',dataUrl:'data:image/png;base64,'+bytes.toString('base64')}})
 assert.throws(()=>buildStepAssistRequest({...fixture(),images:large}),/6 MB/)
 assert.throws(()=>buildStepAssistRequest({...fixture(),attachments:[{name:'a.txt',text:'字'.repeat(20001)}]}),/文字附件/)
 const o=fixture(),history=[{eventId:o.event.id,taskId:o.task.id,stepIndex:0,role:'user',text:'旧记录',attachments:[{name:'a',text:'a'},{name:'b',text:'b'}]}]
 assert.throws(()=>buildStepAssistRequest({...o,history,attachments:[{name:'c',text:'c'},{name:'d',text:'d'}]}),/3 份/)
})

test('structured replies are only questions or note drafts, never result selection or automatic operations',()=>{
 assert.deepEqual(normalizeStepAssistResult({kind:'question',text:'具体检查了哪个接口？'}),{kind:'question',text:'具体检查了哪个接口？'})
 assert.deepEqual(normalizeStepAssistResult({kind:'draft',text:'请核对草稿。',note:'接口未见松动，动作尚未检查。'}),{kind:'draft',text:'请核对草稿。',note:'接口未见松动，动作尚未检查。'})
 for(const value of [{kind:'draft',text:'完成',note:'测试',result:'未见异常'},{kind:'question',text:'测试',submit:true},{kind:'draft',text:'测试',note:''},{kind:'complete',text:'测试'}])assert.throws(()=>normalizeStepAssistResult(value))
})
