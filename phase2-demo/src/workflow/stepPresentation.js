const targets=[[/二缸|C2|ICU/,'二缸液压机构'],[/反馈|线束|插接/,'指令与反馈'],[/燃油|轨压/,'燃油供给'],[/减压阀/,'空气减压阀'],[/空气过滤器|供气过滤器/,'空气过滤器'],[/空气瓶/,'空气瓶'],[/管路|接头|排水阀/,'供气管路'],[/测温|探头/,'排温测点'],[/喷油器/,'喷油器'],[/排气阀/,'排气阀'],[/冷却/,'冷却系统'],[/Pmax|燃烧|热平衡/,'燃烧平衡'],[/隔离|卸压/,'停机隔离'],[/复测|试验/,'复测验证']]
export function taskFocusTags(plan){
 const steps=plan?.steps||[]
 const text=steps.length?steps.flatMap(s=>[s.label,s.guide,...(s.substeps||[]).flatMap(c=>[c.label,c.guide])]).join(' '):plan?.scope||''
 const matches=targets.filter(([re])=>re.test(text)).map(([,label])=>label)
 return matches.length?matches.slice(0,4):(plan?.steps||[]).map(s=>s.short||s.label.replace(/^(核查|核对|检查|确认|处理)/,'').slice(0,10)).slice(0,4)
}
export function recordGuidance(text='记录实际结果、检查方法与未确认项。'){
 const match=String(text).match(/(?:[；。]\s*)(?=(?:未能|未检查|无法|未获|缺少|缺乏|没有|尚未|发现异常|区分|不能|不以|不将|不应))/)
 if(!match)return {brief:text,help:''}
 const at=match.index
 return {brief:text.slice(0,at)+'。',help:text.slice(at+match[0].length)}
}
