<template>
 <div class="p2-todo-center"><div class="p2-todo-list">
  <div class="p2-todo-list-head"><h2>待办中心</h2><div class="p2-todo-tools"><input v-model="query" type="search" placeholder="搜索待办 / 设备" aria-label="搜索待办或设备"/><select v-model="filter" aria-label="待办状态"><option value="">全部待办</option><option v-if="captain" value="decision">待我决策</option><option value="running">执行中</option></select></div></div>
  <details open class="todo-ai-summary"><summary><strong>AI待办建议</strong><span class="summary-chevron" aria-hidden="true"/></summary>
   <div class="lc-todo-copy"><p>{{summary}}</p><h3>执行优先级</h3><ol><li v-for="e in items.slice(0,3)" :key="e.id"><b>{{e.title}}</b>：{{nextStep(e)}}</li></ol><p v-if="!items.length">当前没有待处理事项。</p><h3>任务执行与提交进度</h3><p>{{progress}}</p><h3>负责人和时限</h3><p v-for="e in items.filter(e=>currentTask(e))" :key="e.id"><b>{{e.title}}</b>：{{currentTask(e).owner}}；安排时限 {{timeText(currentTask(e).deadline)}}。</p><p v-if="!items.some(e=>currentTask(e))">待轮机长明确排查范围、负责人和完成时间。</p></div>
  </details>
  <template v-for="group in groups" :key="group.title"><section v-if="group.items.length"><div class="p2-list-intro"><strong>{{group.title}}</strong><span>{{group.items.length}} 项</span></div><div class="p2-todo-grid">
   <button v-for="e in group.items" :key="e.id" class="p2-todo-card" :class="{'is-priority':group.title==='优先处理'}" @click="open(e)"><div class="p2-card-top"><span class="lc-todo-identity"><span class="p2-badge" :class="['报警事件','预警事件'].includes(e.type)?'red':'blue'">{{e.type}}</span><small class="lc-event-number">{{e.number}}</small></span><span class="p2-card-state"><i v-if="e.unread[store.state.role]" class="todo-unread-dot"/>{{e.status}}</span></div><strong>{{e.title}}</strong><p>{{e.reports.at(-1)?.summary||e.brief.conclusion}}</p><p class="todo-owner">负责人：{{pendingDecision(e)?people.captain:currentTask(e)?.owner}}</p><div class="p2-card-foot"><span>{{e.device}}</span><span>{{captain&&pendingDecision(e)?'查看并决策':'继续处理'}} →</span></div></button>
  </div></section></template>
  <p v-if="!filtered.length" class="p2-empty">当前没有符合条件的待办任务。已提交或闭环的事项可在事件中心回看。</p><div class="p2-list-jump"><button class="p2-secondary" @click="router.push('/issues')">查看事件与处置记录 →</button></div>
 </div></div>
