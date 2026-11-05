// Exact, opt-in rehearsal lines from docs/二缸步骤协作演示. These are
// fictional practice records, never inferred from an image or ordinary chat.
const normalizeText=value=>typeof value==='string'?value.normalize('NFKC').replace(/[【]/g,'[').replace(/[】]/g,']').replace(/[“”]/g,'"').replace(/[‘’]/g,"'").replace(/[，、]/g,',').replace(/[。]/g,'.').replace(/[—–−]/g,'-').replace(/\s+/gu,'').replace(/[.!?]+$/u,'').trim():''

const prompts={
 investigationStart:'【虚构演示】二缸这边插头和能检查的反馈线束看了，没看到松脱或明显破损。对照报警片段，指令和反馈有一段没对应上。现在还不能从这两项判断液压执行到底有没有异常，我还没把液压动作检查情况说清楚。这张是 AI 生成的演示图，只练习上传，不是现场照片，不能拿它认定卡滞或损伤。',
 investigationAnswer:'【虚构演示】做过动作检查。检查时段是本轮演示日 15:10—15:18，按许可停机并确认燃油、伺服油隔离卸压后，按本机作业单核对液压活塞动作，三次均发涩、回位不畅，没有继续内部拆修。插接件和线束只看了可接近部位，未覆盖的线束段没有检查。没有取得厂家认可车间的内部检验记录，污染、划痕和磨损原因都还没确认。',
 investigationRevise:'再强调一下：只是液压动作回位不畅，具体卡滞原因还没确认，不能写成积碳或磨损导致。照片只是 AI 生成样例，不能写成已保存本轮现场证据。其余内容保留。',
 supply:'【虚构演示】15:25—15:35，核对了报警前后供给泵运行、阀位、滤器状态和允许接近的接口；检查的这些位置没有发现异常。供给和燃油轨压力记录已按同一时间轴与启停、六缸响应作对照，当前没有发现共同供给异常的对应片段。没有拆检全部滤器或管路；高负荷工况也没覆盖。没有做供给部件更换。请只整理这些已描述的练习事实，不补压力数字。',
 supplyClarify:'演示材料未提供，不补造数值，备注保留资料缺口',
 preparationStart:'【虚构演示】工单 DEMO-WO-C2-001 的练习范围只包括二缸 ICU 总成拆换和后续复测，不处理供给通路。备用总成与接口密封件的机型、接口、标识和检验资料已在演示清单核对，工具校验资料也查过；真实图号、序列号和力矩值不在演示材料里，不要补填。16:00—16:15 完成停机、防意外起动、燃油与伺服油分别隔离卸压，并记录现场核实方法。范围不清或隔离未确认时停止拆卸。还没有开始拆换。',
 preparationAnswer:'【虚构演示】执行人为演示人员甲，监护复核人为演示人员乙，已在演示工单签认。两个名字都是练习代号；没有真实签认文件上传，不要写成附件已齐全。',
 repairStart:'【虚构演示】16:20—17:05，按获批工单对二缸 ICU 的插头、管路和方向作了标识，拆开的接口及时封堵。二缸总成处置完了，但我还没说清这次具体做了什么。未在船上开展液压活塞内部精修，没有用砂纸打磨，也没有处理燃油供给通路。附图是知识库历史拆检照片，只帮助识别部位，不是这次作业拍的；本轮真实现场照片未上传。',
 repairAnswer:'【虚构演示】这次按获批工单拆换了 ICU 总成，安装演示清单中已核对适配的备用总成和配套接口密封件。原件编号封存后暂存演示旧件区，保管人为演示人员乙，标签 DEMO-OLD-C2-01，准备送厂家认可车间检验，还没有送出也没有检验结论。备用件标签 DEMO-SPARE-C2-01 只是演示代号，不是真实图号或序列号。实际领用按演示清单为 ICU 总成 1 套、配套接口密封件 1 套。没有其他新增换件。',
 repairRevise:'把“更换后正常”这类结论都去掉。这里只记录演示中的拆换措施，复装复核和试验结果在下一步；卡滞的具体原因仍待认可车间检验。历史照片不能列为本轮作业留证。其余记录保留。',
 trial:'【虚构演示】17:10—17:35，依本机作业单完成本次接口、接线、方向及防护复核，由演示人员乙复核；工具和拆下件已清点，按批准程序恢复介质，演示检查范围内未见外漏。17:40—17:50 只在获准的有限工况下做了动作核对，记录的窗口内原流量活塞报警没有再出现。完整的燃油轨压力、二缸指令反馈、六缸排温、转速和负荷对照记录还未补齐，高负荷工况没有覆盖，不能写成全面验收通过。实际力矩及厂家判据未提供，不要补数值；出现泄漏、动作异常或原报警复现应停止接续试验并回报。',
 trialClarify:'【虚构演示】后续试验尚未实施，等待轮机长安排许可窗口；这一步按未完成记录，不把计划写成已执行。',
 handover:'【虚构演示】18:00 已将本轮批准范围、总成和密封件模拟领用、旧件暂存及未送检状态交给演示轮机长。剩余事项是补齐同刻对照记录、在另行许可的工况完成试验，以及取得认可车间检验结论；演示人员甲负责跟进，具体时限待轮机长确认。拟持续关注二缸指令与反馈、各缸排温、燃油轨压力、转速负荷和原报警复现，但尚未开始新的效果观察，也没有证明长期修复有效。本次照片只有历史参考图，真实作业附件未补齐。',
 handoverClarify:'尚未确认，写待轮机长安排，不编截止时间',
}

