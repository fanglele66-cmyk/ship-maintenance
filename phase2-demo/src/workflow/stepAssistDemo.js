import {taskAssistantOpeningReply} from './taskAssistantOpening.js'
import {isStepAssistEvent} from './stepAssistContract.js'
import {OTHER_STEP_ASSIST_CASES} from './stepAssistScenarios.js'
// Exact opt-in script lines. Image content never supplies scripted facts.
const normalizeText=value=>typeof value==='string'?value.normalize('NFKC').replace(/[【]/g,'[').replace(/[】]/g,']').replace(/[“”]/g,'"').replace(/[‘’]/g,"'").replace(/[，、]/g,',').replace(/[。]/g,'.').replace(/[—–−]/g,'-').replace(/\s+/gu,'').replace(/[.!?]+$/u,'').trim():''

const prompts={
 investigationStart:"二缸这边插头和能检查的反馈线束看了，没看到松脱或明显破损。对照报警片段，指令和反馈有一段没对应上。光看这些，还不好判断液压执行有没有问题。",
 investigationAnswer:"做过。15:10—15:18，按许可停机，确认燃油、伺服油都隔离卸压后，照本机作业单检查了液压活塞动作，三次都发涩、回位不畅，没再往里面拆。插头和线束只看了能接近的部分，其他线束段没查。认可车间的内部检验记录还没有，污染、划痕还是磨损，现在都没确定。",
 investigationRevise:"原因这块还没定，只能确认动作回位不畅，积碳还是磨损现在都说不准。其他记录保留。",
 supply:"15:25—15:35，供给泵、阀位、滤器状态和能接近的接口都看了，这些位置没发现异常。供给和燃油轨压力记录也跟启停、六缸响应按同一时间轴对过，暂时没看到共同供给异常的对应片段。没有拆检全部滤器和管路，高负荷也没查到，供给部件没换。具体压力数值还没提供。",
 supplyClarify:"具体数值暂时没有，材料还没补上。",
 preparationStart:"这次按工单 WO-C2-001，只拆换二缸 ICU 总成并复测，不动供给通路。备用总成和接口密封件的机型、接口、标识、检验资料都按清单核对了，工具校验资料也看过，图号、序列号和力矩值还没提供。16:00—16:15，停机、防意外起动、燃油和伺服油分别隔离卸压都做了，现场核实方法也记了。范围和隔离没确认就先停，还没开始拆换。",
 preparationAnswer:"李建国执行，陈志远监护复核，工单上都签了。签认文件还没上传。",
 repairStart:"16:20—17:05，按获批工单把二缸 ICU 的插头、管路和方向标好了，拆开的接口也及时封堵了。二缸总成已经处理过了。船上没做液压活塞内部精修，没用砂纸，也没处理燃油供给通路。这次的作业照片还没上传。",
 repairAnswer:"这次按获批工单换了 ICU 总成，备用总成和配套接口密封件都在清单里核对过适配。旧件编号封存，暂放旧件区，陈志远保管，标签 OLD-C2-01，准备送厂家认可车间，还没送出去，也没有检验结论。备用件标签是 SPARE-C2-01，不是图号或序列号。清单上实际领了总成 1 套、接口密封件 1 套，没再换其他件。",
 repairRevise:"先别写更换后正常，这一步只记拆换措施。复装复核和试验在下一步，卡滞原因还要等认可车间检验。其他记录保留。",
 trial:"17:10—17:35，照作业单复核了接口、接线、方向和防护，陈志远复核，工具和拆下件也清点了。按批准程序恢复介质后，检查范围内没看到外漏。17:40—17:50，只在获准的有限工况下核对了动作，这段时间原流量活塞报警没再出现。燃油轨压力、二缸指令反馈、六缸排温、转速和负荷的完整对照记录还没齐，高负荷没覆盖，力矩和厂家判据也没提供，还不能全面验收。再有泄漏、动作异常或原报警，就停下后续试验并回报。",
 trialClarify:"后续试验还没做，等轮机长安排许可窗口。这一步还是未完成。",
 handover:"18:00，批准范围、总成和密封件领用、旧件暂存和未送检的情况都交给轮机长了。还差同刻对照记录、另行许可工况下的试验和认可车间检验结论，李建国跟进，时限等轮机长确认。接下来打算关注二缸指令反馈、各缸排温、燃油轨压力、转速负荷和原报警，但新的效果观察还没开始，长期效果也没验证，作业附件还没齐。",
 handoverClarify:"时间还没定，等轮机长安排。",
}

