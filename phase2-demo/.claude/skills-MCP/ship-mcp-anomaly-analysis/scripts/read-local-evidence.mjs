import {readFile} from 'node:fs/promises'
import {resolve} from 'node:path'
import {fileURLToPath} from 'node:url'
import {parseArgs} from 'node:util'
import {readEventEvidence} from '../../../../server/event-evidence.mjs'
import {toTime} from '../../../../server/local-data.mjs'
import {localPointIds} from '../../../../src/workflow/localSensorData.js'

// A separate read-only step: model scores and filled inputs are not measurements.
const root=fileURLToPath(new URL('../../../../',import.meta.url))
const minutes=10*60000
try {
  const {values}=parseArgs({options:{verified:{type:'string'},'data-dir':{type:'string'}}})
  if(!values.verified||!values['data-dir'])throw Error('请指定 --verified 与 --data-dir。')
  const result=JSON.parse(await readFile(values.verified,'utf8'))
  if(result.shipId!=='900000000000000101'||result.deviceId!=='900000000000000202'||result.modelName!=='native_maf_h128_b7_n1')throw Error('未绑定此模型或设备。')
  const begin=toTime(result.startTime),finish=toTime(result.endTime)
  const windows=[]
  for(const row of result.rows){
    const at=toTime(row.sampleTime)
    if(!Number.isFinite(at)||!(begin<=at&&at<finish))throw Error('异常行超出请求窗口。')
    const start=Math.max(begin,at-minutes),end=Math.min(finish,at+minutes)
    let window=windows.at(-1)
    if(!window||window.end<start){window={start,end,rowIndices:[],points:new Set(['DC0001','DC0058'])};windows.push(window)}
    window.end=Math.max(window.end,end)
    window.rowIndices.push(row.rowIndex)
    for(const code of row.overThresholdPoints){
      if(!localPointIds[code])throw Error('本船点表缺少 '+code)
      window.points.add(code)
    }
  }
  const evidence=windows.map(w=>{
    const start=new Date(w.start).toISOString(),end=new Date(w.end).toISOString()
    const sensors=readEventEvidence(root,{deviceId:'main-engine-1',sensorIds:[...w.points].map(c=>localPointIds[c]),start,end},resolve(values['data-dir']))
    return {start,end,rowIndices:w.rowIndices,sensors}
  })
  if(!windows.length){
    const start=new Date(begin).toISOString(),end=new Date(finish).toISOString()
    const sensorIds=result.featureOrder.map(code=>localPointIds[code])
    if(sensorIds.some(id=>!id))throw Error('本船点表与模型输入列不一致。')
    const sensors=readEventEvidence(root,{deviceId:'main-engine-1',sensorIds,start,end},resolve(values['data-dir']))
    evidence.push({start,end,rowIndices:[],sensors:sensors.map(({trendData,...stats})=>stats)})
  }
  console.log(JSON.stringify({runId:result.runId,shipId:result.shipId,deviceId:result.deviceId,model:result.modelName,anomalyRows:result.anomalyRows,evidence},null,2))
} catch(error){console.error(error.message);process.exitCode=1}
