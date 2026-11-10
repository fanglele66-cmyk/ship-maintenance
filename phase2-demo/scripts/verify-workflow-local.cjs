// Local-only acceptance: actual copied database and detector, in-process model responses.
// No model API or external data transfer. Test accounts and events use an isolated directory.
const {chromium}=require(process.env.SHIP_PLAYWRIGHT_PATH||'playwright');
const fs=require('node:fs/promises'),path=require('node:path'),{pathToFileURL}=require('node:url'),{createServer}=require('node:http'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),out=path.join(root,'.local-data/qa-browser');
const mod=name=>import(pathToFileURL(root+'/'+name));
(async()=>{
 await fs.mkdir(out,{recursive:true});
 const directory=await fs.mkdtemp(path.join(root,'.local-data/qa-workflow-'));process.env.SHIP_DATA_DIR=directory;
 const manifest=JSON.parse(await fs.readFile(root+'/.local-data/manifest.json','utf8'));await fs.writeFile(path.join(directory,'manifest.json'),JSON.stringify(manifest));await fs.link(path.join(root,'.local-data',manifest.database),path.join(directory,manifest.database));
 const {createAuthService}=await mod('server/auth-api.mjs'),{openLocalData}=await mod('server/local-data.mjs'),{createAiHandler}=await mod('server/ai-api.mjs'),{getWorkflowService,workflowHandler}=await mod('server/workflow-service.mjs');

 const configuration={read:async()=>({source:'manual',enabled:true,apiKey:'local-test-only',model:'in-process-test',baseUrl:'https://example.invalid/v1',protocol:'openai',maxTokens:8192,timeoutMs:5000,knowledgeEnabled:false})};
 const localModel=async(_url,options)=>{
  const request=JSON.parse(options.body),raw=request.messages.at(-1).content,text=typeof raw==='string'?raw:raw[0].text;
  const content=JSON.parse(text.replace(/^<yincang>|<\/yincang>$/g,''));let value;
  if(content.report&&content.evidence)value={title:'燃油进机压力波动核实',summary:'现场上报压力波动，核对现场表计与本窗口记录。',interpretation:'主机停机，现有采样与现场读数需要对齐核实。',unverified:'短时波动幅度及对应时刻尚待确认。',recommendation:'安排核对燃油进机压力指示和独立表计。',steps:[{label:'核对现场压力',guide:'同步核对现场表计与系统压力。',checks:['记录读数与时间。'],recordHint:'回交现场读数与系统读数。'},{label:'检查关联管路',guide:'查看关联管路可见状态。',checks:['记录可见渗漏情况。'],recordHint:'回交现场检查结果。'}]};
  else if(content.step)value=content.clarificationRounds>=2||content.message.text.includes('0.89')?{kind:'draft',text:'已整理，请核对后采用或继续修改。',note:'已核对独立表计，燃油进机压力0.89 MPa，和系统一致；未发现泄漏。'}:{kind:'question',text:'现场独立表计读数是多少？'};
  else if(content.editConstraints)value={operations:[{type:'remove',step:2}]};
  else if(content.pendingTask)value={scope:'核对当前异常相关测点。',rationale:'依据本轮记录安排后续核实。',steps:[{label:'核对现场压力',guide:'同步核对现场表计与系统压力。',checks:['记录读数与时间。'],recordHint:'回交现场读数与系统读数。'}]};
  else if(content.sensors)value={summary:'观察窗口内已取得相关测点记录，停机状态下的运行效果待验证。',analysis:'结合相关系统全部测点及转速核对本窗口变化。',next:'交轮机长核对后续验证安排。'};
  else if(content.submissionContext||content.event?.submissionContext)value={summary:'本次已核对现场表计，与系统读数一致。',analysis:{evidence:'执行人回交压力0.89 MPa。',interpretation:'本次核对未见读数不一致。',unverified:'短时波动原因尚待核实。',next:'轮机长审阅本轮记录。'}};
  else value='已依据本事件现有记录整理，后续安排由轮机长确认。';
  if(!request.stream)return Response.json({model:'in-process-test',choices:[{message:{content:JSON.stringify(value)},finish_reason:'stop'}]});
  return new Response('data: '+JSON.stringify({model:'in-process-test',choices:[{delta:{content:typeof value==='string'?value:JSON.stringify(value)},finish_reason:'stop'}]})+'\n\ndata: [DONE]\n\n',{headers:{'Content-Type':'text/event-stream'}});
 };
 const auth=await createAuthService(root,{directory,passwords:{chief:'qa-chief',engineer1:'qa-engineer',engineer2:'qa-second',admin:'qa-admin'}}),data=openLocalData(root,directory),service=await getWorkflowService(root,{configuration,fetcher:localModel}),events=await workflowHandler(root),ai=createAiHandler(root,{configuration,fetcher:localModel});service.start();
 const json=(res,value)=>{res.setHeader('Content-Type','application/json');res.end(JSON.stringify(value))};
 const server=createServer((req,res)=>auth.handler(req,res,()=>events(req,res,()=>ai(req,res,async()=>{
  if(req.url==='/api/data/situation')return json(res,data.snapshot());
  if(req.url==='/api/data/health')return json(res,{latest:JSON.parse(await fs.readFile(root+'/.local-data/health-latest.json','utf8'))});
  let file=path.resolve(root,'dist','.'+decodeURIComponent(req.url.split('?')[0]));if(!file.startsWith(path.resolve(root,'dist')+path.sep))file=path.join(root,'dist/index.html');
  try{if(!(await fs.stat(file)).isFile())file=path.join(root,'dist/index.html')}catch{file=path.join(root,'dist/index.html')}
  res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png','.svg':'image/svg+xml','.json':'application/json'})[path.extname(file)]||'application/octet-stream');res.end(await fs.readFile(file));
 }))).catch(e=>{console.error('server',e);if(!res.headersSent)res.statusCode=500;res.end(JSON.stringify({error:e.message}))}));
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const base=`http://127.0.0.1:${server.address().port}`;
 const browser=await chromium.launch({...(process.env.SHIP_BROWSER_PATH?{executablePath:process.env.SHIP_BROWSER_PATH}:{channel:'msedge'}),headless:true}),page=await browser.newPage({viewport:{width:1536,height:960},reducedMotion:'reduce'});page.setDefaultTimeout(20000);
 const errors=[],calls=[];page.on('pageerror',e=>errors.push(e.message));page.on('response',async r=>{if(r.url().endsWith('/api/ai/chat'))calls.push({status:r.status(),at:new Date().toISOString()});});
 const login=async(name,password)=>{await page.getByLabel('账号',{exact:true}).fill(name);await page.getByLabel('密码',{exact:true}).fill(password);await page.getByRole('button',{name:'登录',exact:true}).click();await page.locator('.app-nav').waitFor()};
 const logout=async()=>{await page.locator('.nav-role-avatar').click();await page.getByRole('button',{name:'退出登录',exact:true}).click();await page.getByLabel('账号',{exact:true}).waitFor()};
 const snapshot=()=>JSON.parse(require('node:fs').readFileSync(path.join(directory,'events',eventId,'event.json'),'utf8'));
 let eventId;const receipt={directory,base,steps:[],errors,calls};const checkpoint=async(name)=>{receipt.steps.push(name);await fs.writeFile(path.join(out,'workflow-local-qa.json'),JSON.stringify(receipt,null,2));console.log(name)};
 try{
  await page.goto(base+'/#/issues');await page.getByText('船舶设备健康管理助手',{exact:true}).waitFor();await page.screenshot({path:path.join(out,'login-final.png')});await login('engineer1','qa-engineer');await checkpoint('logged in engineer');
  await page.goto(base+'/#/situation');await page.getByRole('button',{name:'查看主机设备详情',exact:true}).click();await page.locator('.device-assessment-detail summary').click();await page.locator('.device-detailed-body h3').first().waitFor();assert(!await page.locator('.device-detailed-body').innerText().then(t=>t.includes('##')));await page.screenshot({path:path.join(out,'health-detail-final.png')});await checkpoint('health detail headings rendered without Markdown markers');await page.goto(base+'/#/issues');
  await page.getByRole('button',{name:'＋ 异常上报',exact:true}).click();await page.getByLabel('上报设备').selectOption('main-engine-1');await page.getByLabel('关联传感器所属系统').selectOption('燃油系统');await page.locator('.sensor-options input[value="s-002"]').check();
  await page.locator('.report-description textarea').fill('现场巡检时发现燃油进机压力指示有短时波动，具体幅度尚未核实，请结合最近半小时数据安排核对；主机当前停机。');
  await page.getByRole('button',{name:'提交异常报告',exact:true}).click();await page.waitForURL(/manual-/, {timeout:240000});eventId=page.url().split('/').at(-1).split('?')[0];receipt.eventId=eventId;
  await page.locator('.lc-event-header h1').waitFor();await page.screenshot({path:path.join(out,'manual-event-local.png')});assert(snapshot().manualReport.evidence[0].sampleCount>0);await checkpoint('actual database detection + in-process model event persisted');
  await logout();await login('chief','qa-chief');await page.goto(base+'/#/situation/issue/'+eventId);await page.getByRole('button',{name:'AI排查建议',exact:true}).click();await page.getByRole('button',{name:'修改AI建议',exact:true}).waitFor();
  await page.getByRole('button',{name:'修改AI建议',exact:true}).click();await page.getByLabel('询问助手').fill('只保留第1项，其他步骤删除；第1项检查要求保留。');await page.getByLabel('询问助手').press('Enter');

  await page.waitForFunction(id=>{const e=JSON.parse(localStorage.getItem('engine-room-captain-workflow-v1')).events[id];return e.pendingPlan?.status==='ready'&&e.pendingPlan.steps.length===1},eventId,{timeout:180000});await checkpoint('event assistant edited investigation plan');
  await page.getByRole('button',{name:'填写决策',exact:true}).click();await page.getByRole('radio',{name:'派发排查',exact:true}).check();await page.getByRole('button',{name:'确认派发排查',exact:true}).click();
  await page.waitForFunction(id=>JSON.parse(localStorage.getItem('engine-room-captain-workflow-v1')).events[id].tasks.length===1,eventId);await logout();await login('engineer1','qa-engineer');
  const taskId=snapshot().currentTask;receipt.taskId=taskId;await page.goto(base+'/#/tasks/'+taskId);await page.getByLabel('询问助手').waitFor();await page.getByText('我是任务助手',{exact:false}).waitFor();await checkpoint('assigned task + engineer assistant welcome');
  for(const text of ['现场已核对独立表计，燃油进机压力0.89 MPa，和系统一致，未发现泄漏。','补充：记录时间为本次巡检时，主机停机，其他情况尚未核实。','以上就是目前掌握的全部情况，请整理备注。']){
   const before=await page.locator('.step-note-message').count();await page.getByLabel('询问助手').fill(text);await page.getByLabel('询问助手').press('Enter');
   await page.waitForFunction(n=>document.querySelectorAll('.step-note-message').length>n&&!document.querySelector('.step-note-progress'),before,{timeout:180000});
   if(await page.getByText('这份备注草稿怎么处理？',{exact:true}).count())break;
  }
  await page.screenshot({path:path.join(out,'task-assistant-local.png')});
  await page.locator('.assistant-question label').filter({hasText:'采用到本步骤'}).click();
  const confirmation=page.getByRole('button',{name:'确认 →',exact:true});if(await confirmation.count())await confirmation.click();
  await page.waitForFunction(()=>[...document.querySelectorAll('.lc-task-feedback textarea')].some(t=>t.value.includes('0.89')));await checkpoint('task note adopted to left form');
  await page.getByRole('radio',{name:'未见异常',exact:true}).check();await page.getByRole('button',{name:'提交排查报告',exact:true}).click();
  await page.waitForFunction(id=>JSON.parse(localStorage.getItem('engine-room-captain-workflow-v1')).events[id].tasks[0].status==='submitted',eventId,{timeout:180000});await checkpoint('formal feedback enriched into same report');
  await logout();await login('chief','qa-chief');await page.goto(base+'/#/situation/issue/'+eventId);await page.getByRole('button',{name:'填写决策',exact:true}).click();await page.getByRole('radio',{name:'效果观察',exact:true}).check();
  const due=new Date(Date.now()+90000).toLocaleString('sv-SE',{timeZone:'Asia/Shanghai'}).slice(0,16).replace(' ','T');await page.locator('dialog[open] input[type=datetime-local]').fill(due);await page.getByRole('button',{name:'确认转入效果观察',exact:true}).click();
  await page.waitForFunction(id=>JSON.parse(localStorage.getItem('engine-room-captain-workflow-v1')).events[id].observationEventIds?.length,eventId);await logout();await checkpoint('observation scheduled then browser logged out');
  const observationId=snapshot().observationEventIds[0];receipt.observationId=observationId;
  await page.waitForTimeout(Math.max(0,Date.parse(due+':00+08:00')-Date.now()+1000));await service.tick();
  const observation=service.repository.get(observationId);assert.equal(observation.reports.filter(r=>r.kind==='观察报告').length,1);assert(observation.reports.at(-1).observationSnapshot.sensors.length>1);receipt.observedSensors=observation.reports.at(-1).observationSnapshot.sensors.length;await checkpoint('due report generated without browser login');
  await login('chief','qa-chief');await page.goto(base+'/#/situation/issue/'+observationId);await page.screenshot({path:path.join(out,'observation-report-local.png')});
  assert.deepEqual(errors,[]);assert.equal(await page.locator('vite-error-overlay').count(),0);assert(!await page.locator('body').innerText().then(t=>t.includes('<yincang>')));await checkpoint('desktop flow passed');
 }catch(e){receipt.failure=e.stack;await page.screenshot({path:path.join(out,'workflow-failure.png')});await fs.writeFile(path.join(out,'workflow-failure-text.txt'),await page.locator('body').innerText());throw e}
 finally{await fs.writeFile(path.join(out,'workflow-local-qa.json'),JSON.stringify(receipt,null,2));await browser.close();await service.close();await new Promise(r=>server.close(r));auth.close();data.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
