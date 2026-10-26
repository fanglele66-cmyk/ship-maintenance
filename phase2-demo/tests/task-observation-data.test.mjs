import test from 'node:test'
import assert from 'node:assert/strict'
import history from '../src/mock/realObservationHistory.json' with {type:'json'}
import {taskObservationData,taskObservationWindow,observationTime,normalizeObservationHours} from '../src/mock/taskObservationData.js'

test('1H, 6H and 24H use distinct source windows ending at the event evidence cutoff',()=>{
 for(const [id,entry] of Object.entries(history.cases)){
  const data=taskObservationData(id),source=history.windows[entry.windowId]
  assert.equal(data.end,observationTime(entry.evidenceCutoff))
  const counts=[]
  for(const hours of [1,6,24]){
   const window=taskObservationWindow(data.sensors,data.end,hours)
   assert.equal(window.end-window.start,hours*3600000)
   assert.equal(window.series[0].count,source.coverage.ranges[hours+'H'].sampleCount)
   counts.push(window.series[0].count)
   for(const series of window.series){
    assert.ok(series.points[0][0]-window.start<60000)
    assert.ok(window.end-series.points.at(-1)[0]<60000)
    const expected=source.times.flatMap((time,index)=>{const at=observationTime(time);return at>=window.start&&at<=window.end?[[at,source.columns[series.channelId][index]]]:[]})
    assert.deepEqual(series.points,expected,'no resampling, value changes or later evidence')
    const gaps=source.coverage.gaps.filter(gap=>observationTime(gap.after)>=window.start&&observationTime(gap.before)<=window.end)
    assert.equal(series.data.length-series.points.length,gaps.length,'all source-defined gaps break the line')
   }
  }
  assert.ok(counts[0]<counts[1]&&counts[1]<counts[2])
 }
})

test('real gaps break the line and zero, negative and missing values stay distinct',()=>{
 const end=observationTime('2026-08-16 00:53:24')
 assert.equal(end,Date.parse('2026-08-15T16:53:24Z'))
 const series=taskObservationWindow([{trendData:[{time:'2026-08-16 00:49:00',value:0},{time:'2026-08-16 00:49:12',value:-75.8},{time:'2026-08-16 00:50:42',value:-20.9},{time:'2026-08-16 00:51:42',value:null}]}],end,1).series[0]
 assert.deepEqual(series.points.map(([,value])=>value),[0,-75.8,-20.9,null])
 assert.deepEqual(series.data.map(([,value])=>value),[0,-75.8,null,-20.9,null])
 assert.equal(series.count,3)
 assert.equal(normalizeObservationHours(168),24)
 assert.equal(normalizeObservationHours('custom'),24)
 assert.equal(normalizeObservationHours(6),6)
})

test('maintenance history stays tied to the source event rather than post-repair observations',()=>{
 const warning=taskObservationData('real-warning-0523'),maintenance=taskObservationData('real-maintenance-c4-baseline')
 assert.equal(maintenance.dataRole,'baseline-source-history')
 assert.notEqual(maintenance.end,warning.end)
 assert.notDeepEqual(maintenance.sensors[0].trendData,warning.sensors[0].trendData)
 assert.equal(maintenance.sensors[0].unit,'°C')
 assert.equal(taskObservationData('unknown'),null)
})
