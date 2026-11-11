const normalize=path=>String(path||'').replaceAll('\\','/').replace(/^\/?wiki_rt-flex50\//,'')
export function knowledgeReferences(sources,documents,limit=3){
 const byPath=new Map(documents.map(doc=>[normalize(doc.sourcePath),doc])),byTitle=new Map(documents.map(doc=>[doc.title,doc])),references=new Map()
 for(const source of sources||[]){
  const doc=byPath.get(normalize(source.file))||byTitle.get(source.title)
  if(!doc)continue
  if(!references.has(doc.id))references.set(doc.id,{id:doc.id,title:doc.title,href:'/#/knowledge?doc='+encodeURIComponent(doc.id),citations:[]})
  const entry=references.get(doc.id)
  if(source.id&&!entry.citations.includes(source.id))entry.citations.push(source.id)
 }
 return [...references.values()].slice(0,limit)
}
