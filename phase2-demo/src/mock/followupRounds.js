// A repeat investigation starts from submitted work and recurrence evidence.
// These are instructions, never a diagnosis or a pre-filled completion receipt.
const clone=value=>JSON.parse(JSON.stringify(value))
const direction=(key,title,checks,action)=>({key,title,checks,action})

const profiles={
 'real-alarm-0430':{
  topic:'二缸喷射异常复发',metrics:'二缸喷射指令、流量活塞反馈、燃油轨压力、六缸排温及转速/负荷',
  preparation:['调取前轮实际措施、旧新件标识、复装验收与首次恢复记录，再标记本次报警或排温分离重新出现的时刻。','准备前轮未覆盖的 ICV 控制、反馈线束及伺服油检查资料；把复发工况与首次试车工况并列，不沿用原报警时刻代替本轮证据。','核实再次停机、燃油/伺服油隔离卸压及检测窗口，优先做非侵入的指令、反馈与供给同步采集。'],
  directions:[
   direction('icv','复核 ICU 修后状态与间歇反馈',['对照前轮实际是否更换 ICU、处理连接或仅清洁，复核对应件号、接口、接线与首次试车记录；未做项目单列。','围绕本次复发时刻同步对比 ICV 指令、流量活塞反馈与排温，检查插接件接触、屏蔽及线束在振动/热态下是否间歇异常。','仅在复查证据支持时按工卡检查伺服油供给、液压动作及污染；更换后的总成仍保留检验依据，不凭复发重复换件。'],'依据本轮定位处理间歇接触、反馈链路或液压执行问题；复核前轮复装接口，替换件须有本轮检验及批准依据。'),
   direction('supply','追查复发时的供给波动与污染来源',['把修后稳定段和复发段的燃油轨/供给压力、泵切换、滤器压差及六缸响应放在同一时间轴。','复核前轮清洁或换芯后的滤器状态与拆下物，追查上游污染、供油切换或局部压降；只检查前轮未排除且有依据的通路。','记录单缸先变化还是共同压力先变化，无法复现时提出需捕获的工况与采样项目。'],'对新定位的供给限制或污染来源实施局部处理；复查前轮滤器与接口的恢复质量，未确认方向继续保留。'),
  ],
 },
 'real-warning-0523':{
  topic:'控制空气低压复发',metrics:'阀前/阀后、控制空气瓶与 0302/0303 压力、用气和阀组切换状态',
  preparation:['备齐前轮阀组编号、临时密封/正式更换记录、材料标识、调压验收和复发窗口压力。','分别列出在用阀与备用阀的实际措施及未完成需求，确认前轮临时措施的使用限制和正式备件落实情况。','协调重复试验的用气条件与供气切换，保留必要控制空气供应；待检段隔离卸压后才开展内部复查。'],
  directions:[
   direction('regulator','复核临时密封与调压保持能力',['按前轮记录区分临时密封、配套密封更换和总成更换，核查是否存在尚未落实的正式措施。','比较阀前稳定条件下的阀后压力建立、静态保持和用气恢复；记录具体阀组及是否在切换后复发。','在隔离条件下检查已处理密封的压痕、装配和阀芯回位，保留失效证据；未检验不把复发等同总成损坏。'],'本轮检查支持时完成获批配套密封或调压机构处理，必要的总成更换另行确认；临时措施与正式完成分别记录。'),
   direction('air','复查用气恢复能力与未覆盖泄漏段',['对照首次修后与本次低压时的空气瓶压力、加载/卸载、杂用空气操作及阀位。','复查前轮处理接头、滤器和排水部位，并按分段压降定位当时未覆盖的分支或止回环节。','在获准用气变化下采集恢复时间与压力，不以空载稳定证明有负荷供气能力。'],'修复本轮证实的分支泄漏、过滤限制或阀位问题，保持批准供气配置，记录原临修部位是否需要返工。'),
  ],
 },
 fault:{
  topic:'冷却能力修后再次下降',metrics:'海水流量、滤器前后压力、淡水进出口温度、温控阀动作、负荷与海水温度',
  preparation:['对照前轮滤器清洁、密封及温控阀处理记录，取得修后首测与再次温升的同工况片段。','核实海水温度、泵组组合及阀位是否改变；准备滤器复查和温控阀动作测试工卡。','落实冷却回路切换、隔离及放残窗口，按已定位范围检查，保留必要冷却能力。'],
  directions:[
   direction('filter','复查滤器再堵塞与上游来污',['比较清洗后与复发时滤器前后压力和海水流量，确认再堵塞还是其他通路限制。','核对滤网安装、密封及残留物；检查上游海水吸入、阀位与污染来源的可用证据。','保存前后照片与清出物，记录未拆检的上游段，不能以一次清洁排除重复堵塞。'],'本轮定位再堵塞时清理来源并恢复滤器；受损滤网或密封仅在检查支持时更换。'),
   direction('valve','复核温控阀热态响应与旁通',['回查前轮温控阀是否实际检查，比较阀位指令、实际行程和旁通温度。','在批准工况测试升温/降温响应，核对热态卡涩或旁通泄漏线索。','分开登记冷却水流量改善与温控响应，单项恢复不能代替整个冷却能力验收。'],'对证实的阀芯动作、执行连接或旁通密封问题进行获批处理，并在热态复测。'),
  ],
 },
 'main-warning':{
  topic:'润滑供油预警复发',metrics:'滤前/滤后压力、同刻计算压差、油温、泵运行与负荷',
  preparation:['备齐前轮滤器/供油处置和验收数据，截取再次降压时段的上下游压力与油温。','核对滤芯型号、旧件检查、旁通/切换状态及实际油品，不将同源计算压差重复计为独立证据。','按润滑系统工卡确认备用供油、隔离和油温条件，再开展获批复查。'],
  directions:[
   direction('filter','追查过滤段压损再次增加',['比较新一轮同油温、同负荷下的压损，复查滤芯安装和前轮清出物/旧芯记录。','核实是否出现二次污染、旁通异常或测压通路堵塞；没有检查依据不再次更换全部滤芯。'],'对本轮确认的污染来源、滤芯安装或旁通缺陷处理，记录返工与新增范围。'),
   direction('supply','复查上游供油与热态调节',['对照修后冷/热态及泵切换时的上游压力、油温和调节状态。','复核前轮未覆盖的吸入、泵输出与调节环节，保留测量来源及暂不能检查的部位。'],'按本轮分段证据处理供油或调节问题，复测热态与切换响应，不凭低压直接扩大到轴承换件。'),
  ],
 },
 drift:{
  topic:'三缸排温偏离修后复发',metrics:'三缸及其余缸排温、负荷、喷油响应与排气密封检查结果',
  preparation:['回查喷油器实际清洁/校验/更换和排气阀检查范围，保留修后首测及再次偏离片段。','准备独立测温与喷油校验资料，先确认新旧读数可比；燃油高压拆检前完成停机隔离卸压。'],
  directions:[
   direction('injector','复核喷油器修后校验与供油匹配',['核对前轮喷油器编号、校验结果及装配记录，检查复发是否与燃油或负荷切换相伴。','在批准条件下复核雾化、启喷和密封资料；同时核对测温来源，不重复预设喷嘴损坏。'],'对本轮校验证实的喷油或供油缺陷实施局部返工，合格件保留，旧新件可追溯。'),
   direction('exhaust','补查排气密封与热态表现',['确认前轮排气阀实际覆盖范围，比较可用压缩压力与热态排气响应。','核对独立测温、密封检验与现场异响，缺少停机条件时记录待检项目。'],'依据本轮密封或动作检验决定获批维护范围，复装后对照喷射与排气两条方向验证。'),
  ],
 },
 'steering-heat':{
  topic:'舵机油温修后再次升高',metrics:'油温、冷却水进出口温度/流量、操舵次数、负荷及油液检查结果',
  preparation:['取得前轮冷却器清理、油液检查与复装记录，标注再次温升的操舵工况。','准备冷却通路复查、油样与负荷记录；按舵机作业程序落实可用操舵能力和隔离窗口。'],
  directions:[
   direction('cooler','复查冷却器效果与重复污染',['比较前轮清理后及复发时的水量、进出口温差和操舵频次。','核对冷却器通路、阀位和再污染迹象，区分冷却不足与负荷增加。'],'处理本轮已确认的冷却限制或污染来源，按实际拆装范围复测密封。'),
   direction('oil','复核热态内漏与油液状态',['对照冷热态压力、操舵响应和油液检查资料，确认前轮未覆盖的内漏线索。','补齐油样与部位检查记录，未取得证据不认定泵或阀已损坏。'],'按本轮证据实施获批油液或局部密封处理，保留未验证的内漏方向。'),
  ],
 },
 'air-delivery':{
  topic:'空压机加载时间修后再次延长',metrics:'加载起止压力、加载时间、用气量、滤器状态与阀动作',
  preparation:['回查前轮进气滤器、加载阀和查漏处理，保留首次恢复及再次延长的加载记录。','统一起止压力和用气条件，准备加载阀动作及分段查漏资料；拆检前停机隔离卸压。'],
  directions:[
   direction('leak','复查未覆盖泄漏与用气变化',['在相同起止压力下比较加载时间及同期用气，核对前轮修复接头是否再次泄漏。','按批准范围复查未覆盖分支和止回部位，区分新增用气与实际供气损失。'],'修复本轮确认的泄漏或止回缺陷，按批准配置恢复，记录前轮返工对象。'),
   direction('loading','复核加载阀热态动作与进气阻力',['核对前轮滤芯安装、清洁状态及加载阀反馈，比较冷/热机加载表现。','在批准测试中记录指令、阀动作与压力建立，不能以运行时间延长直接判定阀损坏。'],'处理本轮定位的进气限制或加载控制问题，复测同起止压力下的加载能力。'),
  ],
 },
 maintenance:{
  topic:'连杆轴承维保后振动或温度复发',metrics:'同工况轴承振动、温度、润滑压力及实际间隙复测结果',
  preparation:['回查前轮轴瓦、间隙、紧固及润滑通路记录，保留旧新件与复核签认。','将首次试运行和本次复发的负荷、转速、油温并列，核对振动测点与安装。','再次拆检须确认停机、防起动和盘车条件；先落实可完成的非侵入检查。'],
  directions:[
   direction('bearing','复核前轮配合与润滑恢复质量',['核对前轮实际间隙、轴瓦配合、紧固和润滑孔位，不把换件记录当作装配合格的证据。','比较复发时润滑与振动测点，按工卡补充未覆盖检验，判断是否存在返工必要。'],'仅对本轮检查支持的配合、润滑或安装缺陷返工；复用或更换均依据本机检验要求记录。'),
   direction('conditions','落实复查范围与复测条件',['根据新增定位证据核实适配件、量具、执行人和复核人，不重复默认整套换件。','明确尚未具备的拆检条件及后续试运行负荷，保留原周期中未执行项目。'],'按本次获批范围落实作业和复测条件，实际未执行项目继续留项。'),
  ],
 },
 'aux-maintenance':{
  topic:'辅机三缸专项维护后偏移复发',metrics:'三缸及其他缸排温、机组负荷/转速、喷射与压缩检验资料',
  preparation:['对照前轮三缸校验、燃烧检查和实际维护，区分只完成检查与已经换件的项目。','保留同机同负荷的首测与复发片段，落实备用机组、停机隔离与复测窗口。'],
  directions:[
   direction('combustion','复核修后测量与燃烧证据',['先核对探头与独立校验，比较前轮处理后的排温、喷射和压缩资料。','围绕本次新增偏移确定尚未覆盖的方向，不把稳定偏差自动归为新故障。'],'按新增检验依据处理测量或燃烧局部问题，保留正常部件与未检查方向。'),
   direction('conditions','确认新增检查与实施条件',['列明前轮已完成、需返工及待补检查，并确认适用工卡、仪器和备件。','复核机组调度与本次窗口，原季度未完成项目继续保留。'],'在获批新增范围内开展维护，分开记录返工、新增作业和原计划余项。'),
  ],
 },
}

