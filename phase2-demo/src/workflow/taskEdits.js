const clone=value=>JSON.parse(JSON.stringify(value))
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b)
const fail=message=>{throw Error(message+' 原待派任务未修改。')}
const numberValue=text=>{
 if(/^\d+$/.test(text))return Number(text)
 const digits={零:0,一:1,二:2,两:2,三:3,四:4,五:5,六:6,七:7,八:8,九:9}
 if(text.includes('十')){const [a,b]=text.split('十');return (a?digits[a]:1)*10+(b?digits[b]:0)}
 return digits[text]
}
const numberPattern='[0-9一二三四五六七八九十两]+'
const labelKey=text=>text.replace(/[\s“”"「」『』《》：:，,。；;、（）()]/g,'').replace(/^(检查|核查|核对|排查)/,'').replace(/(排查任务|维修任务|任务|步骤|排查)$/,'')

function references(clause,steps){
 const indices=[]
 const pattern=new RegExp(`第?(${numberPattern}(?:[、和及与]第?${numberPattern})*)[项条步个](?:排查|维修|复查|维保)?(?:任务|步骤)?`,'g')
 for(const match of clause.matchAll(pattern))for(const part of match[1].split(/[、和及与]/))indices.push(numberValue(part.replace(/^第/,''))-1)
 const first=clause.match(new RegExp(`前(${numberPattern})[项条步个]`))
 if(first){indices.length=0;const n=numberValue(first[1]);if(n>steps.length)fail(`当前只有 ${steps.length} 项，无法保留前 ${n} 项。`);for(let i=0;i<n;i++)indices.push(i)}
 if(/最后(?:一)?[项条步个]/.test(clause))indices.push(steps.length-1)
 if(!indices.length){
  const query=labelKey(clause.replace(/^(?:请|帮我|把|将|仅|只|保留|留下|删除|删掉|去掉|移除|取消|去除|修改|调整|更新|完善|细化|补充)+/, '').replace(/(?:即可|就好|就行|不变|原样|保持原样|其他不变|其余不变)$/,''))
  steps.forEach((step,i)=>{const label=labelKey(step.label);if(query.length>=4&&(query.includes(label)||label.includes(query)))indices.push(i)})
  if(indices.length>1)fail('这个标题对应多项任务，请用编号明确指定。')
 }
 const unique=[...new Set(indices)]
 if(unique.some(i=>!Number.isInteger(i)||i<0||i>=steps.length))fail(`任务编号超出范围，当前只有 ${steps.length} 项。`)
 return unique
}

export function taskEditContract(plan,text){
 if(!Array.isArray(plan?.steps)||!plan.steps.length)fail('尚无可修改的任务步骤。')
 const clauses=text.trim().replace(/[！？!?]/g,'。').split(/[，,。；;\n]|并且|然后|同时|并(?=删除|保留|只保留|仅保留|增加|修改|补充|去掉)|(?=仅保留|只保留)/).map(s=>s.trim()).filter(Boolean)
 const remove=[],keep=[],only=[],update=[]
 let structural=false,otherEdit=false
 const insertionClauses=clauses.filter(clause=>!/(?:不(?:要|用|必|再|需要)?|无需|禁止|避免|别|勿)\s*(?:再)?(?:新增|添加|增加|补充|加)/.test(clause)&&/(新增|添加|增加|补充).{0,16}(一项|两项|\d+项|步骤|任务)|加一项/.test(clause))
 const canInsert=insertionClauses.length>0
 const canUpdate=/修改|调整|改为|改成|完善|细化|更新|限制|补充/.test(text)||/增加/.test(text)&&!canInsert
 for(const clause of clauses){
  const deleting=/删除|删掉|去掉|移除|取消|去除/.test(clause)
  const retaining=/保留|留下/.test(clause)
  if(deleting||retaining){
   if(/子步骤|子项|检查点|检查要求|里面|中的/.test(clause))fail('请明确要修改的任务及子项，不能将子项的增删解释为删除整项任务。')
   if(/如果|若|假如|是否|不要|不删|不需要删|别删|先不|暂不/.test(clause))fail('这条增删要求包含条件或否定，请明确当前要保留或删除的任务编号。')
   const refs=references(clause,plan.steps)
   if(!refs.length)fail('未能唯一确定要保留或删除的任务，请使用当前任务编号或完整标题。')
   if(deleting){remove.push(...refs);structural=true}
   if(retaining){keep.push(...refs);if(/仅|只/.test(clause)){only.push(...refs);structural=true}}
   if(/修改|调整|补充|完善|更新/.test(clause))update.push(...refs)
  }else if(/其他.*不变|其余.*不变|保持原样|不拆分|不要拆分|不要扩展|(?:不(?:要|用|必|再|需要)?|无需|禁止|避免|别|勿)\s*(?:再)?(?:新增|添加|增加|补充)/.test(clause)){
   // Preservation clauses constrain edits; they are not extra work instructions.
  }else{
   otherEdit=true
   if(!insertionClauses.includes(clause)&&!new RegExp(`^(?:共|总共|总计|缩减为|合并为|控制在|改成|改为)\\s*${numberPattern}\\s*[项条步个]`).test(clause))update.push(...references(clause,plan.steps))
  }
 }
 if(remove.some(i=>keep.includes(i)))fail('同一项同时被要求删除和保留，请明确要保留的任务。')
 const kept=plan.steps.map((_,i)=>i).filter(i=>!remove.includes(i)&&(!only.length||only.includes(i)))
 if(!kept.length)fail('不能删除全部待派任务；如需结束事件，请使用处置决定。')
 const count=text.match(new RegExp(String.raw`(?:共|总共|总计|缩减为|合并为|控制在|改成|改为)\s*(${numberPattern})\s*[项条步个]`))
 const insertion=insertionClauses.join('；').match(new RegExp(String.raw`(?:新增|增加|添加|补充|加)\s*(${numberPattern})\s*[项个](?:任务|步骤)?`))
 const fieldTargets=[['recordHint',/回交要求|提交记录|反馈要求|记录要求/],['label',/标题|任务名称|步骤名称/],['guide',/步骤说明|操作说明|实施方法/],['checks',/检查要求|检查要点/]].filter(([,pattern])=>pattern.test(text)).map(([field])=>field)
 const expectedCount=count?numberValue(count[1]):canInsert&&insertion?kept.length+numberValue(insertion[1]):!canInsert&&(only.length||remove.length)?kept.length:undefined
 if(expectedCount!==undefined&&(!Number.isInteger(expectedCount)||expectedCount<1||expectedCount>4))fail('目标任务数量必须为 1—4 项。')
 if((only.length||remove.length)&&expectedCount!==kept.length&&!canInsert)fail('任务数量要求与保留、删除的编号不一致。')
 return {mode:structural&&!otherEdit&&!canInsert&&!canUpdate?'selection':'patch',remove:[...new Set(remove)],keepOnly:only.length?kept:null,protected:[...new Set(keep)],updateTargets:[...new Set(update)],fieldTargets,canInsert,canRemove:remove.length>0||only.length>0||/合并|拆分/.test(text),canUpdate:canUpdate||!structural&&!canInsert,expectedCount,kept}
}

const describe=(before,after)=>`任务由 ${before.steps.length} 项调整为 ${after.steps.length} 项，当前为：${after.steps.map((s,i)=>`${i+1}. ${s.label}`).join('；')}。`
const scopeOf=steps=>`本轮任务范围：${steps.map(s=>s.label).join('；')}。具体检查方法与回交要求按各项说明执行。`
export function selectTaskSteps(before,contract){
 const steps=contract.kept.map(i=>clone(before.steps[i]))
 if(steps.length>4)fail('修改后的任务仍超过 4 项，请明确需要保留的任务编号。')
 const result={scope:scopeOf(steps),rationale:`按轮机长的明确要求保留原第 ${contract.kept.map(i=>i+1).join('、')} 项；保留项的内容、检查要求和回交要求未改写，未新增或拆分任务。`,steps}
 return {plan:result,editSummary:describe(before,result)}
}

function validateFields(fields,{partial=false}={}){
 const permitted=['label','guide','checks','recordHint'],limits={label:120,guide:1800,recordHint:16000}
 if(!fields||typeof fields!=='object'||Array.isArray(fields)||Object.keys(fields).some(k=>!permitted.includes(k)))fail('任务修改包含不允许变更的字段。')
 if(!partial&&permitted.some(k=>!Object.hasOwn(fields,k)))fail('新增任务步骤不完整。')
 if(!Object.keys(fields).length)fail('任务修改未包含实际变更。')
 for(const [key,value] of Object.entries(fields)){
  if(key==='checks'){if(!Array.isArray(value)||!value.length||value.length>6||value.some(v=>typeof v!=='string'||v.trim().length<2||v.length>1200))fail('任务检查要求不完整。')}
  else if(typeof value!=='string'||value.trim().length<2||value.length>limits[key])fail('任务修改字段不完整。')
 }
 return clone(fields)
}

// Indices always refer to the original displayed list, never a shrinking list.
export function applyTaskEditOperations(before,contract,operations,action){
 if(!Array.isArray(operations)||!operations.length||operations.length>24)fail('模型未返回有效的逐项修改操作。')
 const updated=new Map(),removed=new Set(),inserted=new Map(),touched=new Set()
 for(const op of operations){
  if(!op||!['update','remove','insert'].includes(op.type))fail('模型尝试整体重写、拆分或使用不支持的修改操作。')
  if(op.type==='insert'){
   if(!contract.canInsert)fail('您的要求没有新增任务，模型返回的新增内容已拦截。')
   if(!Number.isInteger(op.after)||op.after<0||op.after>before.steps.length)fail('新增任务的位置无效。')
   const step=validateFields(op.step),options=['investigate','recheck'].includes(action)?['发现异常','未见异常','无法确认']:['已完成','未完成','不适用']
   const list=inserted.get(op.after)||[];list.push({...step,options});inserted.set(op.after,list);continue
  }
  const index=op.step-1
  if(!Number.isInteger(op.step)||index<0||index>=before.steps.length)fail('模型修改了不存在的任务编号。')
  const target=`${index}:${op.substep??'root'}`
  if(touched.has(target)||removed.has(index)||op.type==='remove'&&updated.has(index))fail('模型对同一任务返回了重复或冲突操作。')
  touched.add(target)
  if(op.type==='remove'){
   if(!contract.canRemove||contract.protected.includes(index)||contract.remove.length&&!contract.remove.includes(index)&&!contract.keepOnly)fail('模型删除了未获指示删除的任务。')
   if(contract.keepOnly?.includes(index))fail('模型删除了明确要求保留的任务。')
   if(op.substep!==undefined)fail('删除子项不能通过删除整项任务执行。')
   removed.add(index)
  }else{
   if(!contract.canUpdate||contract.updateTargets.length&&!contract.updateTargets.includes(index))fail('模型改写了未获指示修改的任务。')
   const changes=validateFields(op.changes,{partial:true})
   if(contract.fieldTargets.length&&Object.keys(changes).some(key=>!contract.fieldTargets.includes(key)))fail('模型改写了本次要求之外的任务字段。')
   const step=updated.get(index)||clone(before.steps[index])
   if(op.substep!==undefined){
    if(!Number.isInteger(op.substep)||op.substep<1||op.substep>(step.substeps?.length||0))fail('模型修改了不存在的任务子项。')
    step.substeps[op.substep-1]={...step.substeps[op.substep-1],...changes}
   }else Object.assign(step,changes)
   updated.set(index,step)
  }
 }
 for(const i of contract.remove)if(!removed.has(i))fail(`模型没有删除您指定的原第 ${i+1} 项。`)
 if(contract.canInsert&&!inserted.size)fail('模型没有添加您要求新增的任务。')
 if(contract.keepOnly)for(let i=0;i<before.steps.length;i++)if(!contract.keepOnly.includes(i)&&!removed.has(i))fail('模型仍保留了要求删除的任务。')
 const steps=[...(inserted.get(0)||[])]
 before.steps.forEach((step,i)=>{if(!removed.has(i))steps.push(updated.get(i)||clone(step));steps.push(...(inserted.get(i+1)||[]))})
 if(!steps.length||steps.length>4)fail('修改后的任务数量超出 1—4 项范围。')
 if(contract.expectedCount!==undefined&&steps.length!==contract.expectedCount)fail(`您的要求是 ${contract.expectedCount} 项，模型结果不符合数量约束。`)
 if(same(steps,before.steps))fail('模型没有产生符合要求的实际修改。')
 if(contract.mode==='selection'){
  const expected=selectTaskSteps(before,contract)
  if(!same(steps,expected.plan.steps))fail('模型未按指定编号准确保留原任务。')
  return {...expected,editOperations:clone(operations),source:'model'}
 }
 const plan={scope:scopeOf(steps),rationale:'依据轮机长本次要求逐项修改；未涉及的任务保持原内容与顺序。',steps}
 return {plan,editOperations:clone(operations),editSummary:describe(before,plan),source:'model'}
}

export function verifyTaskEdit(before,text,result,action){
 const contract=taskEditContract(before,text),expected=applyTaskEditOperations(before,contract,result.editOperations,action)
 if(!same(result.plan,expected.plan))fail('生成结果未满足逐项修改约束，已拦截任务覆盖。')
 return expected
}
