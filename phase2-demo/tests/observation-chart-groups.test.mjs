import test from 'node:test'
import assert from 'node:assert/strict'
import {observationChartGroups,observationChartOption} from '../src/workflow/observationChartGroups.js'

const start='2026-11-11T03:00:00Z',end='2026-11-11T04:00:00Z',at=Date.parse(start)
const reading=(pointCode,name,unit,subsystem,value=0)=>({channelId:pointCode,pointCode,name,unit,subsystem,value,trendData:[{timestamp:at,value},{timestamp:at+12000,value}]})
test('nine observation sensors form six-cylinder, operating and pressure tabs without losing saved channels',()=>{
 const readings=[reading('DC0001','主机转速','RPM','转速监测'),...Array.from({length:6},(_,i)=>reading('DC00'+(22+i),(i+1)+'缸扫气温度','°C','扫气系统',45+i)),reading('DC0058','燃油指令','%','燃油系统'),reading('DC0059','扫气压力','bar','扫气系统')]
 const groups=observationChartGroups([],readings)
 assert.deepEqual(groups.map(g=>g.channels.length),[6,2,1]);assert.equal(groups[0].title,'各缸扫气温度');assert.equal(groups[1].id,'operating')
 assert.deepEqual(observationChartOption(groups[0],start,end).series.map(s=>s.name),readings.slice(1,7).map(r=>r.name))
 const option=observationChartOption(groups[1],start,end)
 assert.equal(option.yAxis.length,2);assert.equal(option.series[0].yAxisIndex,0);assert.equal(option.series[1].yAxisIndex,1)
 assert.match(option.yAxis[0].name,/RPM/);assert.match(option.yAxis[1].name,/%/);assert.equal(option.series[0].data[0][1],0)
 assert.match(option.tooltip.formatter([{seriesName:'主机转速',seriesIndex:0,value:[at,0]},{seriesName:'燃油指令',seriesIndex:1,value:[at,0]}]),/主机转速：0 RPM\n燃油指令：0 %/)
})
test('chart preserves zeros, reverse rotation, missing samples and the actual observation window',()=>{
 const r=reading('DC0001','主机转速','RPM','转速监测');r.trendData=[{timestamp:at+24000,value:null},{timestamp:at,value:0},{timestamp:at+12000,value:-42},{timestamp:at-1,value:100},{timestamp:Date.parse(end)+1,value:200},{timestamp:NaN,value:9}]
 const option=observationChartOption(observationChartGroups([],[r])[0],start,end)
 assert.deepEqual(option.series[0].data,[[at,0],[at+12000,-42],[at+24000,null]])
 assert.equal(option.series[0].connectNulls,false);assert.equal(option.xAxis.min,at);assert.equal(option.xAxis.max,Date.parse(end))
 assert.equal(option.xAxis.axisLabel.formatter(at),'11:00')
 const long=observationChartOption(observationChartGroups([],[r])[0],start,'2026-11-25T04:00:00Z')
 assert.equal(long.xAxis.axisLabel.formatter(Date.parse('2026-05-01T00:00:00+08:00')),'05-01\n00:00')
 assert.notEqual(long.xAxis.axisLabel.formatter(at),long.xAxis.axisLabel.formatter(at+86400000))
})
test('uncompleted observations show the selected scope without manufacturing readings',()=>{
 const groups=observationChartGroups([{id:'temperature',pointCode:'DC0022',nameCn:'1缸扫气温度',unit:'°C'}])
 assert.equal(groups[0].channels[0].name,'1缸扫气温度');assert.deepEqual(observationChartOption(groups[0],start,end).series[0].data,[])
})