</template>
<script setup>
import {computed,ref} from 'vue'
import {useRouter} from 'vue-router'
import {useEventLifecycleStore} from '../stores/eventLifecycleStore'
import {pendingDecision,activeTask,currentTask,timeText,people} from '../workflow/eventLifecycle'
const store=useEventLifecycleStore(),router=useRouter(),query=ref(''),filter=ref(''),captain=computed(()=>store.state.role==='captain')
const items=computed(()=>store.events.filter(e=>captain.value?pendingDecision(e)||activeTask(e):activeTask(e)))
const filtered=computed(()=>items.value.filter(e=>(e.title+e.device+e.number).toLowerCase().includes(query.value.toLowerCase())&&(!filter.value||filter.value==='decision'&&pendingDecision(e)||filter.value==='running'&&activeTask(e))))
const groups=computed(()=>[{title:'优先处理',items:filtered.value.filter(e=>['报警事件','预警事件'].includes(e.type))},{title:captain.value?'异动跟踪与任务跟进':'其他任务',items:filtered.value.filter(e=>!['报警事件','预警事件'].includes(e.type))}])
const summary=computed(()=>captain.value?'当前 '+store.pending.length+' 项事项需要您决策，'+store.tasks.length+' 项已派发任务正在执行。排查和作业报告回交后将重新进入您的待办。':'当前 '+items.value.length+' 项已派发任务。请按完成时限安排现场排查和作业，提交报告后交由轮机长决策。')
const progress=computed(()=>store.tasks.length+' 项执行中；'+store.events.filter(e=>['decision','review'].includes(e.phase)).length+' 项报告已回交待轮机长处置；'+store.events.filter(e=>e.phase==='closed').length+' 项已闭环。')
function nextStep(e){return captain.value&&pendingDecision(e)?e.reports.length?'审阅回交报告，明确下一步处置安排。':'核对提醒依据，决定派发排查或登记误报。':'完成当前'+(currentTask(e)?.kind==='investigation'?'排查':'作业')+'记录并提交报告。'}
function open(e){router.push({path:'/situation/issue/'+e.id,query:{from:'tasks'}})}
</script>
<style scoped>
.p2-todo-tools{display:flex;gap:9px;align-items:center}.p2-todo-tools input,.p2-todo-tools select{border:1px solid #dce4ef;border-radius:6px;background:#fff;padding:9px 10px;color:#61738b;font-size:12px}.p2-todo-tools input{width:210px}.p2-todo-list-head h2{font-size:21px}.p2-todo-card{min-height:180px}
.todo-ai-summary{padding:20px 24px;border:1px solid #dce4ef;border-radius:12px;background:#fff;margin:16px 0 24px;font-size:14px;line-height:1.8}.todo-ai-summary header{display:flex;justify-content:space-between}.todo-ai-summary header strong{font-size:17px}.todo-ai-summary header span{color:#7a8595}.todo-ai-summary button{display:flex;width:100%;text-align:left;justify-content:space-between;gap:20px;background:none;border:0;border-top:1px solid #edf0f5;padding:13px 0;cursor:pointer;color:#425169;font:inherit}.todo-owner{color:#68768a!important}
.todo-assessment{font-size:15px;line-height:1.9;color:#33465e;margin:14px 0 20px}.todo-analysis-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:16px}.todo-analysis-grid article{border:1px solid #e3e9f1;border-radius:8px;padding:16px;background:#fafbfd}.assessment-heading{display:flex;gap:12px;justify-content:space-between;align-items:start}.assessment-heading span{color:#54789c;font-size:12px;white-space:nowrap}.todo-analysis-grid p{color:#52647b;line-height:1.85;margin:12px 0}.todo-analysis-grid p b{display:block;color:#34465f;font-size:13px;margin-bottom:3px}.todo-analysis-grid footer{display:flex;align-items:center;justify-content:space-between;border-top:1px solid #e6ebf2;padding-top:10px;color:#6b7b8f;font-size:13px}.todo-ai-summary .p2-link-button{width:auto;border:0;padding:2px 0;color:#2673c9;font-size:13px}.todo-coordination{margin-top:18px;padding-top:14px;border-top:1px solid #e6ebf2}.todo-coordination p{margin:6px 0 0;color:#52647b}
.summary-status{display:flex;gap:24px;color:#6d7d91;font-size:13px}.todo-ai-summary{padding:16px 22px}.todo-assessment{margin:8px 0 12px}
</style>

<style scoped>
.todo-ai-summary summary{display:flex;align-items:center;gap:16px;list-style:none;cursor:pointer;padding:2px 0;font-size:17px}
.todo-ai-summary summary::-webkit-details-marker{display:none}
.todo-ai-summary time{margin-left:auto;font-size:12px;color:#7a8595;font-weight:400;white-space:nowrap}
.summary-chevron{width:8px;height:8px;border-right:1.5px solid #7a8595;border-bottom:1.5px solid #7a8595;transform:rotate(45deg);margin:0 4px 4px}
.todo-ai-summary[open] .summary-chevron{transform:rotate(225deg);margin-bottom:-4px}
.todo-ai-summary summary:focus-visible{outline:2px solid #b49359;outline-offset:6px;border-radius:3px}
.todo-ai-summary[open] summary{margin-bottom:14px}
</style>

<style scoped>
.todo-ai-summary summary strong{color:#202020;font-size:17px;font-weight:600}
</style>

<style scoped>
.todo-ai-summary[open] summary{margin-bottom:8px}
.todo-ai-summary :deep(.markdown-content h4:first-child){margin-top:0}
.todo-ai-summary :deep(.markdown-content h4){margin:12px 0 4px}
.todo-ai-summary :deep(.markdown-content p){margin:4px 0 10px}
</style>

<style scoped>
.p2-todo-list-head{flex-wrap:wrap;gap:12px}.p2-todo-tools{flex-wrap:wrap;min-width:0}.p2-todo-tools input{max-width:100%}
.todo-unread-dot{display:inline-block;width:7px;height:7px;border-radius:50%;background:#e5484d;margin-right:6px;vertical-align:middle}
</style>

<style scoped>.lc-todo-copy{color:#657b95;font-size:14px;line-height:1.85}.lc-todo-copy h3{color:#344b65;font-size:15px;margin:14px 0 7px}.lc-todo-copy p{margin:7px 0}.lc-todo-copy ol{padding-left:24px}.p2-todo-card>p{display:-webkit-box;-webkit-line-clamp:4;-webkit-box-orient:vertical;overflow:hidden}.p2-todo-list{box-sizing:border-box;background:white;margin:12px;border-radius:8px;width:calc(100% - 24px)}</style>

<style scoped>
.p2-card-top{flex-wrap:wrap;gap:7px}.lc-todo-identity{display:inline-flex;align-items:center;gap:8px;min-width:0}.lc-todo-identity .p2-badge{flex:none}.lc-todo-identity .lc-event-number{display:inline;margin:0;font-size:11px;line-height:1.4;white-space:nowrap}.p2-card-top .p2-card-state{margin-left:auto;white-space:nowrap}
</style>
