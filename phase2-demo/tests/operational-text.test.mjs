import test from 'node:test'
import assert from 'node:assert/strict'
import {operationalText} from '../src/workflow/operationalText.js'
import {generatedPreview} from '../src/workflow/generatedReport.js'
import {decisionAnalysisItems} from '../src/workflow/lifecycleAnalysis.js'
import {reportMarkdown} from '../src/workflow/reportPresentation.js'

test('legacy wording is omitted without removing findings or real evidence limitations',()=>{
 const facts='未拆检全部滤器，高负荷未覆盖。具体原因未确认，现场照片未上传。'
 assert.equal(operationalText('练习记录：'+facts),facts)
 assert.equal(operationalText('【虚构演示】'+facts+'附图仅为AI演示图，不能作为现场证据。'),facts)
 assert.equal(operationalText(facts+'所述图片为 AI 生成示意样例，不作本轮现场证据。'),facts)
 assert.equal(operationalText('附图缺少拍摄时间，不能作为现场证据。'),'附图缺少拍摄时间，不能作为现场证据。')
 assert.equal(operationalText('试验尚未实施，等待许可。'),'试验尚未实施，等待许可。')
 assert.equal(operationalText('所述图片为 AI 生成示意样例，不作本轮现场证据；剩余线束段未查，高负荷试验未实施。'),'剩余线束段未查，高负荷试验未实施。')
 assert.equal(operationalText('图片为 AI 生成示意图，实际现场未上传照片，旧件尚未送检。'),'实际现场未上传照片，旧件尚未送检。')
})

test('analysis views omit asset framing but raw records and stored reports are preserved',()=>{
 const raw='原始照片说明：所述图片为 AI 生成示意样例，不作本轮现场证据。'
 const facts='高负荷尚未覆盖，具体原因未确认。'
 const analysis=facts+'附图仅为AI演示图，不能作为现场证据。'
 const report={markdown:'# 排查报告\n\n## 现场事实\n\n'+raw+'\n\n### 未执行与待核实事项\n\n'+analysis,analysisMarkdown:'### 未执行与待核实事项\n\n'+analysis}
 const before=structuredClone(report),display=reportMarkdown(report)
 assert.match(display,new RegExp(raw))
 assert.doesNotMatch(display,/附图仅为AI演示图/)
 assert.match(display,new RegExp(facts))
 assert.equal(reportMarkdown({...report,markdown:display}),display)
 assert.deepEqual(report,before)
 const items=decisionAnalysisItems({tracking:false},{kind:'investigation',records:[]},report)
 assert.equal(items[0].text,facts)
 const patch={summary:'已整理现场记录。',analysis:{unverified:analysis}}
 const previous=structuredClone(patch),preview=generatedPreview(patch)
 assert.match(preview,new RegExp(facts));assert.doesNotMatch(preview,/演示/)
 assert.deepEqual(patch,previous)
})
