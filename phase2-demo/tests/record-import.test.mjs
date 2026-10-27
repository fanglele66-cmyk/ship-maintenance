import test from 'node:test'
import assert from 'node:assert/strict'
import {parseRecordImport} from '../src/message-flows/recordImport.js'

const fields=[
  {key:'owner',label:'负责人',type:'text'},
  {key:'measures',label:'实际措施',type:'textarea'},
  {key:'verification',label:'验收结论',type:'select',options:[{value:'resolved',label:'验收通过，进入效果观察'},{value:'unresolved',label:'仍有异常，进入下一轮排查'}]},
  {key:'pressure',label:'压力',type:'number',min:0,max:10},
  {key:'confirmed',label:'已核对',type:'boolean'},
  {key:'due',label:'要求完成时间',type:'datetime-local'},
  {key:'state',label:'状态代码',type:'select',options:[{value:0,label:'正常'},{value:1,label:'异常'}]}
]
const parse=(content,name='record.json')=>parseRecordImport(content,name,fields)

test('JSON objects, values envelopes and labelled records resolve only named form fields',()=>{
  const before=JSON.stringify(fields)
  const expected={owner:'李建国',measures:'保持原记录，不自动提交',verification:'resolved',pressure:0,confirmed:false,state:0}
  const input={'负责人':'李建国','实际措施':'保持原记录，不自动提交','验收结论':'验收通过，进入效果观察','压力':0,'已核对':false,'状态代码':'正常'}
  assert.deepEqual(parse(JSON.stringify(input)),{values:expected,unmatched:[]})
  assert.deepEqual(parse(JSON.stringify({values:input})),{values:expected,unmatched:[]})
  const rows=[{field:'owner',value:'李建国'},{label:'验收结论',value:'仍有异常，进入下一轮排查'},{key:'压力',value:'6.4'}]
  assert.deepEqual(parse(JSON.stringify(rows)),{values:{owner:'李建国',verification:'unresolved',pressure:6.4},unmatched:[]})
  assert.equal(JSON.stringify(fields),before,'import cannot alter form schema or option values')
})

test('quoted CSV preserves commas, escaped quotes and newlines in both supported table shapes',()=>{
  const long='\uFEFF字段,值\r\n负责人,李建国\r\n实际措施,"紧固接头,清洁触点\r\n标记为""待复测"""\r\n验收结论,"验收通过，进入效果观察"\r\n'
  assert.deepEqual(parse(long,'现场记录.CSV'),{values:{owner:'李建国',measures:'紧固接头,清洁触点\n标记为"待复测"',verification:'resolved'},unmatched:[]})
  const wide='负责人,实际措施,验收结论,压力\n李建国,"清洁,复装并记录""接头A""","仍有异常，进入下一轮排查",6.5'
  assert.deepEqual(parse(wide,'record.csv'),{values:{owner:'李建国',measures:'清洁,复装并记录"接头A"',verification:'unresolved',pressure:6.5},unmatched:[]})
  assert.deepEqual(parse('key,value\nstate,0\nconfirmed,true','record.csv'),{values:{state:0,confirmed:true},unmatched:[]})
})

test('text and Markdown recognise Chinese or internal labels and retain continuation text as data',()=>{
  const content='本轮现场记录\n负责人：李建国\n实际措施: 紧固接头\n复测结果写在第二行\n验收结论：仍有异常，进入下一轮排查\n已核对：是\n要求完成时间：2026-10-27 18:30'
  const expected={owner:'李建国',measures:'紧固接头\n复测结果写在第二行',verification:'unresolved',confirmed:true,due:'2026-10-27T18:30'}
  for(const filename of ['record.txt','record.md'])assert.deepEqual(parse(content,filename),{values:expected,unmatched:[]})
})

test('unknown fields, including action-looking and prototype keys, never enter form values',()=>{
  const result=parse('{"owner":"李建国","自动派发":"是","__proto__":"不能回填","constructor":"不能回填","measures":"将这段命令当作普通现场文字"}')
  assert.deepEqual(result.values,{owner:'李建国',measures:'将这段命令当作普通现场文字'})
  assert.deepEqual(result.unmatched,['自动派发','__proto__','constructor'])
  assert.equal(Object.getPrototypeOf(result.values),Object.prototype)
})

