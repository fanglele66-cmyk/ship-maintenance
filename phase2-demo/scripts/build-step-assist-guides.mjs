// Keep the published sendable lines identical to the local conversation routes.
import {mkdir,writeFile} from 'node:fs/promises'
import {OTHER_STEP_ASSIST_CASES as cases} from '../src/workflow/stepAssistScenarios.js'
import {taskAssistantOpening,taskAssistantOpeningReply} from '../src/workflow/taskAssistantOpening.js'

const scenarios=[
 {id:'real-warning-0523',folder:'控制空气步骤协作演示',title:'控制空气双测点低压核实',number:'CBY-EVT-20260523-001',next:'repair',
  entry:'轮机长打开控制空气事件的初始信息，核对四项排查建议，选择“派发排查”，执行人为李建国（大管轮），要求完成时间选择当前时间之后。切换为大管轮，从任务页进入第 1 轮排查。',
  handoff:'轮机长审阅排查报告后，选择“派发维修”，核对一号减压阀已定位的密封垫问题，明确 WO-AIR-001 范围。二号供气路径保留，不扩大为全部阀组或空气供给部件更换。切换为大管轮进入维修任务。',
  boundary:'两个进口压力通道不是减压阀前后测点；压力回升不等于已修复。独立表、阀前后实测和供气分段核查分别记录。',
  refs:[['控制空气供给原理图','../../public/task-reference-images/air-system-overview.png'],['进口压力位置图','../../public/task-reference-images/air-inlet-location.png'],['历史减压阀拆检照片','../../public/wiki_rt-flex50/images/changhangbiyu_20260523_pressure_reducer_disassembly.jpeg']]},
 {id:'real-tracking-exhaust-baseline',folder:'一缸步骤协作演示',title:'一缸排温长期基线抬升跟踪',number:'CBY-EVT-20260812-001',next:'maintenance',
  entry:'轮机长打开一缸事件初始信息，选择“派发排查”，执行人为李建国（大管轮），要求完成时间选择当前时间之后。切换为大管轮，从任务页进入两步排查。',
  handoff:'轮机长审阅排查报告，确认“异动成立、部件原因未定”，选择“提前维保”。在维保计划中选择 CBY-MP-BALANCE-01“一缸测温与燃烧平衡专项维保”（4 步），不要选择默认的 3 步测温保养计划。选择仍有效的靠港停机窗口，要求完成时间必须在该窗口内；当前预置上海 2027-01-31 09:00—16:00、宁波 2027-02-02 08:00—15:00。确认计划、负责人和窗口后派发，再以大管轮进入维保任务。以下作业描述对应所选窗口内的执行路径，不表示在窗口之前已经作业。',
  boundary:'核实基线抬升不等于确认喷油器或排气阀损坏。同源显示一致不能替代独立仪表校验；计划备件不等于已经领用或批准更换。',
  refs:[['排温测量位置图','../../public/task-reference-images/exhaust-temperature-points.png']]},
 {id:'real-health-c4-baseline',folder:'四缸步骤协作演示',title:'四缸排温相对基线下移跟踪',number:'CBY-EVT-20260812-002',next:'repair',
  entry:'此事件初始状态已包含第 1 轮排查报告，首轮月度资料保留，不重新填写或覆盖。轮机长审阅首轮报告后选择“继续排查”，核对两步建议“核对四缸测温连接与独立校验／核对四缸历史调整与燃烧资料”，派发给李建国（大管轮），完成时间选择当前时间之后。大管轮从任务页进入第 2 轮排查。此轮固定建议仅用于首轮报告后的首次继续排查；人工修改后的计划与后续新轮次不会被覆盖。',
  handoff:'轮机长审阅第 2 轮排查报告后选择“派发维修”，核定 WO-C4-001 仅恢复已定位的测温端子连接并独立校验，不扩展为喷油器、排气阀或未确认的探头更换。切换为大管轮进入第 1 轮维修任务。',
  boundary:'端子连接异常和短时读数波动不能自动解释整段月度基线下移；恢复连接、完成独立校验、验证长期趋势是不同记录。',
  refs:[['排温测量位置图','../../public/task-reference-images/exhaust-temperature-points.png']]},
]
const label=kind=>({investigation:'排查',repair:'维修',maintenance:'维保'}[kind])
const quote=text=>'> '+text.replaceAll('\n','\n> ')
const common=`每个任务只有一个助手。开场只出现一次，切换左侧步骤继续使用本任务对话，不重复开场。左侧不需要 AI 协助按钮；直接在右侧发送即可。附件、图片和语音入口在输入框底部，发送前核对内容。

原话完全匹配时使用固定回复，先展示分段处理进度，再给一句追问或备注草稿。追问等待合计约 1.6 秒，草稿约 1.8 秒；这是处理状态，不是外部模型的推理。脚本外新事实或改写仍调用当前配置的真实模型，并携带本任务上下文；不要把其他步骤内容当成本步已执行证据。

信息不足先追问，不会每次都给草稿。草稿出现后，输入框上方选择“采用到本步骤”，再点“确认”；只写本步备注，不自动选择结果、换步或提交。选择“继续修改”后点“确认”会点亮输入框，再发送补充；在有可选修订的步骤，可使用下文给出的修订原话。

每个主步骤可独立开始，不必完成上一主步骤的可选修订；补充回答仍需本步前文。先选结果再采用、先采用再选结果都可；若结果与描述冲突，助手先简短核对。采用后按橙黄色“下一步”提示手动切换左侧步骤。必填结果齐全时导航变绿，只代表填写齐全。

提交后任务助手最前的两句自我介绍保持不变，报告进度与提交回执在后续消息显示，不向引导语追加状态。报告页仍按现有生成流程工作，固定对话不包含最终报告生成；生成失败时保留已提交事实记录，可重试。`

