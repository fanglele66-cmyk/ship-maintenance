export const reportSections=[['evidence','现场记录摘要'],['interpretation','原因与措施判断'],['unverified','未执行与待核实事项'],['next','AI建议']]
export function validateGeneratedReport(patch){
 if(typeof patch?.summary!=='string'||!patch.summary.trim()||reportSections.some(([key])=>typeof patch.analysis?.[key]!=='string'||!patch.analysis[key].trim()))throw Error('报告内容不完整，请重试生成；原填写记录已保留。')
 return patch
}
export const generatedAnalysis=patch=>reportSections.filter(([key])=>key!=='evidence'&&patch?.analysis?.[key]).map(([key,label])=>`### ${label}\n\n${operationalText(patch.analysis[key])}`).join('\n\n')
export const generatedPreview=patch=>[patch?.summary?`## 本轮结论\n\n${operationalText(patch.summary)}`:'',generatedAnalysis(patch)].filter(Boolean).join('\n\n')
import {operationalText} from './operationalText.js'
