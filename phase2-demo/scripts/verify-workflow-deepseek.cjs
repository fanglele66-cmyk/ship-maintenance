// Authorized real-provider acceptance, isolated test accounts and event artifacts.
const {chromium}=require(process.env.SHIP_PLAYWRIGHT_PATH||'playwright');
const fs=require('node:fs/promises'),path=require('node:path'),{pathToFileURL}=require('node:url'),{createServer}=require('node:http'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),out=path.join(root,'.local-data/qa-deepseek');
const mod=name=>import(pathToFileURL(root+'/'+name));
(async()=>{
 if(process.env.SHIP_VERIFY_DEEPSEEK!=='1')throw Error('Set SHIP_VERIFY_DEEPSEEK=1 only after authorizing test data transfer to api.deepseek.com / deepseek-v4-flash');
 await fs.mkdir(out,{recursive:true});
 const directory=await fs.mkdtemp(path.join(root,'.local-data/qa-workflow-'));process.env.SHIP_DATA_DIR=directory;
 const manifest=JSON.parse(await fs.readFile(root+'/.local-data/manifest.json','utf8'));await fs.writeFile(path.join(directory,'manifest.json'),JSON.stringify(manifest));await fs.link(path.join(root,'.local-data',manifest.database),path.join(directory,manifest.database));
 const {createAuthService}=await mod('server/auth-api.mjs'),{openLocalData}=await mod('server/local-data.mjs'),{createAiHandler}=await mod('server/ai-api.mjs'),{getWorkflowService,workflowHandler}=await mod('server/workflow-service.mjs');
 const providerCalls=[],receipts=[];
 const approvedFetch=async(url,options)=>{
  if(new URL(url).hostname!=='api.deepseek.com')throw Error('Only the explicitly approved DeepSeek endpoint may be used');
  const request=JSON.parse(options.body);if(request.model!=='deepseek-v4-flash')throw Error('Unexpected model');
  const record={model:request.model,stream:request.stream,startedAt:new Date().toISOString()};providerCalls.push(record);
  const response=await fetch(url,options);record.status=response.status;
  receipts.push(response.clone().text().then(body=>{record.completedAt=new Date().toISOString();const frames=request.stream?body.split('\n').filter(l=>l.startsWith('data: {')).map(l=>JSON.parse(l.slice(6))):[JSON.parse(body)];record.usage=frames.findLast(v=>v.usage)?.usage;}).catch(e=>{record.error=e.message}));return response;
 };
 const auth=await createAuthService(root,{directory,passwords:{chief:'qa-chief',engineer1:'qa-engineer',engineer2:'qa-second',admin:'qa-admin'}}),data=openLocalData(root,directory),service=await getWorkflowService(root,{fetcher:approvedFetch}),events=await workflowHandler(root),ai=createAiHandler(root,{fetcher:approvedFetch});service.start();
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
 const errors=[],calls=[],saveErrors=[];page.on('response',async r=>{if(r.url().endsWith('/api/workflow/save')&&r.status()>=400){const body=r.request().postDataJSON();saveErrors.push(await r.text());await fs.writeFile(path.join(out,'workflow-sync-failure.json'),JSON.stringify({error:await r.text(),submitted:body.event,saved:service.repository.get(body.event.id)},null,2));}});page.on('pageerror',e=>errors.push(e.message));page.on('response',async r=>{if(r.url().endsWith('/api/ai/chat'))calls.push({status:r.status(),at:new Date().toISOString()});});
 const login=async(name,password)=>{await page.getByLabel('账号',{exact:true}).fill(name);await page.getByLabel('密码',{exact:true}).fill(password);await page.getByRole('button',{name:'登录',exact:true}).click();await page.locator('.app-nav').waitFor()};
 const logout=async()=>{await page.locator('.nav-role-avatar').click();await page.getByRole('button',{name:'退出登录',exact:true}).click();await page.getByLabel('账号',{exact:true}).waitFor()};
 const snapshot=()=>JSON.parse(require('node:fs').readFileSync(path.join(directory,'events',eventId,'event.json'),'utf8'));
 let eventId;const receipt={directory,base,steps:[],errors,calls,saveErrors,providerCalls};const checkpoint=async(name)=>{receipt.steps.push(name);await fs.writeFile(path.join(out,'workflow-real-qa.json'),JSON.stringify(receipt,null,2));console.log(name)};
 try{
  await page.goto(base+'/#/issues');await login('engineer1','qa-engineer');await checkpoint('logged in engineer');
  await page.getByRole('button',{name:'＋ 异常上报',exact:true}).click();await page.getByLabel('上报设备').selectOption('main-engine-1');await page.getByLabel('关联传感器所属系统').selectOption('燃油系统');await page.locator('.sensor-options input[value="s-002"]').check();
  await page.locator('.report-description textarea').fill('现场巡检时发现燃油进机压力指示有短时波动，具体幅度尚未核实，请结合最近半小时数据安排核对；主机当前停机。');
  await page.getByRole('button',{name:'提交异常报告',exact:true}).click();await page.waitForURL(/manual-/, {timeout:240000});eventId=page.url().split('/').at(-1).split('?')[0];receipt.eventId=eventId;
  await page.locator('.lc-event-header h1').waitFor();await page.screenshot({path:path.join(out,'manual-event-real.png')});assert(snapshot().manualReport.evidence[0].sampleCount>0);await checkpoint('real manual detection + model event persisted');
  await logout();await login('chief','qa-chief');await page.goto(base+'/#/situation/issue/'+eventId);await page.getByRole('button',{name:'AI排查建议',exact:true}).click();await page.getByRole('button',{name:'修改AI建议',exact:true}).waitFor();
  await page.getByRole('button',{name:'修改AI建议',exact:true}).click();await page.getByLabel('询问助手').fill('只保留第1项，其他步骤删除；第1项检查要求保留。');await page.getByLabel('询问助手').press('Enter');
  await page.waitForFunction(id=>{const e=JSON.parse(localStorage.getItem('engine-room-captain-workflow-v1')).events[id];return e.pendingPlan?.status==='ready'&&e.pendingPlan.steps.length===1},eventId,{timeout:180000});await checkpoint('event assistant edited investigation plan');
  await page.getByRole('button',{name:'填写决策',exact:true}).click();await page.getByRole('radio',{name:'派发排查',exact:true}).check();await page.getByRole('button',{name:'确认派发排查',exact:true}).click();
  await page.waitForFunction(id=>JSON.parse(localStorage.getItem('engine-room-captain-workflow-v1')).events[id].tasks.length===1,eventId);await logout();await login('engineer1','qa-engineer');
  const taskId=snapshot().currentTask;receipt.taskId=taskId;await page.goto(base+'/#/tasks/'+taskId);await page.getByLabel('询问助手').waitFor();await page.getByText('我是任务助手',{exact:false}).waitFor();await checkpoint('assigned task + engineer assistant welcome');
  for(const text of ['现场已核对独立表计，燃油进机压力0.89 MPa，和系统一致，未发现泄漏。','补充：记录时间为本次巡检时，主机停机，其他情况尚未核实。','以上就是目前掌握的全部情况，请整理备注。']){
   const before=await page.locator('.step-note-message').count();await page.getByLabel('询问助手').fill(text);await page.getByLabel('询问助手').press('Enter');
   await page.waitForFunction(n=>document.querySelectorAll('.step-note-message').length>n&&!document.querySelector('.step-note-progress'),before,{timeout:180000});
   await page.waitForTimeout(5500);if(await page.getByText('这份备注草稿怎么处理？',{exact:true}).count())break;
  }
  await page.screenshot({path:path.join(out,'task-assistant-real.png')});
  await page.locator('.assistant-question label').filter({hasText:'继续修改'}).click();await page.getByRole('button',{name:'确认 →',exact:true}).click();
  const draftCount=await page.locator('.step-note-message').count();await page.getByLabel('询问助手').fill('请把未发现泄漏改为检查范围内未见泄漏，保留0.89 MPa和系统一致的记录，其余未提供内容仍待确认。');await page.getByLabel('询问助手').press('Enter');
  await page.waitForFunction(n=>document.querySelectorAll('.step-note-message').length>n&&!document.querySelector('.step-note-progress'),draftCount,{timeout:180000});await page.getByText('这份备注草稿怎么处理？',{exact:true}).waitFor();await checkpoint('task note revised through real model');
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
  for(let n=0;n<180&&!service.repository.get(observationId).reports.some(r=>r.kind==='观察报告');n++)await page.waitForTimeout(1000);
  const observation=service.repository.get(observationId);assert.equal(observation.reports.filter(r=>r.kind==='观察报告').length,1);assert(observation.reports.at(-1).observationSnapshot.sensors.length>1);receipt.observedSensors=observation.reports.at(-1).observationSnapshot.sensors.length;await checkpoint('due report generated without browser login');
  await login('chief','qa-chief');await page.goto(base+'/#/situation/issue/'+observationId);await page.screenshot({path:path.join(out,'observation-report-real.png')});
  const messageCount=await page.evaluate(id=>JSON.parse(localStorage.getItem('engine-room-captain-workflow-v1')).events[id].conversations.captain.length,observationId);
  await page.getByLabel('询问助手').fill('本次观察有哪些依据，哪些还待核实？请简要回答。');await page.getByLabel('询问助手').press('Enter');
  await page.waitForFunction(({id,count})=>JSON.parse(localStorage.getItem('engine-room-captain-workflow-v1')).events[id].conversations.captain.slice(count).some(m=>m.kind==='model'&&m.status==='complete'),{id:observationId,count:messageCount},{timeout:180000});await checkpoint('event assistant answered observation question');
  await page.getByRole('button',{name:'填写决策',exact:true}).click();await page.getByRole('radio',{name:'派发维修',exact:true}).check();
  await page.waitForFunction(id=>{const p=JSON.parse(localStorage.getItem('engine-room-captain-workflow-v1')).events[id].pendingPlan;return p?.action==='repair'&&p.status==='ready'},observationId,{timeout:180000});
  await page.getByRole('button',{name:'查看AI维修建议 ↗',exact:true}).click();await page.getByRole('button',{name:'修改AI建议',exact:true}).click();
  const beforePlan=await page.evaluate(id=>JSON.parse(localStorage.getItem('engine-room-captain-workflow-v1')).events[id].pendingPlan,observationId);
  await page.getByLabel('询问助手').fill('第1项的回交要求改为：记录获批范围、现场核对结果以及未完成事项。其他步骤和检查要求保持不变。');await page.getByLabel('询问助手').press('Enter');
  await page.waitForFunction(({id,version})=>{const p=JSON.parse(localStorage.getItem('engine-room-captain-workflow-v1')).events[id].pendingPlan;return p.status==='ready'&&p.version>version},{id:observationId,version:beforePlan.version},{timeout:180000});
  const afterPlan=await page.evaluate(id=>JSON.parse(localStorage.getItem('engine-room-captain-workflow-v1')).events[id].pendingPlan,observationId);assert.deepEqual(afterPlan.steps.slice(1),beforePlan.steps.slice(1));assert.match(afterPlan.steps[0].recordHint,/记录获批范围/);await checkpoint('repair draft generated and targeted requirement edited');
  await page.getByRole('button',{name:'填写决策',exact:true}).click();await page.getByRole('radio',{name:'闭环',exact:true}).check();await page.getByLabel('决定依据与后续安排',{exact:true}).fill('本次现场读数核对与观察记录已回交，按已确认范围归档；未实施维修，运行效果仍待验证。');await page.getByRole('button',{name:'确认闭环并归档',exact:true}).click();
  await page.waitForFunction(id=>JSON.parse(localStorage.getItem('engine-room-captain-workflow-v1')).events[id].phase==='closed',observationId);await page.screenshot({path:path.join(out,'closed-event-real.png')});await logout();assert.equal(service.repository.get(observationId).phase,'closed');assert.equal(service.repository.get(eventId).phase,'closed');await checkpoint('observation and original event closed with persisted reports');
  assert.deepEqual(errors,[]);assert.deepEqual(saveErrors,[]);assert.equal(await page.locator('vite-error-overlay').count(),0);assert(!await page.locator('body').innerText().then(t=>t.includes('<yincang>')));await checkpoint('desktop flow passed');
 }catch(e){receipt.failure=e.stack;await fs.writeFile(path.join(out,'workflow-client-failure.json'),await page.evaluate(()=>localStorage.getItem('engine-room-captain-workflow-v1')));await page.screenshot({path:path.join(out,'workflow-failure.png')});await fs.writeFile(path.join(out,'workflow-failure-text.txt'),await page.locator('body').innerText());throw e}
 finally{await Promise.allSettled(receipts);await fs.writeFile(path.join(out,'workflow-real-qa.json'),JSON.stringify(receipt,null,2));await browser.close();await service.close();await new Promise(r=>server.close(r));auth.close();data.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
