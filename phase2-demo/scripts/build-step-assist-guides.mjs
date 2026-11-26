// Keep the published sendable lines identical to the local conversation routes.
import {mkdir,writeFile} from 'node:fs/promises'
import {OTHER_STEP_ASSIST_CASES as cases} from '../src/workflow/stepAssistScenarios.js'
import {taskAssistantOpening,taskAssistantOpeningReply} from '../src/workflow/taskAssistantOpening.js'

import {taskStepResultChoices} from '../src/workflow/taskStepPresentation.js'

const resultLabel=({kind,stepLabel,results})=>taskStepResultChoices({label:stepLabel,options:results},kind)[0].label

const scenarios=[
 {id:'real-warning-0523',folder:'控制空气步骤协作演示',title:'控制空气双测点低压核实',number:'CBY-EVT-20260523-001',next:'repair',
  entry:'轮机长打开控制空气事件的初始信息，核对四项排查建议，选择“派发排查”，执行人为李建国（大管轮），要求完成时间选择当前时间之后。切换为大管轮，从任务页进入第 1 轮排查。',
  handoff:'轮机长审阅排查报告后，选择“派发维修”，核对一号减压阀已定位的密封垫问题，明确 WO-AIR-001 范围。二号供气路径保留，不扩大为全部阀组或空气供给部件更换。切换为大管轮进入维修任务。',
  boundary:'两个进口压力通道不是减压阀前后测点；压力回升不等于已修复。独立表、阀前后实测和供气分段核查分别记录。',
  photo:{kind:'repair',step:0,title:'控制空气一号减压阀隔离示意照片',path:'images/air-reducer-isolated-demo.jpg'},
  refs:[['控制空气供给原理图','../../public/task-reference-images/air-system-overview.png'],['进口压力位置图','../../public/task-reference-images/air-inlet-location.png'],['历史减压阀拆检照片','../../public/wiki_rt-flex50/images/changhangbiyu_20260523_pressure_reducer_disassembly.jpeg']]},
 {id:'real-tracking-exhaust-baseline',folder:'一缸步骤协作演示',title:'一缸排温长期基线抬升跟踪',number:'CBY-EVT-20260812-001',next:'maintenance',
  entry:'轮机长打开一缸事件初始信息，选择“派发排查”，执行人为李建国（大管轮），要求完成时间选择当前时间之后。切换为大管轮，从任务页进入两步排查。',
  handoff:'轮机长审阅排查报告，确认“异动成立、部件原因未定”，选择“提前维保”。在维保计划中选择 CBY-MP-BALANCE-01“一缸测温与燃烧平衡专项维保”（4 步），不要选择默认的 3 步测温保养计划。选择仍有效的靠港停机窗口，要求完成时间必须在该窗口内；当前预置上海 2027-01-31 09:00—16:00、宁波 2027-02-02 08:00—15:00。确认计划、负责人和窗口后派发，再以大管轮进入维保任务。以下作业描述对应所选窗口内的执行路径，不表示在窗口之前已经作业。',
  boundary:'核实基线抬升不等于确认喷油器或排气阀损坏。同源显示一致不能替代独立仪表校验；计划备件不等于已经领用或批准更换。',
  photo:{kind:'investigation',step:0,title:'一缸排温探头位置示意照片',path:'images/c1-probe-location-demo.png'},
  refs:[['排温测量位置图','../../public/task-reference-images/exhaust-temperature-points.png']]},
 {id:'real-health-c4-baseline',folder:'四缸步骤协作演示',title:'四缸排温相对基线下移跟踪',number:'CBY-EVT-20260812-002',next:'repair',
  entry:'此事件初始状态已包含第 1 轮排查报告，首轮月度资料保留，不重新填写或覆盖。轮机长审阅首轮报告后选择“继续排查”，核对两步建议“核对四缸测温连接与独立校验／核对四缸历史调整与燃烧资料”，派发给李建国（大管轮），完成时间选择当前时间之后。大管轮从任务页进入第 2 轮排查。此轮固定建议仅用于首轮报告后的首次继续排查；人工修改后的计划与后续新轮次不会被覆盖。',
  handoff:'轮机长审阅第 2 轮排查报告后选择“派发维修”，核定 WO-C4-001 仅恢复已定位的测温端子连接并独立校验，不扩展为喷油器、排气阀或未确认的探头更换。切换为大管轮进入第 1 轮维修任务。',
  boundary:'端子连接异常和短时读数波动不能自动解释整段月度基线下移；恢复连接、完成独立校验、验证长期趋势是不同记录。',
  photo:{kind:'investigation',step:0,title:'四缸测温端子连接示意照片',path:'images/c4-temperature-terminals-demo.png'},
  refs:[['排温测量位置图','../../public/task-reference-images/exhaust-temperature-points.png']]},
]
const label=kind=>({investigation:'排查',repair:'维修',maintenance:'维保'}[kind])
const quote=text=>'> '+text.replaceAll('\n','\n> ')
const samplePhoto=({photo})=>`[${photo.title}](${photo.path})`
const common=`每个任务共用一段对话，切换左侧步骤后，助手围绕当前步骤答疑。船员可随时直接选结果、写备注并提交，也可以先在右侧咨询。

需要确认现场情况时，在该条助手回复内选一个符合现场的答案并确认。没有符合的选项时，选「其他」，填写自己的情况后发送。也可以继续直接问助手。后续答疑仍在正常对话中显示，船员可以核对并采用随答复整理的草稿。

回复先答疑，再显示本步备注草稿和补充确认。选「采用到本步骤」并点「确认」即可写入备注。需要改稿时，选「其他（补充或修改）」；只有草稿时选「继续修改」。在选项内填写内容并确认。

在左侧本步备注区点「拍照」或「上传照片」。也可在右侧当前步骤的对话中选图并发送。提交时，两处原图随所属步骤的结果、备注一起归档；同一步从两处提交同一原图，只保留一份，并标明两个来源。

报告有照片时，下载 ZIP，内含 Markdown 报告与照片文件；没有照片时，直接下载 Markdown（.md）。`

