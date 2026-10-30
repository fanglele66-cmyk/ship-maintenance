export const reportSections=[['evidence','证据与范围核对'],['interpretation','原因解释与措施判断'],['unverified','待核实事项'],['next','建议处置']]
export function validateGeneratedReport(patch){
 if(typeof patch?.summary!=='string'||!patch.summary.trim()||reportSections.some(([key])=>typeof patch.analysis?.[key]!=='string'||!patch.analysis[key].trim()))throw Error('报告内容不完整，请重试生成；原填写记录已保留。')
 return patch
}
export const generatedAnalysis=patch=>reportSections.filter(([key])=>patch?.analysis?.[key]).map(([key,label])=>`### ${label}\n\n${patch.analysis[key]}`).join('\n\n')
export const generatedPreview=patch=>[patch?.summary?`## 本轮结论\n\n${patch.summary}`:'',generatedAnalysis(patch)].filter(Boolean).join('\n\n')
