import test from 'node:test'
import assert from 'node:assert/strict'
import {createServer} from 'vite'
import {createPinia,setActivePinia} from 'pinia'
import {createSSRApp} from 'vue'
import {renderToString} from '@vue/server-renderer'
import {routerKey} from 'vue-router'

test('all observation rounds retain independent execution, measurement and outcome receipts in chronological order',async()=>{
  const server=await createServer({optimizeDeps:{noDiscovery:true,include:[]},server:{middlewareMode:true,hmr:false,ws:false},appType:'custom'})
  try{
    const {usePhase2DemoStore}=await server.ssrLoadModule('/src/stores/phase2DemoStore.js')
    const {executionPreset}=await server.ssrLoadModule('/src/mock/realScenarioPresets.js')
    const {observationRoundViews}=await server.ssrLoadModule('/src/mock/observationRounds.js')
    const {default:SituationObservation}=await server.ssrLoadModule('/src/components/SituationObservation.vue')
    const pinia=createPinia();setActivePinia(pinia)
    const store=usePhase2DemoStore(),id='real-alarm-0430'
    store.createTodo(id);store.selectTodo(id);store.advanceTodo(id)
    const completeRepair=round=>{
      store.advanceTodo(id,store.currentStage.tasks.map((task,i)=>({label:task.label,result:i?'未见异常':'发现异常',note:`第${round}轮核查证据`})))
      const form=store.executionInquiry(id)
      assert.ok(form,`round ${round} must reach an execution form`)
      assert.equal(store.confirmExecutionRecord(id,form.id,{...form.values,...executionPreset(store.cases[id],store.currentStage,'complete'),
        measures:`第${round}轮实际措施原文`,acceptance:`第${round}轮验收原文`,executedAt:`2026-10-${10+round}T10:00`}),true)
    }
    const measure=round=>assert.equal(store.submitObservationReview(id,'continue',{day:0,value0:260+round,value1:258+round,conditions:`第${round}轮同工况`,note:`第${round}轮观察说明`}),true)
    completeRepair(1);measure(1)
    assert.equal(store.submitObservationReview(id,'incomplete',{day:1,conditions:'首轮缺少夜间窗口',note:'补充夜间可比记录'}),true)
    const firstTarget=store.observationTargets[id]
    assert.equal(store.submitObservationReview(id,'abnormal'),true)
    const originalRecord=store.observationRecords[id][0]
    store.reopenTodo(id)
    let rounds=observationRoundViews(store,id)
    assert.deepEqual(rounds.map(item=>item.round),[1,2])
    assert.equal(rounds[0].target,firstTarget)
    assert.equal(rounds[0].result.type,'reinspect')
    assert.equal(rounds[0].execution.values.measures,'第1轮实际措施原文')
    assert.equal(rounds[1].execution,null,'first-round execution cannot appear as new repair')
    assert.equal(rounds[1].before,null,'status-only recurrence does not fabricate a second-round before measurement')
    assert.equal(rounds[1].records.length,0)
    originalRecord.values[0]=999
    store.executionRecords[id][0].values.measures='later external edit'
    assert.equal(rounds[0].records[0].values[0],261,'archive has no shared nested measurement array')
    assert.equal(rounds[0].execution.values.measures,'第1轮实际措施原文','archive has independent execution receipt')
    const render=()=>{const app=createSSRApp(SituationObservation,{scenario:id});app.use(pinia);app.provide(routerKey,{push(){}});return renderToString(app)}
    const pending=await render()
    assert.ok(pending.indexOf('第 1 轮')<pending.indexOf('第 2 轮 · 本轮修复后观察'))
    assert.match(pending,/第1轮实际措施原文/)
    assert.match(pending,/等待本轮执行验收/)
    assert.doesNotMatch(pending,/aria-label="修复观察结果"/,'observation feedback is unavailable during reinspection')
    completeRepair(2);measure(2)
    assert.equal(store.submitObservationReview(id,'abnormal'),true)
    store.reopenTodo(id)
    completeRepair(3);measure(3)
    assert.equal(store.submitObservationReview(id,'stable'),true)
    store.completeObservation(id)
    rounds=observationRoundViews(store,id)
    assert.deepEqual(rounds.map(item=>item.round),[1,2,3])
    assert.deepEqual(rounds.map(item=>item.execution.values.measures),['第1轮实际措施原文','第2轮实际措施原文','第3轮实际措施原文'])
    assert.deepEqual(rounds.map(item=>item.records[0].values[0]),[261,262,263])
    assert.equal(rounds[2].status,'closed')
    assert.equal(rounds[2].result.title,'本轮效果观察已闭环')
    const closed=await render()
    assert.ok(closed.indexOf('第 1 轮 · 历史修复观察')<closed.indexOf('第 2 轮 · 历史修复观察'))
    assert.ok(closed.indexOf('第 2 轮 · 历史修复观察')<closed.indexOf('第 3 轮 · 本轮修复后观察'))
    for(const round of [1,2,3])assert.match(closed,new RegExp(`第${round}轮实际措施原文`))
  }finally{await server.close()}
})