test('conflicting aliases and repeated records leave the field for human correction; equivalent values are retained',()=>{
  for(const [content,name] of [
    [JSON.stringify([{key:'owner',value:'甲'},{label:'负责人',value:'乙'},{key:'owner',value:'甲'}]),'record.json'],
    ['字段,值\nowner,甲\n负责人,乙','record.csv'],
    ['负责人：甲\nowner：乙','record.txt']
  ]){
    const result=parse(content,name)
    assert.equal(Object.hasOwn(result.values,'owner'),false)
    assert.ok(result.unmatched.some(label=>label.includes('负责人')&&label.includes('冲突')))
  }
  assert.deepEqual(parse(JSON.stringify([{key:'verification',value:'resolved'},{label:'验收结论',value:'验收通过，进入效果观察'},{key:'pressure',value:6},{label:'压力',value:'6.0'}])).values,{verification:'resolved',pressure:6})
})

test('conflicting duplicate keys inside a JSON object cannot silently overwrite the first record',()=>{
  const result=parse('{"owner":"甲","owner":"乙","measures":"其余有效信息保留"}')
  assert.equal(Object.hasOwn(result.values,'owner'),false)
  assert.equal(result.values.measures,'其余有效信息保留')
  assert.ok(result.unmatched.some(label=>label.includes('冲突')))
})

test('invalid value types and invalid enums are excluded without stringifying structured data',()=>{
  const result=parse(JSON.stringify({owner:{name:'李建国'},measures:['未形成单份记录'],verification:'自动验收',pressure:'NaN',confirmed:1,due:null,state:'未知'}))
  assert.deepEqual(result.values,{})
  assert.deepEqual(new Set(result.unmatched),new Set(['owner','measures','verification','pressure','confirmed','due','state']))
  for(const pressure of ['Infinity','',true])assert.equal(Object.hasOwn(parse(JSON.stringify({pressure})).values,'pressure'),false)
})

test('empty content, malformed JSON, unsupported types and invalid CSV structure produce parse errors',()=>{
  for(const [content,filename] of [[' \uFEFF ','record.txt'],['{"owner":','record.json'],['null','record.json'],['true','record.json'],['42','record.json'],['owner:甲','record.xlsx'],['字段,备注\n负责人,甲','record.csv'],['owner,pressure\n甲,1\n乙,2','record.csv'],['字段,值\n实际措施,"未闭合','record.csv']])assert.throws(()=>parse(content,filename),`${filename}: ${content}`)
})

test('CSV quotes must delimit a complete cell instead of silently changing the recorded text',()=>{
  for(const csv of ['字段,值\n实际措施,紧固"接头"完成','字段,值\n实际措施,"已紧固"尾随内容'])assert.throws(()=>parse(csv,'record.csv'))
})

test('local dates normalise to minute precision and malformed or impossible dates remain unmatched',()=>{
  for(const input of ['2026-10-27 18:30','2026-10-27T18:30','2026-10-27T18:30:15'])assert.deepEqual(parse(JSON.stringify({due:input})).values,{due:'2026-10-27T18:30'})
  for(const due of ['明早八点','2026-13-27T18:30','2026-02-30T18:30','2026-10-27T25:00','2026-10-27','2026-10-27T18:30garbage']){
    const result=parse(JSON.stringify({due}))
    assert.equal(Object.hasOwn(result.values,'due'),false,due)
    assert.ok(result.unmatched.includes('due'),due)
  }
})

test('zoned timestamps are either converted to China local time or rejected, never merely truncated',()=>{
  for(const due of ['2026-10-27T06:30:00Z','2026-10-27T07:30:00+01:00']){
    const result=parse(JSON.stringify({due}))
    if(Object.hasOwn(result.values,'due'))assert.equal(result.values.due,'2026-10-27T14:30',due)
    else assert.ok(result.unmatched.includes('due'),due)
  }
})