function baselineProfile(item){
 const cylinder=item.baselineCylinder===1||item.id?.includes('c1')?'一缸':'四缸'
 return {
  topic:cylinder+'专项检查后相对偏差复发',metrics:cylinder+'与其余五缸排温、负荷/转速、燃油及适用的 Pmax/压缩压力',
  preparation:[`备齐前轮${cylinder}独立测温校验、燃烧检查、实际措施及同工况首测，标明当时未完成的项目。`,`对照前轮观察期与本次偏差重新出现的六缸同刻数据，核对参照缸变化、负荷、燃油和调整记录，不重新套用月度原始偏差作为修后事实。`,'确认新增检查的工卡、独立校验仪、适配备料和停机窗口；已完成且无新增疑点的项目不重复安排拆换。'],
  directions:[
   direction('baseline',`复核${cylinder}修后校验与剩余偏差`,[`复核前轮探头/通道独立校验的原始误差、处理及复测，确认本次是否为通道再次漂移或参照缸变化。`,`把${cylinder}修后稳定与复发片段按相近负荷、转速和燃油配对，结合前轮 Pmax、压缩压力及喷射/排气检查区分已解释和未解释部分。`,'根据新增证据提出测温或燃烧专项复查范围，没有定位证据不预先安排喷油器或排气阀更换。'],`按本轮独立校验及燃烧检查结果，对${cylinder}已定位的通道、连接或燃烧部位实施获批处理；无异常证据的部件不重复拆换。`),
   direction('conditions','落实剩余检查与新增作业条件',['逐项比对前轮已完成、受限、需返工及新增检查，核实本轮仪器、工卡、备料和执行/复核人。','确认本次停机、防起动、隔离卸压、冷却与复测窗口；缺项明确负责人及到位时间。'],'按本次新增范围安排校验、维护和复装，未完成的周期或专项项目继续保留。'),
  ],
 }
}

