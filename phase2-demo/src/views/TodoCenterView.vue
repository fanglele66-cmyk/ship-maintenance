<template>
  <div class="p2-todo-center">
    <div v-if="!store.selectedTodoId" class="p2-todo-list">
      <div class="p2-todo-list-head"><h2>待办中心</h2><div class="p2-todo-tools"><input v-model="query" type="search" placeholder="搜索待办 / 设备" aria-label="搜索待办或设备" /><FormSelect v-model="owner" :options="[{value:'',label:'全部负责人'},...owners.map(name=>({value:name,label:name}))]" placeholder="" aria-label="按负责人查看任务"/><FormSelect v-model="filter" :options="[{value:'all',label:'全部状态'},{value:'active',label:'未处理'},{value:'closed',label:'已处理'}]" placeholder="" aria-label="筛选处理状态"/></div></div>
      <details open class="todo-ai-summary"><summary><strong>AI待办建议</strong><time :datetime="updatedAt.toISOString()">更新于 {{ updateLabel }}</time><span class="summary-chevron" aria-hidden="true"></span></summary>
        <StreamingMarkdown :content="todoMarkdown" :highlights="['证据未齐','冷却系统','保持稳定','主机'].map(text=>({text,tone:'warning'}))" />
      </details>
      <template v-for="group in groups" :key="group.title"><section v-if="group.items.length"><div class="p2-list-intro"><strong>{{ group.title }}</strong><span>{{ group.items.length }} 项</span></div>
        <div class="p2-todo-grid"><button v-for="todo in group.items" :key="todo.id" class="p2-todo-card" :class="[todo.id, {'is-priority':group.title==='优先处理'}]" @click="openTodo(todo.id)">
          <div class="p2-card-top"><span class="p2-badge" :class="closed(todo)?'blue':['报警事件','预警事件'].includes(cardType(todo))?'red':'blue'">{{ cardType(todo) }}</span><span class="p2-card-state">{{ closed(todo)?'已处理':'未处理' }}</span></div>
          <strong>{{ cardTitle(todo) }}</strong><p>{{ summary(todo) }}</p><p class="todo-owner">负责人：{{ store.assignments[todo.id]?.owner || todo.owner }}</p><div class="p2-card-foot"><span>{{ todo.device }}</span><span>{{ closed(todo)?'查看详情':'继续处理' }} →</span></div>
        </button></div>
      </section></template>
      <div v-if="!groups.some(group=>group.items.length)" class="p2-empty">暂无符合条件的已派发任务，可从态势中心审阅事项并安排负责人。</div>
      <div class="p2-list-jump"><button class="p2-secondary" @click="router.push('/situation')">查看设备态势 →</button></div>
    </div>
    <template v-else><TodoDetail /><Phase2Assistant mode="todo" /></template>
  </div>
</template>
<script setup>
import {isMaintenanceWorkflow} from '@/mock/issueRelationships'
import FormSelect from '@/components/forms/FormSelect.vue'
import {issueCatalog} from '@/mock/captainWorkbench'
import StreamingMarkdown from '@/components/StreamingMarkdown.vue'
import { todoBrief } from '@/mock/captainAssessments'
import { computed,ref,watch } from 'vue'
import { useRouter,useRoute } from 'vue-router'
import { usePhase2DemoStore } from '@/stores/phase2DemoStore'
import TodoDetail from './TodoDetailPad.vue'
import Phase2Assistant from '@/components/Phase2Assistant.vue'
const route=useRoute(),router=useRouter(),store=usePhase2DemoStore(),query=ref(''),filter=ref('all'),owner=ref('')
const owners=computed(()=>[...new Set(store.taskPortfolio.map(t=>store.assignments[t.id]?.owner||t.owner).filter(Boolean))])
function closed(todo){return store.isTaskHandled(todo.id)}
function cardTitle(todo){return todo.id==='drift'&&store.progress.drift>=2?todo.eventTitle:todo.initialTitle}
function cardType(todo){return isMaintenanceWorkflow(todo)?'异动跟踪 · 维保评估任务':issueCatalog.find(i=>i.id===todo.id)?.type||todo.cardType}
function summary(todo){return store.completedTasks[todo.id]?.reason||(closed(todo)?'实际措施与现场验收已提交，持续效果与最终闭环在设备态势接续。':todo.stages[store.progress[todo.id]].summary)}

const todoMarkdown=computed(()=>{
 const report=todoBrief(store,owner.value)
 return `### 概况\n\n${report.overview}\n\n${report.bottleneck}\n\n### 建议\n\n${report.suggestionText}\n\n### 原因\n\n${report.reason}`
})
function openTodo(id){store.selectTodo(id);router.push({path:'/event',query:{todo:id}})}
watch(()=>route.query.todo,id=>{if(id&&store.todoCreated[id])store.selectTodo(id);else store.closeTodo()},{immediate:true})
const groups=computed(()=>{const items=store.taskPortfolio.filter(todo=>(!owner.value||(store.assignments[todo.id]?.owner||todo.owner)===owner.value)&&(cardTitle(todo)+todo.device+cardType(todo)).includes(query.value.trim())&&(filter.value==='all'||(filter.value==='closed')===closed(todo)));return[{title:'优先处理',items:items.filter(todo=>['报警事件','预警事件'].includes(todo.cardType)&&!closed(todo))},{title:'待办',items:items.filter(todo=>!['报警事件','预警事件'].includes(todo.cardType)&&!closed(todo))},{title:'已处理',items:items.filter(closed)}]})
const updatedAt=ref(new Date())
const updateLabel=computed(()=>updatedAt.value.toLocaleString('zh-CN',{month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',timeZone:'Asia/Shanghai'}))
watch(todoMarkdown,()=>{updatedAt.value=new Date()})
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
</style>