// Previously published lines keep their original identifiers, people and facts.
const publishedPrompts={
 investigationStart:"二缸这边插头和能检查的反馈线束看了，没看到松脱或明显破损。对照报警片段，指令和反馈有一段没对应上。现在还不能从这两项判断液压执行到底有没有异常，我还没把液压动作检查情况说清楚。",
 investigationAnswer:"做过动作检查。检查时段是 15:10—15:18，按许可停机并确认燃油、伺服油隔离卸压后，按本机作业单核对液压活塞动作，三次均发涩、回位不畅，没有继续内部拆修。插接件和线束只看了可接近部位，未覆盖的线束段没有检查。没有取得厂家认可车间的内部检验记录，污染、划痕和磨损原因都还没确认。",
 investigationRevise:"再强调一下：只是液压动作回位不畅，具体卡滞原因还没确认，不能写成积碳或磨损导致。其余内容保留。",
 supply:"15:25—15:35，核对了报警前后供给泵运行、阀位、滤器状态和允许接近的接口；检查的这些位置没有发现异常。供给和燃油轨压力记录已按同一时间轴与启停、六缸响应作对照，当前没有发现共同供给异常的对应片段。没有拆检全部滤器或管路；高负荷工况也没覆盖。没有做供给部件更换。请只整理这些已描述的事实，不补压力数字。",
 supplyClarify:"材料未提供，不补造数值，备注保留资料缺口",
 preparationStart:"工单 WO-C2-001 的实施范围只包括二缸 ICU 总成拆换和后续复测，不处理供给通路。备用总成与接口密封件的机型、接口、标识和检验资料已按清单核对，工具校验资料也查过；图号、序列号和力矩值未提供，不要补填。16:00—16:15 完成停机、防意外起动、燃油与伺服油分别隔离卸压，并记录现场核实方法。范围不清或隔离未确认时停止拆卸。还没有开始拆换。",
 preparationAnswer:"执行人为李建国，监护复核人为陈志远，已在工单签认。签认文件还没有上传，不要写成附件已齐全。",
 repairStart:"16:20—17:05，按获批工单对二缸 ICU 的插头、管路和方向作了标识，拆开的接口及时封堵。二缸总成处置完了，但我还没说清这次具体做了什么。未在船上开展液压活塞内部精修，没有用砂纸打磨，也没有处理燃油供给通路。本轮作业照片未上传。",
 repairAnswer:"这次按获批工单拆换了 ICU 总成，安装清单中已核对适配的备用总成和配套接口密封件。原件编号封存后暂存旧件区，保管人为陈志远，标签 OLD-C2-01，准备送厂家认可车间检验，还没有送出也没有检验结论。备用件标签 SPARE-C2-01 不是图号或序列号。实际领用按清单为 ICU 总成 1 套、配套接口密封件 1 套。没有其他新增换件。",
 repairRevise:"把“更换后正常”这类结论都去掉。这里只记录拆换措施，复装复核和试验结果在下一步；卡滞的具体原因仍待认可车间检验。其余记录保留。",
 trial:"17:10—17:35，依本机作业单完成本次接口、接线、方向及防护复核，由陈志远复核；工具和拆下件已清点，按批准程序恢复介质，检查范围内未见外漏。17:40—17:50 只在获准的有限工况下做了动作核对，记录的窗口内原流量活塞报警没有再出现。完整的燃油轨压力、二缸指令反馈、六缸排温、转速和负荷对照记录还未补齐，高负荷工况没有覆盖，不能写成全面验收通过。实际力矩及厂家判据未提供，不要补数值；出现泄漏、动作异常或原报警复现应停止接续试验并回报。",
 trialClarify:"后续试验尚未实施，等待轮机长安排许可窗口；这一步按未完成记录，不把计划写成已执行。",
 handover:"18:00 已将本轮批准范围、总成和密封件领用、旧件暂存及未送检状态交给轮机长。剩余事项是补齐同刻对照记录、在另行许可的工况完成试验，以及取得认可车间检验结论；李建国负责跟进，具体时限待轮机长确认。拟持续关注二缸指令与反馈、各缸排温、燃油轨压力、转速负荷和原报警复现，但尚未开始新的效果观察，也没有证明长期修复有效。本轮作业附件未补齐。",
 handoverClarify:"尚未确认，写待轮机长安排，不编截止时间",
}