export function followupProfile(item){
 if(item.realType==='maintenance')return baselineProfile(item)
 return profiles[item.id]||{
  topic:item.initialTitle+'修后复查',metrics:(item.observation?.names||['原异常指标']).join('、'),
  preparation:['准备前轮实际措施、验收和本次复发片段，核对同工况与采样来源。','明确已做、未做与需补查的范围，按获批窗口准备仪器和备料。'],
  directions:[direction('review','复核已处理部位与复发条件',['对比前轮修后与本次复发时的实际工况、读数和检查结果。','先核对复装及未完成项，有新定位证据后再确定处置范围。'],'仅处理本轮检查支持且获批的缺陷，分别记录返工与新增范围。')],
 }
}

function contextEvidence(context={}){
 const execution=context.execution,records=context.observations||[]
 return [execution?.values?.measures?'前轮已提交实际措施：'+execution.values.measures:'前轮实际措施尚无完整记录，先补齐检查范围。',
  execution?.values?.acceptance?'前轮已提交验收：'+execution.values.acceptance:'前轮验收依据待补齐。',
  ...records.slice(-3).map(record=>'前轮观察：'+[record.label,record.note].filter(Boolean).join('；'))]
}

// Legacy events have no separate package catalogue. Prepare only materials for
// the selected new finding; quantities are plans, never stock or issue records.
const plannedPart=(name,specification,use)=>({name,amount:'按本轮获批范围核定',specification,use})
const legacyParts={
 drift:{
  injector:[plannedPart('三缸喷油器接口密封包','按本机喷油器与拆装接口图册匹配','本轮喷油器校验支持拆检并获批时备料；不预定更换喷嘴。')],
  exhaust:[plannedPart('三缸排气阀检修密封包','按本机排气阀组件、密封位置及工卡匹配','本轮排气密封检查支持拆修时使用；阀体或阀座更换须另有检验依据。')],
 },
 'steering-heat':{
  cooler:[plannedPart('舵机油冷却器拆装密封件','按本机冷却器型号与本轮拆装接口匹配','仅用于本轮已确认的冷却器或冷却通路复装。')],
  oil:[plannedPart('油样瓶及清洁取样耗材','满足本船液压油取样与送检要求','留存本轮油液状态依据，不以取样代替油品检验。'),plannedPart('已定位液压部位的配套密封件','按具体泵/阀件标识、密封位置及本机工卡核定','内漏或局部密封缺陷经检验确认且拆修获批后备料；不预设整泵、整阀或整批液压油更换。')],
 },
 'air-delivery':{
  leak:[plannedPart('已定位气路接头或止回部位密封件','按本轮泄漏位置、接口及压力等级匹配','仅处理复查定位的泄漏或止回缺陷，未发现异常的分支不扩大拆换。')],
  loading:[plannedPart('进气滤器滤芯','按本机滤器型号与过滤要求匹配','本轮确认滤芯受阻或损坏且不可恢复时选用。'),plannedPart('加载阀检修密封包','按本机加载阀组件及批准工卡匹配','动作检验支持加载阀拆检时备料；不因加载时间延长直接更换总成。')],
 },
}