for(const scenario of scenarios){
 const directory=new URL(`../docs/${scenario.folder}/`,import.meta.url)
 await mkdir(directory,{recursive:true})
 const selected=cases.filter(c=>c.eventId===scenario.id)
 const table=selected.filter(c=>c.id.endsWith(':start')).map(c=>`| ${label(c.kind)} | ${c.stepIndex+1}. ${c.stepLabel} | ${c.results[0]} |`).join('\n')
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

${refs}

以上图为原理、位置或历史参考，与本轮实际附件分开。无需重复上传参考图；确有本轮照片或读数截图时使用右侧图片入口，未上传就保留待补，不能填写“附件齐全”。本次不新建界面截图，也不恢复已删除截图。

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

输入框上方问“${opening.title}”。选择“${choice.label}”后点“确认”，相当于发送：

${quote(choice.prompt)}

助手回应：

${quote(taskAssistantOpeningReply({kind},choice.prompt).text)}

然后按下文发送现场描述。也可直接发送，不必先作开场选择。后续换步仍是同一个助手，不重复此开场。
`
  const steps=selected.filter(c=>c.kind===kind)
  for(const start of steps.filter(c=>c.id.endsWith(':start'))){
   text+=`\n## 第 ${start.stepIndex+1} 步 · ${start.stepLabel}\n\n在左侧切到对应步骤；${kind==='investigation'?'检查结果':'作业反馈'}选择 **${start.results[0]}**。可在采用草稿前后选择，按此路径已经描述的事实核对。\n`
   for(const [i,c] of steps.filter(c=>c.stepIndex===start.stepIndex).entries()){
    const revision=c.id.endsWith(':revise')
    text+=`\n### ${revision?'可选：继续修改':`发送 ${i+1}`}\n\n${revision?'在草稿选择卡点“继续修改”，确认后再发送以下内容；不需要修订可跳过。\n\n':''}${quote(c.input)}\n\n助手${c.response.kind==='question'?'追问':'回应'}：\n\n${quote(c.response.text)}\n`
    if(c.response.note){
     const canRevise=!revision&&steps.some(item=>item.stepIndex===c.stepIndex&&item.id.endsWith(':revise'))
     text+=`\n本步骤备注整理稿：\n\n${quote(c.response.note)}\n\n${canRevise?'需要下方可选修订时，先不采用，选择 **继续修改 → 确认** 后发送修订原话。不需要修订时，可直接选择 **采用到本步骤 → 确认** 并进入下一步。':'核对后，在输入框上方选择 **采用到本步骤 → 确认**。左侧备注更新为上述内容，人员选择的结果不变。'}\n`
    }
   }
   text+=start.stepIndex===Math.max(...steps.map(c=>c.stepIndex))?'\n最后一步采用后，核对各步结果与备注，再提交本轮报告。\n':'\n采用回执会提示下一步的主要内容，点击左侧 **下一步** 继续。\n'
  }
  text+=`\n## 提交与交接\n\n1. 核对全部必填结果和采用后的备注；没有上传的附件仍记待补，不补造数值。\n2. 点击左侧 **提交${label(kind)}报告**；右侧助手保持展开，开场自我介绍不变化。报告生成进度与提交回执另行显示，记录已提交与验证已完成分开。\n3. 通过“本轮执行记录／${label(kind)}报告”页签核对；执行记录按步骤切换，下载按钮下载 Markdown。\n4. ${kind==='investigation'?scenario.handoff:'本路径有未完成验证，交轮机长选择“等待条件，保留原任务”或继续派发剩余任务；缺少独立校验、完整试验或可比工况资料时，不将提交报告等同于维修有效或事件闭环。'}\n\n## 使用说明\n\n${common}\n\n图片仅使用真实上传的本轮材料；已有参考图与来源见 [README](README.md)。脚本外输入转入当前配置的真实模型，最终报告生成也沿用现有流程；本地固定回复不声称执行图片识别或真实模型推理。\n`
  await writeFile(new URL(`${label(kind)}演示脚本.md`,directory),text,'utf8')
 }
}
const rows=[['二缸报警与喷射控制核实','二缸步骤协作演示','排查 2 步 → 维修 4 步'],...scenarios.map(s=>[s.title,s.folder,s.next==='maintenance'?'排查 2 步 → 提前维保 4 步':s.id.includes('c4')?'已有首轮报告 → 第二轮排查 2 步 → 维修 4 步':'排查 4 步 → 维修 4 步'])]
await writeFile(new URL('../docs/四事件步骤协作演示索引.md',import.meta.url),`# 四事件步骤协作入口

| 事件 | 操作目录 | 路径 |
| --- | --- | --- |
${rows.map(([title,folder,path])=>`| ${title} | [说明与脚本](${folder}/README.md) | ${path} |`).join('\n')}

四项事件均支持任务级一次开场、口语输入、必要追问、备注整理、人员核对采用与提交报告。固定输入必须对应当前任务步骤；每个步骤可独立开始，脚本外输入进入真实模型。采用只写备注，不自动选择结果或提交。提交后最前的任务助手引导语保持两句不变。

一缸使用 CBY-MP-BALANCE-01 四步专项维保计划；四缸从已存在的第一轮报告继续。未完成项和材料缺口保留，由轮机长安排后续。以上目录为产品流程复现材料，预设内容不替代实际现场证据。没有新增界面截图。
`,'utf8')
console.log(`Updated ${scenarios.length} folders, 6 task scripts, ${cases.length} exact inputs and the event index.`)