test('failed acceptance is an unobserved repair round and later recurrence keeps execution and observation numbers aligned',async()=>{
  const server=await createServer({optimizeDeps:{noDiscovery:true,include:[]},server:{middlewareMode:true,hmr:false,ws:false},appType:'custom'})
  try{
    const {usePhase2DemoStore}=await server.ssrLoadModule('/src/stores/phase2DemoStore.js')
    const {observationRoundViews}=await server.ssrLoadModule('/src/mock/observationRounds.js')
    const {default:SituationObservation}=await server.ssrLoadModule('/src/components/SituationObservation.vue')
    const pinia=createPinia();setActivePinia(pinia)
    const store=usePhase2DemoStore(),id='real-alarm-0430'
    store.createTodo(id);store.selectTodo(id);store.advanceTodo(id)
    const execute=(round,verification)=>{
      store.advanceTodo(id,store.currentStage.tasks.map((task,i)=>({label:task.label,result:i?'未见异常':'发现异常',note:`第${round}轮核查依据`})))
      const form=store.executionInquiry(id)
      assert.ok(form)
      assert.equal(store.confirmExecutionRecord(id,form.id,{executedAt:`2026-10-${10+round}T10:00`,measures:`第${round}轮实施记录`,acceptance:verification==='resolved'?'本轮现场验收已通过':'本轮验收仍有异常，尚未开展观察',verification}),true)
    }
    execute(1,'unresolved')
    assert.equal(store.workflowRounds[id],2)
    assert.equal(store.observationRounds[id],2)
    let rounds=observationRoundViews(store,id)
    assert.deepEqual(rounds.map(item=>item.round),[1,2])
    assert.equal(rounds[0].status,'not-started')
    assert.equal(rounds[0].records.length,0)
    assert.equal(rounds[0].execution.round,1)
    assert.equal(rounds[0].result.title,'验收未通过，未进入效果观察')
    assert.equal(rounds[1].execution,null)
    const app=createSSRApp(SituationObservation,{scenario:id});app.use(pinia);app.provide(routerKey,{push(){}})
    const html=await renderToString(app)
    assert.match(html,/第 1 轮 · 执行验收记录/)
    assert.match(html,/验收未通过，未进入效果观察/)
    assert.doesNotMatch(html,/第 1 轮 · 历史修复观察/)
    execute(2,'resolved')
    assert.equal(store.submitObservationReview(id,'continue',{day:0,value0:262,value1:260,conditions:'第二轮可比工况',note:'本轮观察读数'}),true)
    assert.equal(store.submitObservationReview(id,'abnormal'),true)
    store.reopenTodo(id)
    assert.equal(store.workflowRounds[id],3)
    assert.equal(store.observationRounds[id],3)
    rounds=observationRoundViews(store,id)
    assert.deepEqual(rounds.map(item=>item.round),[1,2,3])
    assert.equal(rounds[1].status,'reinspect')
    assert.equal(rounds[1].execution.round,2)
    assert.equal(rounds[1].records[0].values[0],262)
    assert.equal(rounds[2].execution,null)
    assert.equal(rounds[2].records.length,0)
  }finally{await server.close()}
})