const notes={
 investigation:'【虚构演示】15:10—15:18，报警片段中二缸指令与反馈有不对应；可接近的 ICU 插接件、反馈线束未见松脱或明显破损，未覆盖线束段未查。许可停机并确认燃油、伺服油隔离卸压后，依作业单检查液压动作，三次发涩、回位不畅，未继续内部拆修。污染、划痕、磨损等原因未确认，尚无认可车间内部检验记录。所述图片为 AI 生成示意样例，不作本轮现场证据。',
 investigationRevised:'【虚构演示】15:10—15:18，报警片段中二缸指令与反馈有不对应；可接近的 ICU 插接件、反馈线束未见松脱或明显破损，未覆盖线束段未查。许可停机并确认燃油、伺服油隔离卸压后，依作业单检查液压动作，三次发涩、回位不畅，未继续内部拆修。具体卡滞原因未确认，不能归因为积碳或磨损，尚无认可车间内部检验记录。所述图片为 AI 生成示意样例，不作本轮现场证据。',
 supply:'【虚构演示】15:25—15:35，核对报警前后供给泵、阀位、滤器状态及允许接近接口，已查范围未见异常。供给、燃油轨压力与启停、六缸响应记录已按同一时间轴对照，当前未见共同供给异常对应片段。未拆检全部滤器或管路，未覆盖高负荷，未更换供给部件。未提供压力数值，不能由已查范围推断整个供给系统正常，也不能据此确认 ICU 根因。',
 preparation:'【虚构演示】DEMO-WO-C2-001 仅批准二缸 ICU 总成拆换及复测，不含供给通路。备用总成、接口密封件适配及检验资料、工具校验已按演示清单核对。16:00—16:15 完成停机、防意外起动、燃油及伺服油隔离卸压并记录核实方法；甲执行、乙监护复核，均为演示代号，演示工单已签认。仅准备完成，尚未拆换；范围或隔离未确认即停。真实图号、序列号、力矩未提供，真实签认附件未上传。',
 repair:'【虚构演示】16:20—17:05，按批准范围标识二缸 ICU 插头、管路和方向，拆开接口及时封堵；按演示清单拆换总成及接口密封件各1套，无其他换件或供给处理。备用件 DEMO-SPARE-C2-01 仅演示代号。原件编号封存于演示旧件区，由乙保管，标签 DEMO-OLD-C2-01；未送认可车间，原因及检验结论未定。船上未作内部精修或砂纸打磨，复装及试验待下一步。所述历史图仅供识别，不作本轮证据。',
 trial:'【虚构演示】17:10—17:35，依作业单复核接口、接线、方向及防护，由乙复核；清点工具及拆下件，按批准程序恢复介质，已查范围未见外漏。17:40—17:50 仅在获准有限工况核对动作，记录窗口内原流量活塞报警未再现。燃油轨压力、二缸指令反馈、六缸排温、转速和负荷的完整同刻记录未补齐，高负荷未覆盖；力矩及厂家判据未提供，不能视为全面验收通过。若泄漏、动作异常或原报警复现，应停止接续试验并回报。',
 trialClarified:'【虚构演示】17:10—17:35，依作业单复核接口、接线、方向及防护，由乙复核；工具及拆下件已清点，按批准程序恢复介质，已查范围未见外漏。17:40—17:50 在获准有限工况核对动作，原流量活塞报警未再现。燃油轨压力、二缸指令反馈、六缸排温、转速负荷同刻记录未齐，高负荷未覆盖；力矩及厂家判据未提供。后续试验未实施，待轮机长许可，本步仍未完成，不能全面验收；泄漏、动作异常或原报警复现即停试回报。',
 handover:'【虚构演示】18:00 已向演示轮机长交接批准范围、总成及密封件模拟领用、旧件暂存和未送检状态。尚需补齐同刻对照记录、另行获准工况试验及认可车间检验结论，由甲跟进，时限待轮机长确认。拟关注二缸指令反馈、各缸排温、燃油轨压力、转速负荷及原报警复现；新一轮效果观察尚未开始，长期修复效果未经证明。照片仅历史参考，真实作业附件未补齐；本步只确认记录交接。',
}