for(const scenario of scenarios){
 const directory=new URL(`../docs/${scenario.folder}/`,import.meta.url)
 await mkdir(directory,{recursive:true})
 const selected=cases.filter(c=>c.eventId===scenario.id)
 const table=selected.filter(c=>c.id.endsWith(':start')).map(c=>`| ${label(c.kind)} | ${c.stepIndex+1}. ${c.stepLabel} | ${resultLabel(c)} |`).join('\n')
 const refs=scenario.refs.map(([title,path])=>`- [${title}](${path})`).join('\n')
 await writeFile(new URL('README.md',directory),`# ${scenario.title} · 步骤协作

事件：${scenario.number}（\`${scenario.id}\`）。本目录参照二缸目录，提供从任务开场到提交报告的完整操作路径和可直接发送的原话。

## 入口与流转

1. ${scenario.entry}
2. 按[排查脚本](排查演示脚本.md)填写、核对并提交。
3. ${scenario.handoff}
4. 按[${label(scenario.next)}脚本](${label(scenario.next)}演示脚本.md)逐步记录。本路径包含未完成验证，提交后保留剩余事项，由轮机长安排等待条件或剩余任务，不直接宣布闭环。

## 操作约定

${common}

已有派发任务是快照；进入前核对本目录列出的步骤标题与数量。旧任务或人工改过的方案若不一致，按其实际范围执行，不覆盖已有记录。轮机员提交前到任务页查看和填报，提交后事件页显示本轮只读记录。

## 步骤与人员选择

| 任务 | 步骤 | 选择的结果 |
| --- | --- | --- |
${table}

## 参考图与材料

${label(scenario.photo.kind)}第 ${scenario.photo.step+1} 步可用这张模拟照片演示提交：${samplePhoto(scenario)}。

作业位置与历史资料可参阅：

${refs}

${scenario.boundary}

## 核对边界

本目录是产品流程复现材料，预设输入本身不构成独立取得的现场证据。业务对话使用实际作业口吻，仍保留未执行范围、未验证结论和资料缺口。正式执行时按真实许可、检查和记录填写，不直接照抄不存在的发现。

固定内容来源：\`src/workflow/stepAssistScenarios.js\`。用 \`node scripts/build-step-assist-guides.mjs\` 可同步本目录的原话与整理稿；不会生成图片。[四事件入口索引](../四事件步骤协作演示索引.md)。
`,'utf8')
 for(const kind of ['investigation',scenario.next]){
  const opening=taskAssistantOpening({kind}),choice=opening.choices[0]
  let text=`# ${scenario.title} · ${label(kind)}协作脚本

## 实施范围

${kind==='investigation'?scenario.entry:scenario.handoff}

${scenario.boundary}

## 任务开场（整项任务一次）

任务助手先自我介绍：“我是任务助手，可以帮你把现场情况整理成${label(kind)}备注。”并提示可以说情况、发照片或读数截图。

任务助手会问“${opening.title}”。选择“${choice.label}”后点“确认”，聊天中显示：

${quote(choice.label)}

助手回应：

${quote(taskAssistantOpeningReply({kind},choice.label).text)}

然后按下文发送现场描述。也可直接发送，不必先作开场选择。后续换步仍是同一个助手，不重复此开场。
`
  const steps=selected.filter(c=>c.kind===kind)
  for(const start of steps.filter(c=>c.id.endsWith(':start'))){
   text+=`\n## 第 ${start.stepIndex+1} 步 · ${start.stepLabel}\n\n在左侧切到对应步骤；${kind==='investigation'?'检查结果':'作业反馈'}选择 **${resultLabel(start)}**。可在采用草稿前后选择，按此路径已经描述的事实核对。\n`
   if(kind===scenario.photo.kind&&start.stepIndex===scenario.photo.step){
    text+=`\n**演示随步照片**　在左侧「上传照片」选择${samplePhoto(scenario)}。要演示对话发图，可在本步右侧把同一文件随下方现场描述发送。提交后在本步执行记录里核对这张原图及「步骤备注」「助手对话」两个来源。\n`
   }
   for(const [i,c] of steps.filter(c=>c.stepIndex===start.stepIndex).entries()){
    const revision=c.id.endsWith(':revise')
    const action=revision?'可选：继续修改':`发送 ${i+1}`
    text+=`\n### ${action}\n\n${revision?'选「继续修改」，在选项下填写以下内容并确认。\n\n':''}${quote(c.input)}\n\n助手${c.response.kind==='question'?'追问':'回应'}：\n\n${quote(c.response.text)}\n`
    if(c.response.choices?.length){
     text+=`\n${quote(c.response.question)}\n\n可直接选择${c.response.choices.map(option=>"「"+option.label+"」").join("、")}。每次确认只发送所选短句。要复现下面的完整记录，请选「其他」并输入下一段现场原话。\n`
    }
    if(c.response.note){
     const canRevise=!revision&&steps.some(item=>item.stepIndex===c.stepIndex&&item.id.endsWith(':revise'))
     text+=`\n本步骤备注整理稿：\n\n${quote(c.response.note)}\n\n${canRevise?'如需调整，选「继续修改」，在卡内填写下方原话并确认。核对新稿后，选「采用到本步骤」并点「确认」。':'核对后，选「采用到本步骤」并点「确认」，即可在左侧看到备注。'}\n`
    }
   }
   text+=start.stepIndex===Math.max(...steps.map(c=>c.stepIndex))?'\n最后一步采用后，核对各步结果与备注，再提交本轮报告。\n':'\n采用回执会提示下一步的主要内容，点击左侧 **下一步** 继续。\n'
  }
  text+=`\n## 提交与交接\n\n1. 核对每步所选结果、备注和随步照片。\n2. 点击左侧 **提交${label(kind)}报告**，在右侧查看提交回执。\n3. 打开「本轮执行记录」核对每一步，再打开「${label(kind)}报告」点「下载」。有照片时得到 ZIP（含报告和原图），没有照片时得到 .md 文件。\n4. ${kind==='investigation'?scenario.handoff:'本路径仍有待验证事项，由轮机长选择「等待条件，保留原任务」或派发剩余任务。'}\n\n## 使用说明\n\n${common}\n\n本案例的示例照片和参考资料见 [README](README.md)。\n`
  await writeFile(new URL(`${label(kind)}演示脚本.md`,directory),text,'utf8')
 }
}
const rows=[['二缸报警与喷射控制核实','二缸步骤协作演示','排查 2 步 → 维修 4 步'],...scenarios.map(s=>[s.title,s.folder,s.next==='maintenance'?'排查 2 步 → 提前维保 4 步':s.id.includes('c4')?'已有首轮报告 → 第二轮排查 2 步 → 维修 4 步':'排查 4 步 → 维修 4 步'])]
await writeFile(new URL('../docs/四事件步骤协作演示索引.md',import.meta.url),`# 四事件步骤协作入口

| 事件 | 操作目录 | 路径 |
| --- | --- | --- |
${rows.map(([title,folder,path])=>`| ${title} | [说明与脚本](${folder}/README.md) | ${path} |`).join('\n')}

在当前步骤的助手回复中可选择符合现场的答案，或选「其他」自行填写。核对草稿后，选「采用到本步骤」并点「确认」。船员也可直接完成左侧表单。

演示可使用各目录提供的模拟照片。左侧添加的照片和右侧已发送的原图随步归档，同一步内的相同照片合并保存。有照片的报告下载为 ZIP，无照片时下载 .md。

一缸使用 CBY-MP-BALANCE-01 四步专项维保计划，四缸从已有的首轮报告继续排查。
`,'utf8')
console.log(`Updated ${scenarios.length} folders, 6 task scripts, ${cases.length} exact inputs and the event index.`)