export function followupRepair(item,repair,round=1){
 if(round<2)return repair
 const profile=followupProfile(item),selected=repair.packageKeys?.length?profile.directions.filter(d=>repair.packageKeys.includes(d.key)):profile.directions
 const directions=selected.length?selected:profile.directions
 const detail=repair.workDetails||item.workDetails||{}
 const parts=legacyParts[item.id]?directions.flatMap(d=>legacyParts[item.id][d.key]||[]):detail.parts||[]
 const preparation=[...profile.preparation,`第${round}轮作业前，以本轮检查结果复核批准范围；前轮备料不等于本轮已领用，已完成项目仅在有返工依据时重新执行。`]
 const tasks=[{
  label:'核对前轮措施并确认本轮返工边界',shortLabel:'范围与隔离',guide:'把前轮已完成、需要返工、尚未执行和本次新增项目逐项列清，再落实本次作业条件。',
  checks:[preparation[0],preparation.at(-1),'记录本次隔离签认、部位标识和复装前状态；按本机工卡及批准范围施工。'],recordHint:'记录前轮对应项目、本轮新增依据、批准范围与隔离签认。',
 },...directions.map(d=>({label:d.title+'的对应处置',shortLabel:d.title,guide:d.action,
  checks:[d.action,'对原处理部位返工时登记缺陷及形成原因，新增部位单独登记，旧新件和实际领用可追溯。','超出批准范围、定位不足或条件不具备的项目先留项，补齐依据后再实施。'],recordHint:'记录本轮定位证据、实际措施、旧新件及未完成项。'})),{
  label:'复装后复测复发工况并移交观察',shortLabel:'复测与交接',guide:'复测覆盖上轮未能稳定的工况，再分别提交作业完成、现场验收和效果观察记录。',
  checks:[`在批准工况同步采集${profile.metrics}，对照前轮首测及本次复发片段。`,'检查本轮拆装部位的密封、接线、防护和响应，记录试验起止及参与复核人员。','原异常仍存在时如实提交未解决；资料不足时记录缺项，不以一次读数正常代替持续观察。'],recordHint:'提交同工况读数、复发是否重现、验收判断及下一观察窗口。',
 }]
 const acceptanceRows=[
  {name:'本轮范围与返工追溯',req:'本轮措施与新增证据对应，前轮已做、返工和未做项目区分清楚。',method:'核对前后两轮工卡、实际领用、旧新件及执行/复核签认。'},
  {name:'复装与局部功能',req:'本轮拆装接口、接线、防护恢复；实际检查的密封及动作符合本机要求。',method:'按适用工卡逐项检验，记录范围与未覆盖部位；未检项不判为合格。'},
  {name:'复发工况验证',req:`在批准且可比的运行条件下记录${profile.metrics}，如实判断原异常是否重现。`,method:'并列前轮首测、复发段与本轮复测数据，注明时间、工况与仪表来源，按本机要求验收。'},
  {name:'剩余项目与观察交接',req:'本轮未完成项、后续责任人及观察范围已明确，历史观察保留。',method:'提交实际措施和验收；原异常未解决则接续复查，验收通过后另行跟踪持续效果。'},
 ]
 return {...repair,title:`第${round}轮${profile.topic}的对应处置`,tasks,round,
  evidence:['本轮处置范围取自新提交的检查发现，复发本身不证明某个部件损坏。'],
  workDetails:{...detail,preparation,parts:parts.map(part=>({...part,use:part.use?.startsWith('仅在本轮复查支持')?part.use:'仅在本轮复查支持且获批时使用；先核对前轮实际领用与剩余备料。'+(part.use||'')})),acceptanceRows,acceptance:acceptanceRows.map(row=>row.name+'：'+row.req)},
  markdown:`### 第${round}轮执行目标\n\n${profile.topic}。对照前轮已完成范围，按新增检查证据确定返工或补充处置。\n\n### 本轮作业\n\n${tasks.map(task=>'- **'+task.label+'**：'+task.guide).join('\n')}\n\n### 提交成果\n\n保留前轮资料，新增本轮实际措施、复装检验及复发工况复测；未取得结果的项目明确留项。`,
 }
}

