import test from 'node:test'
import assert from 'node:assert/strict'
import {overviewAnalysisWindow} from '../src/mock/overviewAnalysisWindow.js'
import {periodReadings,shipDailyReports} from '../src/mock/shipDailyReports.js'

test('assessment always uses the latest 12h rather than historic event dates',()=>{
 const end=Date.parse('2026-10-22T15:30:45+08:00')
 const window=overviewAnalysisWindow(end)
 assert.equal(window.end-window.start,12*3600000)
 assert.equal(window.hours,12)
 assert.ok(window.end<=end)
 assert.match(window.label,/2026\/10\/22/)
 assert.equal(overviewAnalysisWindow(NaN),null)
})

test('daily reports respect China calendar boundaries without future samples',()=>{
 const cutoff=Date.parse('2026-10-22T00:05:00+08:00'),requested=[]
 const store={allSensors:[{id:'s-012',nameCn:'主机转速',unit:'rpm'}],getSimulationTrend:(id,hours,start,end)=>{requested.push({start,end});return [{value:95}]}}
 const reports=shipDailyReports(store,cutoff)
 assert.equal(new Set(reports.map(report=>report.date)).size,7)
 assert.equal(reports[0].date,'2026-10-22')
 assert.equal(reports[0].end-reports[0].start,5*60000)
 assert.equal(reports[1].date,'2026-10-21')
 assert.equal(reports[1].end-reports[1].start,86400000)
 assert.ok(requested.every(range=>range.start<=range.end&&range.end<=cutoff))
 assert.ok(reports.every(report=>report.provenance.includes('运行样例')))
})

test('missing readings are not counted as zero in daily aggregates',()=>{
 const store={allSensors:[{id:'s-012',nameCn:'主机转速',unit:'rpm'}],getSimulationTrend:()=>[{value:null},{value:0},{value:2},{value:NaN}]}
 const [reading]=periodReadings(store,0,60000)
 assert.equal(reading.count,2)
 assert.equal(reading.mean,'1.0')
 assert.equal(reading.min,'0.0')
 store.getSimulationTrend=()=>[{value:null}]
 assert.deepEqual(periodReadings(store,0,60000),[])
})
