// Import only named form fields. File content is data, never an instruction or
// an automatic business action. Ambiguous values remain for human correction.
function csvRows(text){
 const rows=[];let row=[],cell='',state='start'
 for(let i=0;i<text.length;i++){
  const c=text[i]
  if(state==='quoted'){
   if(c==='"'){if(text[i+1]==='"'){cell+='"';i++}else state='closed'}
   else if(c!=='\r')cell+=c
  }else if(c===','||c==='\n'){
   row.push(cell);cell='';state='start';if(c==='\n'){rows.push(row);row=[]}
  }else if(c==='\r')continue
  else if(c==='"'&&state==='start')state='quoted'
  else {if(c==='"'||state==='closed')throw Error('CSV 引号必须完整包围字段，请检查文件。');cell+=c;state='plain'}
 }
 if(state==='quoted')throw Error('CSV 引号未闭合，请检查文件。')
 row.push(cell);if(row.some(Boolean))rows.push(row);return rows
}
// Preserve every object entry, including duplicate keys, for conflict checking.
function jsonEntries(input){
 JSON.parse(input)
 let cursor=0;const entries=new WeakMap()
 const space=()=>{while(/\s/.test(input[cursor]||'x'))cursor++}
 function read(){
  space();const start=cursor,c=input[cursor++]
  if(c==='"'){
   while(cursor<input.length){const ch=input[cursor++];if(ch==='\\')cursor++;else if(ch==='"')break}
   return JSON.parse(input.slice(start,cursor))
  }
  if(c==='{'||c==='['){
   const object=c==='{'?Object.create(null):[],pairs=[];space()
   if(input[cursor]!== (c==='{'?'}':']'))while(true){
    if(c==='{'){const key=read();space();cursor++;const value=read();pairs.push([key,value]);object[key]=value}
    else object.push(read())
    space();if(input[cursor]!==',')break;cursor++
   }
   cursor++;if(c==='{')entries.set(object,pairs);return object
  }
  while(cursor<input.length&&!/[\s,\]}]/.test(input[cursor]))cursor++
  return JSON.parse(input.slice(start,cursor))
 }
 return {parsed:read(),entries}
}
function localMinute(value){
 const match=value.match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?$/)
 if(!match)return null
 const [,year,month,day,hour,minute,second='00']=match
 const date=new Date(`${year}-${month}-${day}T${hour}:${minute}:${second}Z`)
 if(!Number.isFinite(date.getTime())||date.toISOString().slice(0,19)!==`${year}-${month}-${day}T${hour}:${minute}:${second}`)return null
 return `${year}-${month}-${day}T${hour}:${minute}`
}
export function parseRecordImport(text,filename,fields){
 const input=String(text).replace(/^\uFEFF/,'').trim(),pairs=[]
 if(!input)throw Error('文件内容为空。')
 if(/\.json$/i.test(filename)){
  const {parsed,entries}=jsonEntries(input),envelope=parsed&&!Array.isArray(parsed)&&typeof parsed==='object'&&Object.hasOwn(parsed,'values')
  if(envelope&&entries.get(parsed).filter(([key])=>key==='values').length>1)throw Error('JSON 包含重复的 values 记录，请整理后重试。')
  const values=envelope?parsed.values:parsed
  if(Array.isArray(values)){for(const row of values){if(row&&typeof row==='object')pairs.push([row.field||row.label||row.key,row.value])}}
  else if(values&&typeof values==='object')pairs.push(...entries.get(values))
  else throw Error('JSON 应为字段对象或字段/值记录数组。')
 }else if(/\.csv$/i.test(filename)){
  const rows=csvRows(input)
  if(rows[0]?.some(cell=>/^(字段|field|key|label)$/i.test(cell.trim()))){const head=rows.shift();const k=head.findIndex(cell=>/^(字段|field|key|label)$/i.test(cell.trim())),v=head.findIndex(cell=>/^(值|内容|value)$/i.test(cell.trim()));if(v<0)throw Error('CSV 需要字段和值两列。');rows.forEach(row=>pairs.push([row[k],row[v]]))}
  else {const headers=rows.shift()||[];if(rows.length!==1)throw Error('表头式 CSV 请只提供一行当前任务记录。');headers.forEach((header,i)=>pairs.push([header,rows[0][i]]))}
 }else if(/\.(txt|md)$/i.test(filename)){
  for(const line of input.split('\n')){const match=line.match(/^\s*([^：:]+?)\s*[：:]\s*(.*)$/);if(match)pairs.push([match[1],match[2]]);else if(line.trim()&&pairs.length)pairs.at(-1)[1]+='\n'+line.trim()}
 }else throw Error('支持 TXT、Markdown、CSV 和 JSON 文本记录。')
 const values={},unmatched=[],conflicts=new Set()
 for(const [rawKey,rawValue] of pairs){
  const key=String(rawKey||'').trim(),field=fields.find(field=>field.key===key||field.label===key)
  if(!field){if(key)unmatched.push(key);continue}
  if(typeof rawValue!=='string'&&typeof rawValue!=='number'&&typeof rawValue!=='boolean'){unmatched.push(key);continue}
  let value=String(rawValue).trim()
  if(field.type==='select'){const option=field.options.find(option=>option.value===rawValue||option.label===value||String(option.value)===value);if(!option){unmatched.push(key);continue}value=option.value}
  if(field.type==='datetime-local'){value=localMinute(value);if(!value){unmatched.push(key);continue}}
  if(field.type==='number'){if(!value||!Number.isFinite(Number(value))){unmatched.push(key);continue}value=Number(value)}
  if(field.type==='boolean'){if(!['是','否','true','false'].includes(value)){unmatched.push(key);continue}value=['是','true'].includes(value)}
  if(Object.hasOwn(values,field.key)&&values[field.key]!==value)conflicts.add(field.key)
  values[field.key]=value
 }
 for(const key of conflicts){delete values[key];unmatched.push(fields.find(field=>field.key===key).label+'（值冲突）')}
 return {values,unmatched:[...new Set(unmatched)]}
}
