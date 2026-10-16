// Run against a built preview. Use browser actions only; no store injection.
const assert=require('node:assert/strict')
const fs=require('node:fs')
const path=require('node:path')
let playwright
try{playwright=require(process.env.PLAYWRIGHT_MODULE||'playwright')}catch{playwright=require('C:/Users/celin/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright')}
const fixtures=require('../src/mock/fourStoryFixtures.json')
const title=id=>fixtures.cases.find(item=>item.id===id).initialTitle
const origin=process.env.SHIP_QA_URL||'http://127.0.0.1:8789'
const evidence=process.env.SHIP_QA_OUTPUT||'D:/Project/船舶/outputs/story-verification-20261016'
fs.mkdirSync(evidence,{recursive:true})
;(async()=>{
 const browser=await playwright.chromium.launch({headless:true,executablePath:process.env.PLAYWRIGHT_EXECUTABLE_PATH||'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'})
 const results=[],errors=[]
 let page,context,current=''
 async function fresh(width=1920,height=1080){context=await browser.newContext({viewport:{width,height},deviceScaleFactor:1,reducedMotion:'reduce'});page=await context.newPage();page.setDefaultTimeout(20000);page.on('pageerror',error=>errors.push(error.message));await page.goto(origin+'/#/situation');await page.getByText('AI船舶态势分析',{exact:true}).waitFor()}
 async function record(label){assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth),page.viewportSize().width,label);results.push({label,url:page.url(),viewport:page.viewportSize(),passed:true});await page.screenshot({path:path.join(evidence,String(results.length).padStart(2,'0')+'.png'),fullPage:true})}
 async function openFromWorkbench(id){await page.locator('.captain-issues .issue-row').filter({hasText:title(id)}).click();await page.getByRole('tab',{name:'事项概览',exact:true}).waitFor()}
 async function device(id){await page.getByText('态势',{exact:true}).first().click();const back=page.getByRole('button',{name:'返回船舶态势',exact:true});if(await back.count())await back.click();await page.getByRole('button',{name:id==='main-engine-1'?'查看主机设备详情':'查看辅机设备详情',exact:true}).click();if(id!=='main-engine-1')await page.getByLabel('选择辅机').selectOption(id)}
 async function historyRoot(){await device('aux-engine-2');await page.getByRole('tab',{name:'动态记录',exact:true}).click();await page.locator('.p2-history-record').filter({hasText:'2号辅机3号缸排温长期健康跟踪'}).click()}
 async function dispatch(id,owner='李建国（大管轮）'){
  for(const tab of ['研判分析','证据资料','事项概览'])await page.getByRole('tab',{name:tab,exact:true}).click()
  await page.locator('.task-assignment').getByRole('button',{name:'采纳建议并指派',exact:true}).click()
  await page.locator('.task-assignment select').selectOption({label:owner})
  await page.locator('.task-assignment').getByRole('button',{name:'确认派发任务',exact:true}).click()
  await page.waitForURL('**/#/situation')
  await page.getByText('AI船舶态势分析',{exact:true}).waitFor()
  await page.getByText('待办',{exact:true}).first().click()
  await page.locator('.todo-ai-summary').waitFor()
  const card=page.locator('.p2-todo-card').filter({hasText:title(id)})
  assert.match(await card.innerText(),new RegExp(owner.replace(/[（）]/g,'.')))
  await card.click();await page.locator('.p2-stage-rail').waitFor()
 }
 async function startCheck(){for(let i=0;i<4;i++){const start=page.getByRole('button',{name:/已了解，开始/});if(await start.count()){await start.click();return}await page.locator('.p2-pad-footer button').click()}throw Error('未找到检查开始入口')}
 async function choose(value,note){await page.locator('.p2-current-task').getByRole('radio',{name:value,exact:true}).check();await page.locator('.p2-current-task textarea').fill(note);await page.locator('.p2-step-controls').getByRole('button',{name:/下一步|提交本轮反馈|前往验收确认/}).click()}
 async function execute({word='维修',notes,measures,at,acceptance,maintenance=false}){
  await page.getByRole('button',{name:word+'步骤',exact:true}).click()
  for(const note of notes)await choose('已完成',note)
  const form=page.locator('.p2-pad-body .p2-inquiry')
  await form.getByLabel('实际措施',{exact:false}).fill(measures)
  await form.getByLabel('实际执行时间',{exact:false}).fill(at)
  await form.getByLabel('验收与复测结果',{exact:false}).fill(acceptance)
  await form.getByLabel('本轮执行状态',{exact:false}).selectOption('completed')
  await form.getByLabel(maintenance?'本次维保验收结果':'原异常验收结果',{exact:false}).selectOption('resolved')
  await form.getByLabel('处理后可比监测数据',{exact:false}).selectOption('available')
  await form.getByRole('button',{name:'确认执行记录',exact:true}).click()
  assert.match(await page.locator('.p2-pad-body').innerText(),new RegExp(measures.slice(0,8)))
 }
 async function closeObservation(){await page.getByRole('button',{name:/查看设备态势中的效果观察/}).click();await page.locator('.p2-situation-observation .p2-observation-actions').waitFor();await page.locator('.p2-messages').getByText('本轮实际措施',{exact:true}).waitFor();assert.doesNotMatch(await page.locator('.p2-messages').innerText(),/实际执行记录待确认/);for(let i=0;i<3;i++){const next=page.getByRole('button',{name:'查看后续可比观测节点',exact:true});if(!await next.count())break;await next.click()}await page.getByRole('button',{name:'确认闭环并归档',exact:true}).click();await page.getByText('本轮已人工确认闭环，观察与实际措施保留。',{exact:true}).waitFor();assert.doesNotMatch(await page.locator('.p2-situation-observation').innerText(),/效果稳定，待确认闭环|请结合现场情况确认是否闭环/)}
 try{
  current='报警：按说明的滤器单项发现完整闭环'
  await fresh();await device('main-engine-1');await page.getByRole('tab',{name:'相关事项',exact:true}).click();await page.locator('.device-issues select').nth(0).selectOption('报警事件');await page.locator('.device-issue-content .issue-row').filter({hasText:title('fault')}).click();await dispatch('fault');await startCheck()
  await choose('发现异常','同刻出口约92°C、支路约68 m³/h；海水滤器压差0.046 MPa，滤篮有附着物，照片及测点已核对')
  await choose('未见异常','本次已覆盖的动作检查未取得调节异常证据')
  assert.match(await page.locator('.p2-pad-body').innerText(),/0.046/)
  assert.equal(await page.locator('.p2-check-stepper button').count(),0)
  await execute({notes:['按确认支路隔离清理滤篮，保留前后记录','复装密封与恢复检查完成，未维修温控阀'],measures:'实际清理海水滤器，复装密封已复核；未实施温控阀维修',at:'2026-10-15T11:00',acceptance:'无泄漏；可比负荷下出口81.2°C、支路84.6 m³/h'})
  await closeObservation();await record(current);await context.close()

  current='预警：真实性核实、原因排查、对应维修、观察与闭环'
  await fresh();await openFromWorkbench('main-warning');await dispatch('main-warning');await startCheck()
  await choose('现场与系统一致','同刻上游0.31 MPa、滤后0.24 MPa，计算压差0.07 MPa，测点与来源已核对')
  await choose('工况可比，偏离仍存在','负荷65%、入机油温44.6°C，未记录能解释变化的泵切换或调节')
  await startCheck();await choose('发现异常','主滤器检验有附着物，通路状态与压损记录留存，未凭颜色判成分');await choose('未见异常','本轮已覆盖的上游供油与调节检查未取得异常证据')
  await execute({notes:['在供油保障和隔离条件确认后完成批准的过滤段处理','复装、恢复及同刻压力资料已核对'],measures:'按实际发现处理润滑过滤段，未拆修上游供油装置',at:'2026-10-16T11:00',acceptance:'同刻滤后0.30 MPa、计算压差0.04 MPa，入机油温和负荷可比'})
  await closeObservation();await record(current);await context.close()

  current='异动：原健康链核实结束，回设备记录继续趋势并形成提前建议'
  await fresh();await historyRoot();await page.getByRole('tab',{name:'跟踪记录',exact:true}).click();assert.match(await page.locator('.p2-device-scroll').innerText(),/2026-09-28/);await page.getByRole('tab',{name:'事项概览',exact:true}).click();await page.getByRole('button',{name:'查看现场核实建议',exact:true}).click();await dispatch('aux-health','王海涛（二管轮）');await startCheck()
  await choose('现场与系统一致','10月15日09:20，就地410°C，平台409°C，对应同源显示，未作独立校准')
  await choose('条件受限，已记录限制','负荷66%、转速750 rpm；仍缺完整燃油及维护背景，未观察到持续异响')
  assert.equal(await page.locator('.p2-current-task').count(),0)
  await page.getByRole('button',{name:'结束本次核实，继续跟踪',exact:true}).click();await page.getByLabel('依据与后续说明',{exact:false}).fill('本次核实结束，已保存实际读数与背景缺项，原健康记录继续');await page.getByRole('button',{name:'确认并保存记录',exact:true}).click()
  await page.getByRole('button',{name:'时间线',exact:true}).click();assert.match(await page.locator('.p2-pad-body').innerText(),/王海涛|本次核实结束/)
  await historyRoot();await page.getByRole('button',{name:'查看后续可比节点',exact:true}).click();assert.match(await page.locator('.p2-device-scroll').innerText(),/409/);await page.getByRole('button',{name:'查看后续可比节点',exact:true}).click();assert.match(await page.locator('.p2-device-scroll').innerText(),/412/);await record(current)
  await page.getByRole('button',{name:'查看关联维保建议',exact:true}).click();await dispatch('aux-maintenance','王海涛（二管轮）');await startCheck()
  await choose('有提前处理依据','持续趋势、前序核实与临近季度项目支持提前相关检查；背景缺项继续保留，不预定换件')
  await choose('条件具备','10月24日已核对电力需求、其他机组、人员工具及批准作业窗口')
  await execute({word:'保养',maintenance:true,notes:['完成批准范围检查，未取得需更换的实际发现','无换件；检查、复装密封复核和后续安排已记录'],measures:'实际完成2号辅机3号缸相关状态检查，无换件；复装与密封复核留存',at:'2026-10-24T10:00',acceptance:'本次检查范围验收通过；3号缸404°C、其他缸399°C，负荷66%；原季度剩余项目保留'})
  await closeObservation();await record('辅机维保：不换件亦可记录、观察与人工闭环')
  await historyRoot();await page.getByRole('tab',{name:'跟踪记录',exact:true}).click();const chain=await page.locator('.p2-device-scroll').innerText();assert.match(chain,/2026-09-28/);assert.match(chain,/2026-10-24/);assert.match(chain,/无换件/);assert.match(chain,/人工确认闭环/);await record('原健康链保留前因、人工核实、实际执行和闭环');await context.close()

  current='主机轴承：提前必要性与条件分开，保养后观察闭环'
  await fresh(1536,864);await openFromWorkbench('maintenance');await dispatch('maintenance');await startCheck();await choose('有提前处理依据','1860/2000 h及可比振动反复抬升，支持提前检查，不预先判断轴瓦损坏');await choose('条件具备','10月17日靠港，隔离、人员和适用工具资料已确认')
  await execute({word:'保养',maintenance:true,notes:['完成批准范围轴承检查与保养，未更换轴瓦','适用检查资料、复装与润滑复核已留存'],measures:'完成本次轴承相关检查与保养，未更换轴瓦，原计划未覆盖项目保留',at:'2026-10-17T10:00',acceptance:'本轮范围验收通过；原测点振动2.2 mm/s、温度64°C，可比运行记录留存'})
  await closeObservation();await record(current);await context.close()

  current='观察反复：助手反馈接续原事件；正常与未知排查结果可保存'
  await fresh(1536,864);await openFromWorkbench('fault');await dispatch('fault');await startCheck();await choose('发现异常','滤器有实际发现');await choose('未见异常','本轮阀未见异常')
  await execute({notes:['完成本轮滤器处理','复装和复测完成'],measures:'本轮滤器实际处理留存，继续验证原温升',at:'2026-10-15T11:00',acceptance:'本轮现场验收通过，已取得可比记录'})
  await page.getByRole('button',{name:/查看设备态势中的效果观察/}).click();await page.locator('.p2-situation-observation').waitFor();await page.locator('.p2-messages').getByText('本轮实际措施',{exact:true}).waitFor()
  await page.getByLabel('对话输入',{exact:true}).fill('相近负荷下再次温升，支路流量下降，10月16日09:00已记录')
  await page.getByRole('button',{name:'发送',exact:true}).click();await page.getByRole('button',{name:/确认重新排查/}).click();await page.locator('.p2-stage-card.active').getByText('排查',{exact:true}).waitFor();await page.getByRole('button',{name:/已了解，开始/}).click()
  await choose('未见异常','本轮滤器未见新的异常，前轮实际措施保留');await choose('无法确认','当前调节检查条件受限，已记录限制')
  assert.match(await page.locator('.check-assessment').innerText(),/未见异常|无法确认/);assert.equal(await page.locator('.p2-current-task').count(),0);await record(current);await page.getByRole('button',{name:'返回待办中心',exact:true}).click();assert.equal(await page.locator('.p2-todo-card').count(),1);await context.close()

  assert.deepEqual(errors,[])
  const report={date:'2026-10-16',origin,method:'按操作说明通过可见入口、选择器、反馈与验收表单操作；未注入状态',results,errors}
  fs.writeFileSync(path.join(evidence,'operation-guide-results.json'),JSON.stringify(report,null,2))
  console.log(JSON.stringify(report,null,2))
 }catch(error){if(page)await page.screenshot({path:path.join(evidence,'failure.png'),fullPage:true});console.error('FAILED:',current);throw error}finally{await browser.close()}
})().catch(error=>{console.error(error);process.exitCode=1})
