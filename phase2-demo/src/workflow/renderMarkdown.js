const escape=text=>String(text).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;')
// Parse block boundaries by line: model responses need not put blank lines after headings.
export function renderMarkdown(content='',highlights=[]){
 const inline=text=>{
  let value=escape(text).replace(/\*\*(.+?)\*\*/g,'<strong>$1</strong>')
  for(const item of highlights)if(item.text&&['warning','success','danger'].includes(item.tone))value=value.split(escape(item.text)).join(`<mark class="highlight-${item.tone}">${escape(item.text)}</mark>`)
  return value
 }
 let output='',lines=[],kind=null,fenced=false
 const flush=()=>{if(!lines.length)return;output+=kind==='ul'||kind==='ol'?`<${kind}>${lines.map(line=>`<li>${inline(line)}</li>`).join('')}</${kind}>`:kind==='pre'?`<pre><code>${escape(lines.join('\n'))}</code></pre>`:`<p>${lines.map(inline).join('<br>')}</p>`;lines=[];kind=null}
 for(const line of String(content).replace(/\r\n?/g,'\n').split('\n')){
  if(/^\s*```/.test(line)){flush();fenced=!fenced;kind=fenced?'pre':null;continue}
  if(fenced){kind='pre';lines.push(line);continue}
  const heading=line.match(/^\s{0,3}(#{1,6})\s+(.+?)\s*#*$/)
  if(heading){flush();const level=Math.min(heading[1].length+1,6);output+=`<h${level}>${inline(heading[2])}</h${level}>`;continue}
  if(!line.trim()){flush();continue}
  const list=line.match(/^\s*(?:([-*+])\s+|\d+[.)]\s+)(.*)$/),next=list?(list[1]?'ul':'ol'):'p'
  if(kind!==next)flush();kind=next;lines.push(list?list[2]:line)
 }
 flush();return output
}