const notes={
 investigation:"15:10—15:18，报警片段中二缸指令与反馈有不对应；可接近的 ICU 插接件、反馈线束未见松脱或明显破损，未覆盖线束段未查。许可停机并确认燃油、伺服油隔离卸压后，依作业单检查液压动作，三次发涩、回位不畅，未继续内部拆修。污染、划痕、磨损等原因未确认，尚无认可车间内部检验记录。",
 investigationRevised:"15:10—15:18，报警片段中二缸指令与反馈有不对应；可接近的 ICU 插接件、反馈线束未见松脱或明显破损，未覆盖线束段未查。许可停机并确认燃油、伺服油隔离卸压后，依作业单检查液压动作，三次发涩、回位不畅，未继续内部拆修。具体卡滞原因未确认，不能归因为积碳或磨损，尚无认可车间内部检验记录。",
 supply:"15:25—15:35，核对报警前后供给泵、阀位、滤器状态及允许接近接口，已查范围未见异常。供给、燃油轨压力与启停、六缸响应记录已按同一时间轴对照，当前未见共同供给异常对应片段。未拆检全部滤器或管路，未覆盖高负荷，未更换供给部件。未提供压力数值，不能由已查范围推断整个供给系统正常，也不能据此确认 ICU 根因。",
 preparation:"WO-C2-001 仅批准二缸 ICU 总成拆换及复测，不含供给通路。备用总成、接口密封件适配及检验资料、工具校验已按清单核对。16:00—16:15 完成停机、防意外起动、燃油及伺服油隔离卸压并记录核实方法；李建国执行、陈志远监护复核，工单已签认。尚未拆换；范围或隔离未确认即停。图号、序列号、力矩未提供，签认附件未上传。",
 repair:"16:20—17:05，按批准范围标识二缸 ICU 插头、管路和方向，拆开接口及时封堵；拆换总成及接口密封件各1套，无其他换件或供给处理。备用件标签 SPARE-C2-01 不代替图号、序列号。原件编号封存于旧件区，由陈志远保管，标签 OLD-C2-01；尚未送检，具体原因待认可车间检验。船上未作内部精修或砂纸打磨，复装及试验待下一步，作业照片待补。",
 trial:"17:10—17:35，依作业单复核接口、接线、方向及防护，由陈志远复核；清点工具及拆下件，按批准程序恢复介质，已查范围未见外漏。17:40—17:50 仅在获准有限工况核对动作，记录窗口内原流量活塞报警未再现。燃油轨压力、二缸指令反馈、六缸排温、转速和负荷的完整同刻记录未齐，高负荷未覆盖；力矩及厂家判据未提供，不能全面验收。若泄漏、动作异常或原报警复现，应停试回报。",
 trialClarified:"17:10—17:35，依作业单复核接口、接线、方向及防护，由陈志远复核；工具及拆下件已清点，按批准程序恢复介质，已查范围未见外漏。17:40—17:50 在获准有限工况核对动作，原流量活塞报警未再现。同刻燃油轨压力、二缸指令反馈、六缸排温、转速负荷记录未齐，高负荷未覆盖；力矩及厂家判据未提供。后续试验未实施，待轮机长许可，本步仍未完成；泄漏、动作异常或原报警复现即停试回报。",
 handover:"18:00 已向轮机长交接批准范围、总成及密封件领用、旧件暂存和未送检状态。尚需补齐同刻对照记录、另行获准工况试验及认可车间检验结论，由李建国跟进，时限待轮机长确认。拟关注二缸指令反馈、各缸排温、燃油轨压力、转速负荷及原报警复现；新一轮效果观察尚未开始，长期修复效果未经证明。本轮作业附件未补齐；本步只确认记录交接。",
}

