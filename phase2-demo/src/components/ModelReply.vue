<template>
 <section class="model-reply">
  <small class="model-caption">AI检修助手</small>
  <MarkdownContent v-if="message.text" :content="message.text"/>
  <small v-if="message.status==='streaming'" class="generation-status" role="status"><span class="generation-dot"/>{{message.progress?.label||'正在生成内容…'}}</small>
  <details v-if="message.progressLog?.length" class="processing-summary"><summary>分析摘要与处理进度</summary><ol><li v-for="(item,i) in message.progressLog" :key="i">{{item.label}}<p v-if="item.summary">{{item.summary}}</p></li></ol></details>
  <section v-if="message.taskDraft||message.taskChange" class="report-proposal task-change">
   <strong>{{message.taskChange?'待派任务已更新':message.status==='streaming'?'任务修改中':'任务修改中断'}}</strong>
   <p class="report-prose">{{(message.taskChange||message.taskDraft).scope}}</p><p class="proposal-hint">{{(message.taskChange||message.taskDraft).rationale}}</p>
   <ol v-if="message.taskChange"><li v-for="step in message.taskChange.steps" :key="step.label">{{step.label}}</li></ol>
   <button v-if="message.taskChange" type="button" @click="$emit('plan')">查看待派任务 →</button>
  </section>
  <details v-if="message.sources?.length" class="model-sources"><summary>参考资料 · {{message.sources.length}} 处</summary><article v-for="source in message.sources" :key="source.id"><b>[{{source.id}}] {{source.title}}</b><small>{{source.file}} · L{{source.startLine}}—{{source.endLine}}</small><p>{{source.text}}</p></article></details>
  <section v-if="reportContent" class="report-proposal" :aria-busy="message.status==='streaming'">
   <strong>报告补充 · {{message.proposal?(message.proposal.applied?'已写入':'待核对'):message.status==='streaming'?'生成中':'生成中断'}}</strong><p>{{reportContent.reportTitle}}</p>
   <details><summary>查看原报告</summary><MarkdownContent :content="reportContent.baseMarkdown"/></details>
   <template v-if="reportContent.patch.summary"><h4>修订后的结论</h4><p class="report-prose">{{reportContent.patch.summary}}</p></template>
   <div v-if="message.draft" class="streaming-analysis"><section v-for="section in draftSections" :key="section.key"><h4>{{section.label}}</h4><p class="report-prose">{{section.text}}</p></section></div>
   <details v-else><summary>查看修订后的分析</summary><MarkdownContent :content="revisionAnalysis(message.proposal.patch)"/></details>
   <template v-if="message.proposal">
    <p class="proposal-hint">确认后更新结论与分析，原始逐项记录和历次版本保留。</p>
    <button v-if="!message.proposal.applied" type="button" @click="$emit('apply',message.id)">确认补充并更新报告</button>
    <button v-else type="button" @click="$emit('report',message.proposal.reportId)">查看更新后的报告 →</button>
   </template>
  </section>
  <small v-if="message.usage" class="model-usage">Token：输入 {{message.usage.inputTokens}} · 输出 {{message.usage.outputTokens}}</small>
 </section>
</template>
<script setup>
import MarkdownContent from './MarkdownContent.vue'
import {computed} from 'vue'
import {revisionAnalysis} from '../workflow/reportRevisions'
const props=defineProps({message:{type:Object,required:true}})
const reportContent=computed(()=>props.message.proposal||props.message.draft)
const draftSections=computed(()=>[['evidence','证据与范围核对'],['interpretation','原因解释与措施判断'],['unverified','待核实事项'],['next','建议处置']].map(([key,label])=>({key,label,text:props.message.draft?.patch.analysis?.[key]})).filter(section=>section.text))
defineEmits(['apply','report','plan'])
</script>
<style scoped>
.processing-summary{font-size:12px;line-height:1.65;color:#8390a0;margin:8px 0}.processing-summary summary{cursor:pointer}.processing-summary ol{padding-left:18px}.processing-summary p{margin:3px 0 8px;white-space:pre-wrap}
.model-reply{font-size:13px;line-height:1.7}.model-caption{font-size:11px;color:#9a7a44}.model-reply :deep(.markdown-content){--wb-body:13px;font-size:13px;line-height:1.75}.model-sources{font-size:12px;color:#758499;margin:10px 0}.model-sources summary,.report-proposal summary{cursor:pointer}.model-sources article{margin:10px 0;border-left:1px solid #dce3ec;padding-left:10px}.model-sources small{display:block;overflow-wrap:anywhere}.model-sources p{font-size:12px;max-height:180px;overflow:auto;white-space:pre-wrap}.report-proposal{padding:13px;margin:12px 0;background:#faf8f3;border:1px solid #e9dfce;border-radius:6px}.report-proposal>strong{color:#8b6b36}.report-proposal h4{font-size:13px}.report-proposal details{margin:10px 0;font-size:12px}.report-proposal button{border:1px solid #bea77c;border-radius:5px;padding:8px 10px;background:white;color:#806133;cursor:pointer;font:inherit;font-size:12px}.proposal-hint,.model-usage{color:#8995a4;font-size:11px}
.report-prose{white-space:pre-wrap;overflow-wrap:anywhere}.generation-status{display:flex;align-items:center;gap:6px;color:#8995a4;font-size:11px;margin:8px 0}.generation-dot{width:5px;height:5px;border-radius:50%;background:#b5945a;animation:generating 1s ease-in-out infinite}.streaming-analysis{font-size:12px;color:#758499}.streaming-analysis h4{font-size:12px;font-weight:500}@keyframes generating{50%{opacity:.3}}@media(prefers-reduced-motion:reduce){.generation-dot{animation:none}}
</style>