const question=text=>({kind:'question',text})
const draft=(note,text='已整理为本步骤备注草稿，请核对后采用。')=>({kind:'draft',text,note})
const stepLabels={investigation:['核查 C2 ICU 液压机构与反馈','核查燃油供给与瞬态工况'],repair:['作业准备与安全隔离','实施维修与过程记录','复装与分阶段试验','交接与效果观察']}
const rules=[
 {kind:'investigation',step:0,prompt:'investigationStart',reply:question('液压活塞实际动作检查做过了吗，检查结果是什么？')},
 {kind:'investigation',step:0,prompt:'investigationAnswer',requires:['investigationStart'],results:['发现异常','无法确认'],reply:draft(notes.investigation)},
 {kind:'investigation',step:0,prompt:'investigationRevise',requires:['investigationStart','investigationAnswer'],results:['发现异常','无法确认'],reply:draft(notes.investigationRevised,'已保留回位不畅的描述，并明确原因未确认、图片不作本轮证据。')},
 {kind:'investigation',step:1,prompt:'supply',results:['未见异常'],reply:draft(notes.supply)},
 {kind:'investigation',step:1,prompt:'supplyClarify',requires:['supply'],results:['未见异常'],reply:draft(notes.supply,'已保留资料缺口，未补造压力数值。')},
 {kind:'repair',step:0,prompt:'preparationStart',reply:question('隔离由谁执行和复核，是否已有签认记录？')},
 {kind:'repair',step:0,prompt:'preparationAnswer',requires:['preparationStart'],results:['已完成'],reply:draft(notes.preparation)},
 {kind:'repair',step:1,prompt:'repairStart',reply:question('这次总成处置具体是拆换总成、连接修复，还是检查后封存？')},
 {kind:'repair',step:1,prompt:'repairAnswer',requires:['repairStart'],results:['已完成'],reply:draft(notes.repair)},
 {kind:'repair',step:1,prompt:'repairRevise',requires:['repairStart','repairAnswer'],results:['已完成'],reply:draft(notes.repair,'已仅保留拆换措施，复装试验及具体原因仍待后续核实。')},
 {kind:'repair',step:2,prompt:'trial',results:['未完成'],reply:draft(notes.trial)},
 {kind:'repair',step:2,prompt:'trialClarify',requires:['trial'],results:['未完成'],reply:draft(notes.trialClarified,'已明确后续试验尚未实施，保留未完成状态和许可条件。')},
 {kind:'repair',step:3,prompt:'handover',results:['已完成'],reply:draft(notes.handover)},
 {kind:'repair',step:3,prompt:'handoverClarify',requires:['handover'],results:['已完成'],reply:draft(notes.handover,'已保留时限待轮机长确认，不补写截止时间。')},
].map(rule=>({...rule,label:stepLabels[rule.kind][rule.step],normalized:normalizeText(prompts[rule.prompt]),requiredTexts:(rule.requires||[]).map(key=>normalizeText(prompts[key]))}))

// For acceptance scripts and documentation only; not a UI quick-send menu.
// `requires` contains preceding case IDs, in chronological order.
export const STEP_ASSIST_DEMO_CASES=Object.freeze(rules.map(rule=>Object.freeze({id:rule.prompt,kind:rule.kind,stepIndex:rule.step,stepLabel:rule.label,input:prompts[rule.prompt],response:Object.freeze({...rule.reply}),requires:Object.freeze([...(rule.requires||[])])})))

export function matchStepAssistDemo({context,images=[]}={}){
 if(!context||(context.event?.sourceEventId||context.event?.id)!=='real-alarm-0430'||!Number.isInteger(context.stepIndex))return null
 const rule=rules.find(item=>item.kind===context.task?.kind&&item.step===context.stepIndex&&item.normalized===normalizeText(context.message?.text))
 if(!rule)return null
 if(normalizeText(context.step?.label)!==normalizeText(rule.label))return null
 // A differing human result must be handled by the real model as a conflict.
 if(context.record?.result&&rule.results&&!rule.results.includes(context.record.result))return null
 const users=(Array.isArray(context.history)?context.history:[]).filter(message=>message?.role==='user'&&message.stepIndex===context.stepIndex&&(!message.scope||message.scope==='current-step')&&(!message.eventId||message.eventId===context.event.id)&&(!message.taskId||message.taskId===context.task.id)).map(message=>normalizeText(message.text))
 if(rule.requiredTexts.length){
  // Retrying the same script line does not leave rehearsal mode. Preserve any
  // intervening non-script statement so a changed fact still goes to the model.
  while(users.at(-1)===rule.normalized)users.pop()
  const recent=users.filter((text,index)=>index===0||text!==users[index-1]).slice(-rule.requiredTexts.length)
  if(recent.length!==rule.requiredTexts.length||recent.some((text,i)=>text!==rule.requiredTexts[i]))return null
 }
 // Pictures never establish scripted facts. The wording says “所述图片” even
 // with an empty upload list, and never claims an image has been received.
 void images
 return {...rule.reply}
}
