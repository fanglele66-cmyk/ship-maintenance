// Keep only confirmed directions. Preparation and restoration are shared once,
// rather than repeating a full repair sequence for every selected cause.
const instructions={
 icv:{label:'处理二缸 ICU 控制与液压执行异常',shortLabel:'ICU 处置',guide:'检查二缸喷射控制单元（ICU）的插接件、反馈线束和伺服油液压活塞；按本轮定位清洁精密偶件或修复连接，检验确认无法恢复且获批时更换适配件。',checks:['对照喷射控制阀（ICV）指令、流量活塞反馈，检查插头接触、线束及液压活塞动作，记录具体卡滞、污染或损伤部位。','液压活塞及配合孔按本机维修作业单用认可清洁剂清洁，不打磨配合面；连接损伤单独修复，活塞或总成无法恢复时提交检验记录和更换申请。','获批后按图册核对 ICU 总成或连接件，恢复接口密封、接线和管路；记录旧新件、实际领用及复核人，保留未处理方向。']},
 supply:{label:'处理已定位的燃油供给问题',shortLabel:'供给处置',guide:'在已定位的滤器、阀件或接口范围内处理供给异常。',checks:['对齐供给压力、燃油轨压力及阀位，确认本轮异常供给段；仅有时序线索时先补测，不能直接拆换全部通路。','隔离卸压后按维修作业单检查滤器，可恢复件清洁，不可恢复且获批的滤芯或密封件再更换。','复装已处理接口并恢复批准配置，记录实际材料和未检查通路；供给处理不自动包含二缸 ICU 更换。']},
 regulator:{label:'处理减压阀密封与调压异常',shortLabel:'减压阀处置',guide:'检查待检空气减压阀的阀芯、阀座、密封垫和调压弹簧，清理确认的污物；密封件损伤或阀组无法恢复时，再按检验和批准结果换件。',checks:['按维修作业单检查阀芯、阀座、密封垫、弹簧与调压机构，保留老化、污染或卡滞部位照片。','清洁阀芯、阀座和内部杂质后复核配合面及回位；密封件损伤获批后更换配套密封，调压机构或阀体无法恢复且获批时更换适配 HRD-FA 总成。','按维修作业单复装；仅获准临时恢复时，登记材料、使用限制及正式备件需求，不以不明材料替代配套密封件。']},
 air:{label:'处理控制空气通路问题',shortLabel:'通路处置',guide:'按分段压力与查漏定位结果，处理过滤、积水或接口泄漏。',checks:['对照主空气瓶至用气端的分段压力、阀位和操作时刻，确认待处理段并保持必要控制空气供应。','按本船规程放残；隔离卸压后清理已确认受污染的滤器，修复已定位接口的密封。','核对滤芯、密封件规格和实际用料，恢复阀位；无损坏依据的部件不强制更换，未覆盖通路单独留项。']},
}
export function compactRepair(caseData,keys){
 const selected=keys.filter(key=>instructions[key]&&caseData.packages[key])
 const packages=selected.map(key=>caseData.packages[key])
 if(!packages.length)return null
 const warning=caseData.realType==='warning'
 const preparation=[
  '核对本轮已确认范围：'+packages.map(p=>p.title).join('、')+'；备齐相应维修作业单、图册和现场检查记录。',
  warning?'确认两组阀及备用气源状态，协调相关用气设备；按批准程序维持可用供气路径并隔离待检段，禁止同时拆开两组路径。':'落实获批停机、防意外起动、燃油及伺服油隔离卸压；执行人与复核人确认后开展拆装。',
  '按本次备件清单核对型号、密封件及实际可用数量，准备适配检测工具、洁净封口和旧件标签。',
 ]
 const tasks=[{
  label:warning?'确认供气配置与隔离范围':'确认作业范围与隔离标识',shortLabel:'隔离与标识',
  guide:warning?'先维持必要供气，再隔离获批待检段。':'先落实作业许可与隔离，再标记获批处理部位。',
  checks:[preparation[0],preparation[1],warning?'记录阀组编号、切换时刻及阀前后压力；隔离卸压确认后，标记接头和原配置。':'拍照标识待拆插头、管路和接头，核对卸压状态，准备接油及洁净封口。'],
  recordHint:'保存隔离签认、部位标识和作业起始时间。',feedback:'已完成本轮范围、隔离条件与拆前标识核对。',
 },...selected.map(key=>({...instructions[key],recordHint:'保存实际发现、维修作业单、处理措施及旧新件记录；剩余项目单独留项。',feedback:caseData.packages[key].tasks.map(t=>t.feedback).join('；')})),{
  label:warning?'恢复供气并复测压力响应':'恢复系统并复测喷射响应',shortLabel:'复装与复测',
  guide:'完成复装核对后，按批准工况开展功能测试，将实际措施和测试结果提交验收。',
  checks:[warning?'核对本轮阀组、接口、排水阀及防护，恢复批准供气配置并检查密封。':'核对本轮接口、接线、管路及防护，按维修作业单恢复供给，检查泄漏与泄油通路。',warning?'按本船设定和维修作业单复核调压，同步记录主机控制空气进口压力、主机控制空气进口压力（安全监测）及用气、切换状态；减压阀前后压力另测并标明位置，不用两个进口测点相减作为阀压降。':'同步记录燃油轨压力、二缸指令与反馈、六缸排温、转速和负荷，保存对应报警记录。','原异常复现或存在泄漏时记录现象及试验条件，停止接续试验并交回复查；验收通过后持续效果进入观察。'],
  recordHint:'保存复测时刻、运行条件、指标、原异常是否复现和未完成项目。',feedback:'已记录本轮复装、功能复测及剩余项目，提交现场验收。',
 }]
 const acceptanceRows=[
  {name:'复装与密封',req:'获批范围内接口、管路、接线及防护恢复，无泄漏；实际用料与旧新件可追溯。',method:'核对本轮维修作业单、接口检查及执行/复核签认。'},
  ...selected.map(key=>{
   const rows=caseData.packages[key].acceptanceRows
   const points=key==='air'?[rows[1]]:[rows[1],rows[2]]
   return {name:instructions[key].shortLabel+'功能验收',req:points.map(r=>r.req).join(' '),method:points.map(r=>r.method).join(' ')}
  }),
  {name:'记录与后续观察',req:'实际措施、测试工况、未完成项目及观察范围已记录。'+(selected.includes('regulator')?'临时恢复与正式更换分别登记。':''),method:'核对处理与复测资料；仍异常接续排查，通过后进入效果观察。'},
 ]
 return {tasks,workDetails:{preparation,parts:packages.flatMap(p=>p.parts),acceptanceRows,acceptance:acceptanceRows.map(r=>r.name+'：'+r.req)}}
}