export function followupStage(item,stage,round,context={}){
 if(round<2)return clone(stage)
 if(stage.kind==='work')return {...stage,...followupRepair(item,stage,round)}
 if(stage.kind!=='check')return clone(stage)
 const profile=followupProfile(item)
 const tasks=stage.tasks.map((task,index)=>{
  const d=profile.directions.find(d=>task.package&&d.key===task.package)||profile.directions[index]||profile.directions[0]
  return {...clone(task),followupKey:d.key,label:d.title,shortLabel:d.title,guide:`第${round}轮围绕前轮实际措施与本次复发重新核查。`+d.checks[0],checks:[...d.checks],recordHint:'提交复发时刻与工况、前轮对应措施、本次新证据及仍未排除项；未取得检查结果不预填正常或故障。'}
 })
 const evidence=contextEvidence(context)
 return {...stage,round,title:`第${round}轮${profile.topic}原因复查`,summary:'根据前轮实际措施、验收和复发片段区分返工、新增原因与资料缺口；不重复沿用首轮结论。',tasks,preparation:[...profile.preparation],evidence,
  markdown:`### 第${round}轮复查起点\n\n${evidence.map(text=>'- '+text).join('\n')}\n\n### 本轮重点\n\n${tasks.map(task=>'- **'+task.label+'**：'+task.checks.join(' ')).join('\n')}\n\n### 提交要求\n\n分别记录本轮发现、与前轮措施的关系和未完成检查；只将本轮证据支持的方向纳入处置。`,
 }
}
