// Imported RT-flex50 source pages. No generated technical body or random warning.
import documents from './wikiKnowledge.json' with {type:'json'}

/** 文档类型枚举 */
export const DOC_TYPES = {
  CASE:    '故障案例',
  PROC:    '操作规程',
  MANUAL:  '设备手册',
  NOTICE:  '技术通告'
}

/** 文档类型颜色 */
export const docTypeColors = {
  '故障案例': { bg: '#ff4d4f1f', color: '#ff4d4f', border: '#ff4d4f33' },
  '操作规程': { bg: '#1890ff1f', color: '#1890ff', border: '#1890ff33' },
  '设备手册': { bg: '#52c41a1f', color: '#52c41a', border: '#52c41a33' },
  '技术通告': { bg: '#faad141f', color: '#faad14', border: '#faad1433' }
}


export const knowledgeDocs=documents
export const DEVICE_TYPES=[{key:'主机',count:documents.length,iconKey:'main-engine'}]
export const DOC_TYPE_STATS=Object.fromEntries(['全部类型',...Object.values(DOC_TYPES)].map(type=>[type,type==='全部类型'?documents.length:documents.filter(d=>d.docType===type).length]))
export const getDocCount=(device,docType)=>documents.filter(d=>(device==='全部'||d.device===device)&&(['全部','全部类型'].includes(docType)||d.docType===docType)).length
