// Aggregate only samples actually supplied by the caller. This module neither
// reads the clock nor generates, shifts, interpolates or diagnoses sensor data.
export const automaticObservationIntervalMs=2*60*60*1000
export const automaticObservationMaxWindowMs=72*60*60*1000
const dayMs=24*60*60*1000
const iso=value=>new Date(value).toISOString()

// Local source timestamp text follows the application's Asia/Shanghai basis.
// Explicit offsets and numeric epoch timestamps are retained without shifting.
export function automaticObservationTime(value){
  if(typeof value==='number')return Number.isFinite(value)&&Math.abs(value)<=8640000000000000?value:NaN
  if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}/.test(value))return NaN
  const text=value.replace(' ','T')
  return Date.parse(text+(/(?:Z|[+-]\d{2}:?\d{2})$/i.test(text)?'':'+08:00'))
}

function provenance(sensors){
  const sourceKinds=[...new Set(sensors.map(sensor=>sensor.sourceKind||'unknown'))]
  const sourceKind=sourceKinds.length===1?sourceKinds[0]:sourceKinds.length?'mixed':'unknown'
  const isSimulation=sourceKinds.some(kind=>/prototype|simulation|demo/i.test(kind))
  const source=isSimulation?(sourceKind==='mixed'?'多来源传感器数据（含原型样例，不能作为实船修复证明）':'原型传感器流，非实船实时数据')
    :sourceKind==='unknown'?'未接入或未标注来源的传感器数据'
      :sourceKinds.every(kind=>/histor|archive/i.test(kind))?'原始历史传感器采样（保留原时戳）':`传感器采样（${sourceKinds.join('、')}）`
  return {source,sourceKind,sourceKinds,isSimulation}
}

function channelWindow(sensor,start,end,gapThresholdMs){
  // Exclusive start, inclusive end: boundary samples belong to exactly one
  // window, and a sample at execution time is not post-execution evidence.
  const samples=sensor.points.filter(point=>point.timestamp>start&&point.timestamp<=end)
  const measured=samples.filter(point=>Number.isFinite(point.value))
  const first=measured[0],last=measured.at(-1)
  let maxGapMs=first?Math.max(first.timestamp-start,end-last.timestamp):end-start
  for(let index=1;index<measured.length;index++)maxGapMs=Math.max(maxGapMs,measured[index].timestamp-measured[index-1].timestamp)
  const missingCount=samples.length-measured.length
  const values=measured.map(point=>point.value)
  return {channelId:sensor.channelId,name:sensor.name,unit:sensor.unit,sourceKind:sensor.sourceKind,
    sampleCount:measured.length,missingCount,firstAt:first?iso(first.timestamp):null,lastAt:last?iso(last.timestamp):null,
    min:values.length?values.reduce((minimum,value)=>Math.min(minimum,value),Infinity):null,max:values.length?values.reduce((maximum,value)=>Math.max(maximum,value),-Infinity):null,
    mean:values.length?values.reduce((sum,value)=>sum+value,0)/values.length:null,
    value:last?.value??null,maxGapMs,covered:Boolean(first&&missingCount===0&&maxGapMs<=gapThresholdMs)}
}

function describeWindow(channels,complete,source){
  const available=channels.filter(channel=>channel.sampleCount>0),sampleCount=channels.reduce((sum,channel)=>sum+channel.sampleCount,0)
  const missing=channels.filter(channel=>!channel.sampleCount).map(channel=>channel.name)
  const gaps=channels.filter(channel=>channel.sampleCount&&!channel.covered).map(channel=>`${channel.name}最大未覆盖间隔 ${(channel.maxGapMs/60000).toFixed(1)} 分钟${channel.missingCount?`，另有 ${channel.missingCount} 条缺失值`:''}`)
  const coverage=!channels.length?'尚未接入本轮监测通道。':[
    `${available.length}/${channels.length} 个通道取得数值，共 ${sampleCount} 条有效采样。`,
    missing.length?`缺测通道：${missing.join('、')}。`:'',
    gaps.length?`采样覆盖不足：${gaps.join('；')}。`:'',
    channels.every(channel=>channel.covered)?'窗口内各通道采样覆盖达到配置的间隔要求。':'',
  ].filter(Boolean).join('')
  return `${source}。${complete?'已到自动检查时刻。':'当前窗口尚未结束，已取得的读数仅供查看。'}${coverage}采样覆盖仅描述资料完整性，不等同于工况可比、异常消除或修复成功。`
}