const question=text=>({kind:'question',text})
const draft=(note,text='整理好了，核对后可以采用。')=>({kind:'draft',text,note})
const stepLabels={investigation:['核查 C2 ICU 液压机构与反馈','核查燃油供给与瞬态工况'],repair:['作业准备与安全隔离','实施维修与过程记录','复装与分阶段试验','交接与效果观察']}
const rules=[
 {kind:'investigation',step:0,prompt:'investigationStart',reply:question('液压活塞动作检查做了吗，结果怎么样？')},
 {kind:'investigation',step:0,prompt:'investigationAnswer',requires:['investigationStart'],results:['发现异常','无法确认'],reply:draft(notes.investigation)},
 {kind:'investigation',step:0,prompt:'investigationRevise',requires:['investigationStart','investigationAnswer'],results:['发现异常','无法确认'],reply:draft(notes.investigationRevised,'已保留回位不畅，原因仍待确认。')},
 {kind:'investigation',step:1,prompt:'supply',results:['未见异常'],reply:draft(notes.supply)},
 {kind:'investigation',step:1,prompt:'supplyClarify',requires:['supply'],results:['未见异常'],reply:draft(notes.supply,'数值和材料缺口已保留。')},
 {kind:'repair',step:0,prompt:'preparationStart',reply:question('谁执行隔离、谁复核，工单签认了吗？')},
 {kind:'repair',step:0,prompt:'preparationAnswer',requires:['preparationStart'],results:['已完成'],reply:draft(notes.preparation)},
 {kind:'repair',step:1,prompt:'repairStart',reply:question('总成这次具体怎么处理的，拆换了还是做了连接修复？')},
 {kind:'repair',step:1,prompt:'repairAnswer',requires:['repairStart'],results:['已完成'],reply:draft(notes.repair)},
 {kind:'repair',step:1,prompt:'repairRevise',requires:['repairStart','repairAnswer'],results:['已完成'],reply:draft(notes.repair,'已只记拆换措施，复装试验和原因仍待核实。')},
 {kind:'repair',step:2,prompt:'trial',results:['未完成'],reply:draft(notes.trial)},
 {kind:'repair',step:2,prompt:'trialClarify',requires:['trial'],results:['未完成'],reply:draft(notes.trialClarified,'已记下后续试验未做，等待许可窗口。')},
 {kind:'repair',step:3,prompt:'handover',results:['已完成'],reply:draft(notes.handover)},
 {kind:'repair',step:3,prompt:'handoverClarify',requires:['handover'],results:['已完成'],reply:draft(notes.handover,'时限仍记为待轮机长确认。')},
].map(rule=>({...rule,label:stepLabels[rule.kind][rule.step]}))

const missingQuestions={
 investigationStart:'插头、线束检查和报警时的指令反馈核对，结果分别怎么样？',
 investigationAnswer:'液压活塞动作检查做了吗，什么时段、结果怎样？',
 supply:'供给通路实际查了哪些位置和工况，结果怎么样？',
 preparationStart:'这次工单范围是什么，备件核对和停机隔离完成了吗？',
 repairStart:'这次连接标识、接口封堵和船上检查，实际做了哪些？',
 repairAnswer:'总成具体怎么处理的，用了哪些件，旧件现在在哪里？',
 trial:'复装和试验实际做到了哪一步，还有哪些没完成？',
 handover:'已经交接了哪些情况，还有哪些事项要跟进？',
}
const allRules=[...rules.map(rule=>({...rule,eventId:'real-alarm-0430'})),...OTHER_STEP_ASSIST_CASES.map(item=>({eventId:item.eventId,kind:item.kind,step:item.stepIndex,label:item.stepLabel,prompt:item.id,requires:item.requires,results:item.results,reply:item.response}))]
const inputRules=new Map()
for(const rule of allRules.filter(item=>item.eventId==='real-alarm-0430')){
 inputRules.set(normalizeText(prompts[rule.prompt]),rule)
 inputRules.set(normalizeText(publishedPrompts[rule.prompt]),rule)
}
for(const item of OTHER_STEP_ASSIST_CASES)inputRules.set(normalizeText(item.input),allRules.find(rule=>rule.prompt===item.id))
// Only these known presentation-only wrappers may surround a complete line.
// Different identifiers, people, numbers or added facts are never normalized away.
const legacyPrefix=normalizeText('【虚构演示】')
const legacyImageSuffix=normalizeText('这张是 AI 生成的演示图，只练习上传，不是现场照片，不能拿它认定卡滞或损伤。')
function ruleForText(text){
 const original=normalizeText(text)
 if(inputRules.has(original))return inputRules.get(original)
 let candidate=original.startsWith(legacyPrefix)?original.slice(legacyPrefix.length):original
 if(candidate.endsWith(legacyImageSuffix))candidate=candidate.slice(0,-legacyImageSuffix.length).replace(/[.!?]+$/u,'')
 return inputRules.get(candidate)
}
function scopedRule({event,task,stepIndex,text,step}={}){
 if(!isStepAssistEvent(event)||!Number.isInteger(stepIndex))return null
 const rule=ruleForText(text)
 if(!rule||rule.eventId!==(event.sourceEventId||event.id)||rule.kind!==task?.kind||rule.step!==stepIndex)return null
 return normalizeText((step||task?.steps?.[stepIndex])?.label)===normalizeText(rule.label)?rule:null
}

