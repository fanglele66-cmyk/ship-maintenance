export const reportSections=[['evidence','现场记录摘要'],['interpretation','AI分析（原因与措施判断）'],['unverified','尚不能确认与未执行事项'],['next','AI后续建议']]
export function validateGeneratedReport(patch){
 if(typeof patch?.summary!=='string'||!patch.summary.trim()||reportSections.some(([key])=>typeof patch.analysis?.[key]!=='string'||!patch.analysis[key].trim()))throw Error('报告内容不完整，请重试生成；原填写记录已保留。')
 return patch
}
export const generatedAnalysis=patch=>reportSections.filter(([key])=>patch?.analysis?.[key]).map(([key,label])=>`### ${label}\n\n${patch.analysis[key]}`).join('\n\n')
export const generatedPreview=patch=>[patch?.summary?`## 本轮结论\n\n${patch.summary}`:'',generatedAnalysis(patch)].filter(Boolean).join('\n\n')