/**
 * Returns completed execution-aligned windows and a separate partial window.
 * sampleCount sums numeric samples across channels. `observed` means covered
 * data, never healthy/normal. Missing channels remain null without carry-forward.
 * recordedAt is the actual supplied calculation time, not a backdated receipt.
 */
export function automaticObservation({sensors=[],executedAt,now,intervalMs=automaticObservationIntervalMs,gapThresholdMs=120000,maxWindowMs=automaticObservationMaxWindowMs}={}){
  const start=automaticObservationTime(executedAt),end=automaticObservationTime(now)
  const inputs=Array.isArray(sensors)?sensors:[],origin=provenance(inputs)
  const empty={records:[],pending:null,...origin,executedAt:Number.isFinite(start)?iso(start):null,checkedAt:Number.isFinite(end)?iso(end):null,nextUpdateAt:null,truncated:false,range:null,error:null}
  if(!Number.isFinite(start)||!Number.isFinite(end))return {...empty,error:'执行时间和当前检查时间必须有效。'}
  if(start>end)return {...empty,error:'执行时间晚于当前检查时间，尚无修后观察窗口。'}
  if(!Number.isFinite(maxWindowMs)||maxWindowMs<intervalMs)return {...empty,error:'保留时段不得短于观察周期。'}
  if(!Number.isFinite(intervalMs)||intervalMs<=0||!Number.isFinite(gapThresholdMs)||gapThresholdMs<0)return {...empty,error:'观察间隔须为正数，缺测间隔须为非负数。'}
  const completed=Math.floor((end-start)/intervalMs)
  // Keep whole, execution-aligned windows within the latest 72 hours. A second
  // count bound also prevents pathological tiny intervals allocating millions.
  const firstIndex=Math.max(0,Math.ceil((end-start-maxWindowMs)/intervalMs),completed-1000)
  const firstStart=start+Math.min(firstIndex,completed)*intervalMs
  const normalized=inputs.map((sensor,index)=>({
    channelId:sensor.channelId||sensor.id||`channel-${index+1}`,name:sensor.name||sensor.nameCn||sensor.channelId||`通道${index+1}`,unit:sensor.unit||'',sourceKind:sensor.sourceKind||'unknown',
    points:(Array.isArray(sensor.trendData)?sensor.trendData:[]).map(point=>({timestamp:automaticObservationTime(point.timestamp??point.time),value:typeof point.value==='number'&&Number.isFinite(point.value)?point.value:null}))
      .filter(point=>Number.isFinite(point.timestamp)&&point.timestamp>start&&point.timestamp>firstStart&&point.timestamp<=end).sort((a,b)=>a.timestamp-b.timestamp),
  }))
  const makeWindow=(windowStart,windowEnd,complete)=>{
    const channels=normalized.map(sensor=>channelWindow(sensor,windowStart,windowEnd,gapThresholdMs))
    const covered=channels.length>0&&channels.every(channel=>channel.covered)
    const elapsedHours=(windowEnd-start)/3600000
    return {id:`auto-observation:${start}:${windowStart}:${windowEnd}`,auto:true,complete,
      day:(windowEnd-start)/dayMs,values:channels.map(channel=>channel.value),
      status:complete?(covered?'observed':'incomplete'):'pending',covered:complete&&covered,
      windowStart:iso(windowStart),windowEnd:iso(windowEnd),sampleCount:channels.reduce((sum,channel)=>sum+channel.sampleCount,0),
      note:describeWindow(channels,complete,origin.source),...origin,recordedAt:iso(end),
      label:complete?`执行后 ${Number(elapsedHours.toFixed(2))} 小时 · 自动观察`:'当前观察窗口 · 等待下一次自动更新',
      channels}
  }
  const records=[]
  for(let index=firstIndex;index<completed;index++)records.push(makeWindow(start+index*intervalMs,start+(index+1)*intervalMs,true))
  const pendingStart=start+completed*intervalMs
  const pending=end>pendingStart?makeWindow(pendingStart,end,false):null
  const omittedCompletedWindows=Math.min(firstIndex,completed)
  const truncated=omittedCompletedWindows>0
  return {...empty,records,pending,truncated,nextUpdateAt:iso(pendingStart+intervalMs),
    range:{start:iso(firstStart),end:iso(end),omittedCompletedWindows,maxWindowHours:maxWindowMs/3600000},
    truncationNote:truncated?`本次仅汇总最近 ${maxWindowMs/3600000} 小时内的完整观察窗口（最多 1000 个），更早的 ${omittedCompletedWindows} 个窗口未纳入本次计算；已保存的历史记录应继续保留。`:''}
}