// UI recognition only. Execution permission, current-step checks and validation
// remain the responsibility of the UI/store and server request contract.
export function isStepAssistScriptInput({event,task,stepIndex,text}={}){
 return !!scopedRule({event,task,stepIndex,text})
}

// For acceptance scripts and documentation only; not a UI quick-send menu.
export const STEP_ASSIST_DEMO_CASES=Object.freeze(rules.map(rule=>Object.freeze({id:rule.prompt,kind:rule.kind,stepIndex:rule.step,stepLabel:rule.label,input:prompts[rule.prompt],aliases:Object.freeze([publishedPrompts[rule.prompt]]),response:Object.freeze({...rule.reply}),requires:Object.freeze([...(rule.requires||[])])})))
const acknowledgments=new Set(['谢谢','谢谢你','多谢','好的','好','收到','明白','明白了','了解','了解了','知道了','辛苦了','嗯','好，继续','请继续','继续','好的，谢谢','好的，收到','谢谢，先这样','谢谢，辛苦了','谢谢你，辛苦了'].map(normalizeText))

export function matchStepAssistDemo({context,images=[]}={}){
 if(!context)return null
 const opening=isStepAssistEvent(context.event)&&taskAssistantOpeningReply(context.task,context.message?.text)
 if(opening)return opening
 let rule=scopedRule({...context,text:context.message?.text})
 if(!rule)return null
 const currentPrompt=rule.prompt
 const users=(Array.isArray(context.history)?context.history:[]).filter(message=>message?.role==='user'&&message.stepIndex===context.stepIndex&&(!message.scope||message.scope==='current-step')&&(!message.eventId||message.eventId===context.event.id)&&(!message.taskId||message.taskId===context.task.id))
 const prior=new Set()
 for(const message of users){
  if(taskAssistantOpeningReply(context.task,message.text))continue
  if(acknowledgments.has(normalizeText(message.text)))continue
  const previous=scopedRule({...context,text:message.text})
  // Never overwrite an intervening correction with an old fixed draft. A fresh
  // free-form clarification can be handled by the model with the full history.
  if(!previous)return question('前面还有新的补充，和这段记录是否一致？请确认本步实际情况。')
  prior.add(previous.prompt)
 }
 // Complete facts can arrive in either order. Preserve later optional
 // clarifications when a user repeats an earlier line from the same step.
 prior.add(currentPrompt)
 const complete=allRules.filter(candidate=>candidate.eventId===rule.eventId&&candidate.kind===rule.kind&&candidate.step===rule.step&&candidate.reply.kind==='draft'&&prior.has(candidate.prompt)&&(candidate.requires||[]).every(id=>prior.has(id)))
 if(complete.length)rule=complete.at(-1)
 // A known line never falls through to a model just because its result or
 // prerequisites are missing. Ask without modifying the selected result.
 if(context.record?.result&&rule.results&&!rule.results.includes(context.record.result)){
  return question('当前选择“'+context.record.result+'”与这段记录不一致，哪项需要调整？')
 }
 const missing=(rule.requires||[]).find(id=>!prior.has(id))
 if(missing)return question(missingQuestions[missing]||OTHER_STEP_ASSIST_CASES.find(item=>item.id===missing)?.missingQuestion||'请先补充本步实际检查范围和结果。')
 // Known optional lines and retries are harmless; another main step is ignored.
 // Pictures never establish scripted facts or imply a current work photo exists.
 void images
 return {...rule.reply}
}
