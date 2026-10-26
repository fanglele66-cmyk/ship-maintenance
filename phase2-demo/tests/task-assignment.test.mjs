import test from 'node:test'
import assert from 'node:assert/strict'
import {createServer} from 'vite'
import {createPinia,setActivePinia} from 'pinia'

test('decision to task preserves assignment, feedback actor and history without duplicate tasks',async()=>{
 const server=await createServer({optimizeDeps:{noDiscovery:true,include:[]},server:{middlewareMode:true,hmr:false,ws:false},appType:'custom'})
 try{
  const {usePhase2DemoStore}=await server.ssrLoadModule('/src/stores/phase2DemoStore.js')
  const {deviceHistory}=await server.ssrLoadModule('/src/mock/phase2History.js')
  const {todoAssessment,todoBrief}=await server.ssrLoadModule('/src/mock/captainAssessments.js')
  setActivePinia(createPinia());const store=usePhase2DemoStore(),id='real-tracking-exhaust-baseline'
  // Use an active verification task; unopened legacy scenarios stay gated.
  assert.equal(store.createTodo('aux-health'),false)
  assert.equal(store.openRealCase(id),true)
  const reason='先补齐两段操纵指令记录，暂不追加现场核实'
  assert.equal(store.ignoreSuggestion(id,reason),true)
  assert.equal(store.todoCreated[id],false)
  assert.equal(deviceHistory(store).find(row=>row.id==='decision-'+id)?.summary,reason)

  assert.equal(store.createTodo(id),true)
  assert.equal(store.ignoredSuggestions[id],undefined)
  assert.equal(store.createTodo(id),false)
  const assignment={owner:'李建国（大管轮）',collaborator:'赵明（三管轮）',type:'现场核实',due:'尽快完成首轮核实',scope:'核对两段操纵指令、转动方向及现场记录，注明未确认范围'}
  assert.equal(store.assignTask(id,assignment),true)
  assert.equal(store.assignmentRecords[id].length,1)
  assert.equal(store.assignmentRecords[id][0].owner,assignment.owner)
  assert.equal(store.assignmentRecords[id][0].assignedBy,'陈志远（轮机长）')
  assert.equal(store.assignmentRecords[id][0].scope,assignment.scope)
  assert.equal(store.taskActors[id],assignment.owner)
  assert.equal(store.visibleTodos.filter(task=>task.id===id).length,1)
  assert.equal(store.createTodo(id),false)
  assert.equal(store.assignmentRecords[id].length,1,'duplicate creation does not duplicate the assignment')
  assert.equal(store.assignments[id].owner,assignment.owner)

  store.selectTodo(id)
  assert.equal(store.advanceTodo(id).advanced,true)
  assert.equal(store.currentStage.kind,'check')
  const executor=assignment.collaborator
  store.taskActors[id]=executor
  const feedback=store.currentStage.tasks.map((task,index)=>({label:task.label,result:index?'信息已记录':'现场与系统一致',note:index?'两段操纵记录已对应，未取得的角度通道记录保留待补':'就地读数与系统对应，保留转速符号及核对时刻'}))
  const result=store.advanceTodo(id,feedback)
  assert.equal(result.saved,true)
  assert.equal(result.advanced,false,'tracking feedback waits for a recorded decision')
  const submitted=store.logs[id].findLast(row=>row.kind==='feedbackRecord')
  assert.equal(submitted.actor,executor)
  assert.deepEqual(submitted.records.map(({label,result,note})=>({label,result,note})),feedback)
  assert.equal(store.assignments[id].owner,assignment.owner,'feedback actor does not replace the task owner')
  const assignmentHistory=deviceHistory(store).find(row=>row.id==='assignment-'+id+'-0')
  assert.equal(assignmentHistory.taskId,id)
  assert.equal(assignmentHistory.target,id)
  assert.equal(assignmentHistory.conclusion,assignment.scope)
  assert.match(todoAssessment(store),/1 项任务/)
  assert.match(todoBrief(store).bottleneck,/已取得部分反馈/)

  assert.equal(store.decideCheck(id,'finish-tracking','核实范围与限制已记录，结束本次人工核实，原跟踪继续'),true)
  assert.equal(store.completedTasks[id].actor,executor)
  assert.equal(store.activeTaskPortfolio.some(task=>task.id===id),false)
  assert.equal(store.taskPortfolio.filter(task=>task.id===id).length,1,'completed task remains in history')
  assert.equal(store.assignments[id].owner,assignment.owner)
  assert.equal(deviceHistory(store).find(row=>row.id==='decision-'+id)?.summary,reason,'later dispatch preserves the earlier decision')
  assert.equal(deviceHistory(store).filter(row=>row.id==='assignment-'+id+'-0').length,1)
  assert.equal(store.logs[id].filter(row=>row.kind==='feedbackRecord').length,1)

  store.resetDemo()
  assert.deepEqual({...store.assignmentRecords},{})
  assert.equal(store.todoCreated[id],false)
  assert.equal(store.completedTasks[id],undefined)
  assert.equal(store.suggestionDecisions.length,0)
  assert.equal(store.logs[id].some(row=>row.kind==='feedbackRecord'),false)
 }finally{await server.close()}
})
