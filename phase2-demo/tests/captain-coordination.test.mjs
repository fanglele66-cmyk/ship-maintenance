import test from 'node:test'
import assert from 'node:assert/strict'
import {createServer} from 'vite'
import {createPinia,setActivePinia,disposePinia} from 'pinia'
import {createSSRApp} from 'vue'
import {renderToString} from '@vue/server-renderer'
import {routerKey,routeLocationKey} from 'vue-router'

test('captain summaries distinguish fleet decisions from assigned task execution using current state',async t=>{
  const server=await createServer({optimizeDeps:{noDiscovery:true,include:[]},server:{middlewareMode:true,hmr:false,ws:false},appType:'custom'}),pinias=[]
  try{
    const {usePhase2DemoStore}=await server.ssrLoadModule('/src/stores/phase2DemoStore.js')
    const {captainSituationBrief,captainTaskBrief}=await server.ssrLoadModule('/src/mock/captainCoordination.js')
    const {shipOverviewConversation,shipSituationReply}=await server.ssrLoadModule('/src/mock/phase2ShipConversation.js')
    const now=Date.parse('2026-10-27T10:00:00+08:00'),alarm='real-alarm-0430',warning='real-warning-0523'
    function fresh(){const pinia=createPinia();pinias.push(pinia);setActivePinia(pinia);return {pinia,store:usePhase2DemoStore()}}
    function assign(store,id,owner='测试大管轮',due='2026-10-27 09:00'){
      assert.equal(store.createTodo(id),true)
      assert.equal(store.assignTask(id,{owner,due,type:'现场核实',scope:'已确认的本次核实范围'}),true)
    }
    function work(store){
      store.selectTodo(alarm);store.advanceTodo(alarm)
      store.advanceTodo(alarm,store.currentStage.tasks.map((task,index)=>({label:task.label,result:index?'未见异常':'发现异常',note:'本轮现场已提交的检查依据'})))
      assert.equal(store.currentStage.kind,'work')
    }
    function acceptanceValues(form,verification='resolved'){
      return {...form.values,...Object.fromEntries(form.fields.filter(field=>field.acceptanceItem).map(field=>[field.key,'本项验收检查已记录'])),executedAt:'2026-10-20T08:00',measures:'保留真实措施正文',acceptance:'保留真实验收正文',verification}
    }
    await t.test('initial risks, device changes and returned decisions remain separate from unassigned work',()=>{
      const {store}=fresh(),report=captainSituationBrief(store,{hours:12,readings:[{id:'s-012',min:'98.2',max:'101.3'},{id:'main-load',min:'40.0',max:'52.0'}]})
      assert.equal(report.rows.length,4)
      assert.equal(report.decisions.length,4)
      assert.match(report.overview,/3 项待决策、1 项核实回交待确认/)
      assert.match(report.markdown,/主机转速 98.2–101.3 rpm，负荷 40.0–52.0%/)
      assert.match(report.riskText,/二缸/)
      assert.match(report.changeText,/四缸/)
      assert.match(report.decisionText,/审阅已回交/)
      assert.equal(captainTaskBrief(store).tasks.length,0)
      assert.match(shipOverviewConversation(store).markdown,/运行风险[\s\S]*设备变化[\s\S]*待决策事项/)
      assert.match(shipSituationReply(store,'四缸现在如何安排').paragraphs[0].text,/待轮机长确认/)
    })
    await t.test('dispatch removes the initial decision and exposes real owner, deadline and execution priority',()=>{
      const {store}=fresh();assign(store,warning,'测试二管轮','待靠港窗口确认');assign(store,alarm)
      const report=captainTaskBrief(store,{now})
      assert.deepEqual(report.tasks.map(task=>task.id),[alarm,warning])
      assert.equal(report.tasks[0].overdue,true)
      assert.equal(report.tasks[1].overdue,false,'an unspecified window is not an invented due date')
      assert.match(report.assignmentText,/测试大管轮[\s\S]*2026-10-27 09:00（已超时）/)
      assert.match(report.assignmentText,/测试二管轮[\s\S]*待靠港窗口确认/)
      assert.equal(captainSituationBrief(store).decisions.some(row=>[alarm,warning].includes(row.id)),false)
      const filtered=captainTaskBrief(store,{owner:'测试二管轮',now})
      assert.deepEqual(filtered.tasks.map(task=>task.id),[warning])
      assert.doesNotMatch(filtered.markdown,/测试大管轮/)
      assert.deepEqual(captainTaskBrief(store,{taskIds:[alarm],now}).tasks.map(task=>task.id),[alarm])
      store.assignments[alarm].due='2026-10-28 09:00'
      assert.equal(captainTaskBrief(store,{now}).tasks.find(task=>task.id===alarm).overdue,false)
    })
    await t.test('default form suggestions are not presented as confirmed assignments',()=>{
      const {store}=fresh();store.createTodo(alarm)
      const report=captainTaskBrief(store,{now})
      assert.equal(report.tasks[0].dispatched,false)
      assert.match(report.overview,/0 项已派发、1 项待确认派发/)
      assert.match(report.assignmentText,/负责人待确认/)
    })
    await t.test('unzoned dispatch deadlines use China time in every viewing timezone',()=>{
      const {store}=fresh();assign(store,alarm)
      const previousZone=process.env.TZ
      try{
        for(const zone of ['UTC','America/Los_Angeles','Asia/Shanghai']){
          process.env.TZ=zone
          for(const due of ['2026-10-27T09:00','2026-10-27 09:00','2026/10/27 9:00']){
            store.assignments[alarm].due=due
            const task=captainTaskBrief(store,{now}).tasks[0]
            assert.equal(task.deadline,Date.parse('2026-10-27T09:00+08:00'),`${zone}: ${due}`)
            assert.equal(task.overdue,true,`${zone}: ${due}`)
          }
          store.assignments[alarm].due='2026-10-27T11:00'
          assert.equal(captainTaskBrief(store,{now}).tasks[0].overdue,false,zone)
          store.assignments[alarm].due='2026-10-27T10:00'
          assert.equal(captainTaskBrief(store,{now:now+1}).tasks[0].overdue,true,zone)
          store.assignments[alarm].due='2026-10-27'
          assert.equal(captainTaskBrief(store,{now}).tasks[0].deadline,Date.parse('2026-10-27T00:00+08:00'),zone)
        }
        for(const due of ['待靠港窗口确认','2026-02-30T09:00','2026-13-27T09:00','2026-10-27T25:00']){
          store.assignments[alarm].due=due
          const task=captainTaskBrief(store,{now}).tasks[0]
          assert.equal(task.deadline,null,due)
          assert.equal(task.overdue,false,due)
        }
      }finally{if(previousZone===undefined)delete process.env.TZ;else process.env.TZ=previousZone}
    })
    await t.test('work, draft acceptance and resolved acceptance update different summaries',()=>{
      const {store}=fresh();assign(store,alarm);work(store)
      assert.equal(captainTaskBrief(store).tasks[0].awaitingAcceptance,true)
      let form=store.executionInquiry(alarm)
      assert.equal(store.updateExecutionRecord(alarm,form.id,{...form.values,measures:'已实施的本轮措施',acceptance:'尚待复测'}),true)
      assert.equal(captainTaskBrief(store).tasks[0].awaitingAcceptance,true)
      form=store.executionInquiry(alarm)
      assert.equal(store.confirmExecutionRecord(alarm,form.id,acceptanceValues(form)),true)
      assert.equal(captainTaskBrief(store).tasks.length,0,'completed hands-on work leaves the execution queue')
      assert.ok(captainSituationBrief(store).rows.some(row=>row.id===alarm),'the event still needs observation and closure')
      assert.match(captainSituationBrief(store).coordination,/处于观察阶段/)
      assert.match(captainSituationBrief(store).riskText,/现场验收已通过[\s\S]*保留真实验收正文/)
      store.eventStatus[alarm]='closed'
      assert.equal(captainSituationBrief(store).rows.some(row=>row.id===alarm),false)
    })
    await t.test('unresolved acceptance stays in the same assigned task and highlights the new investigation round',()=>{
      const {store}=fresh();assign(store,alarm);work(store)
      const form=store.executionInquiry(alarm)
      assert.equal(store.confirmExecutionRecord(alarm,form.id,acceptanceValues(form,'unresolved')),true)
      const report=captainTaskBrief(store)
      assert.equal(report.tasks[0].round,2)
      assert.match(report.priorityText,/第2轮[\s\S]*前轮未解决项/)
      assert.equal(report.tasks[0].owner,'测试大管轮')
    })
    await t.test('inconclusive feedback is an explicit review blocker without invented repair conditions',()=>{
      const {store}=fresh();assign(store,warning);store.selectTodo(warning);store.advanceTodo(warning)
      store.advanceTodo(warning,store.currentStage.tasks.map(task=>({label:task.label,result:'无法确认',note:'暂缺本阶段现场反馈'})))
      const report=captainTaskBrief(store)
      assert.equal(report.tasks[0].review,true)
      assert.match(report.blockerText,/尚需核对|未确认|未满足|当前预警依据/)
      assert.doesNotMatch(report.markdown,/备件已到|具备停机条件|已经修复/)
    })
    await t.test('unfinished work-step feedback appears as a concrete blocker',()=>{
      const {store}=fresh();assign(store,alarm);work(store)
      const form=store.stageFeedbackForm(alarm)
      const values=Object.fromEntries(form.fields.map(field=>[field.key,field.type==='select'?'未完成':'已记录尚未完成的实际原因']))
      store.updateStageFeedback(alarm,values,form.id)
      assert.equal(store.submitStageFeedback(alarm,form.id).ok,true)
      assert.match(captainTaskBrief(store).blockerText,/维修步骤尚未完成/)
    })
    await t.test('event overview and process views omit the removed shortcuts and duplicate execution summary',async()=>{
      const {store,pinia}=fresh();assign(store,alarm);work(store)
      const form=store.executionInquiry(alarm)
      store.confirmExecutionRecord(alarm,form.id,acceptanceValues(form))
      const {default:Component}=await server.ssrLoadModule('/src/components/CaptainIssueDetail.vue')
      const render=async tab=>{const app=createSSRApp(Component,{scenario:alarm});app.use(pinia);app.provide(routerKey,{push(){}});app.provide(routeLocationKey,{query:{tab},path:'/situation/issue/'+alarm});return renderToString(app)}
      assert.doesNotMatch(await render('事件概览'),/>查看研判分析<|>查看证据资料</)
      const html=await render('处置记录')
      assert.doesNotMatch(html,/接续效果观察与闭环确认|查看原始依据与执行材料|现场验收已提交，尚缺可比记录/)
      assert.match(html,/保留真实措施正文/)
      assert.match(html,/保留真实验收正文/)
    })
    for(const name of ['ShipOverview','TodoCenterView'])await server.ssrLoadModule(`/src/views/${name}.vue`)
  }finally{pinias.forEach(disposePinia);await server.close()}
})
