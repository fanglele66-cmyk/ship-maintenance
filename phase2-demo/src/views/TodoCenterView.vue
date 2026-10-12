<template>
  <div class="p2-todo-center">
    <div v-if="!store.selectedTodoId" class="p2-todo-list">
      <div class="p2-todo-list-head"><h2>待办中心</h2><div class="p2-todo-tools"><input v-model="query" type="search" placeholder="搜索待办 / 设备" aria-label="搜索待办或设备" /><select v-model="filter" aria-label="筛选处理状态"><option value="all">全部状态</option><option value="active">未处理</option><option value="closed">已处理</option></select><button class="p2-secondary" @click="reset">重置体验</button></div></div>
      <section class="todo-ai-summary"><header><strong>AI 待办研判</strong><span>{{ activeTodos.length }} 项待跟进 · {{ store.taskPortfolio.length-activeTodos.length }} 项已处理</span></header>
        <MarkdownContent :content="todoMarkdown" />
      </section>
      <template v-for="group in groups" :key="group.title"><section v-if="group.items.length"><div class="p2-list-intro"><strong>{{ group.title }}</strong><span>{{ group.items.length }} 项</span></div>
        <div class="p2-todo-grid"><button v-for="todo in group.items" :key="todo.id" class="p2-todo-card" :class="[todo.id, {'is-priority':group.title==='优先处理'}]" @click="openTodo(todo.id)">
          <div class="p2-card-top"><span class="p2-badge" :class="closed(todo)?'blue':todo.id==='fault'||todo.id==='drift'&&store.progress.drift>=2?'red':'blue'">{{ cardType(todo) }}</span><span class="p2-card-state">{{ closed(todo)?'已处理':'未处理' }}</span></div>
          <strong>{{ cardTitle(todo) }}</strong><p>{{ summary(todo) }}</p><p class="todo-owner">负责人：{{ store.assignments[todo.id]?.owner || todo.owner }}</p><div class="p2-card-foot"><span>{{ todo.device }}</span><span>{{ closed(todo)?'查看详情':'继续处理' }} →</span></div>
        </button></div>
      </section></template>
      <div v-if="!groups.some(group=>group.items.length)" class="p2-empty">暂无符合条件的待办</div>
      <div class="p2-list-jump"><button class="p2-secondary" @click="router.push('/situation')">查看设备态势 →</button></div>
    </div>
    <template v-else><TodoDetail /><Phase2Assistant mode="todo" /></template>
  </div>
</template>
<script setup>
import MarkdownContent from '@/components/MarkdownContent.vue'
import { todoBrief } from '@/mock/captainAssessments'
import { computed,ref,watch } from 'vue'
import { useRouter,useRoute } from 'vue-router'
import { usePhase2DemoStore } from '@/stores/phase2DemoStore'
import TodoDetail from './TodoDetailPad.vue'
import Phase2Assistant from '@/components/Phase2Assistant.vue'
const route=useRoute(),router=useRouter(),store=usePhase2DemoStore(),query=ref(''),filter=ref('all')
function closed(todo){return store.isTaskHandled(todo.id)}
function cardTitle(todo){return todo.id==='drift'&&store.progress.drift>=2?todo.eventTitle:todo.initialTitle}
function cardType(todo){return todo.id==='drift'&&store.progress.drift>=2?'故障/异常事件的排查与处置':todo.cardType}
function summary(todo){return closed(todo)?'本轮检查、处置与验收已提交；持续效果在设备态势跟踪，案例材料按来源事件自动汇集。':todo.stages[store.progress[todo.id]].summary}
const activeTodos=computed(()=>store.taskPortfolio.filter(todo=>!closed(todo)))
const todoMarkdown=computed(()=>{
 const report=todoBrief(store)
 return `**当前结论**\n\n${report.overview} ${report.priority}\n\n**原因与进展**\n\n${report.reason}\n\n${report.bottleneck}\n\n**下一步建议**\n\n${report.next}`
})
function openTodo(id){store.selectTodo(id);router.push({path:'/event',query:{todo:id}})}
watch(()=>route.query.todo,id=>{if(id&&store.todoCreated[id])store.selectTodo(id);else store.closeTodo()},{immediate:true})
const groups=computed(()=>{const items=store.taskPortfolio.filter(todo=>(cardTitle(todo)+todo.device+cardType(todo)).includes(query.value.trim())&&(filter.value==='all'||(filter.value==='closed')===closed(todo)));return[{title:'优先处理',items:items.filter(todo=>todo.id==='fault'&&!closed(todo))},{title:'待办',items:items.filter(todo=>todo.id!=='fault'&&!closed(todo))},{title:'已处理',items:items.filter(closed)}]})
function reset(){store.resetDemo();query.value='';filter.value='all'}
</script>
<style scoped>
.p2-todo-tools{display:flex;gap:9px;align-items:center}.p2-todo-tools input,.p2-todo-tools select{border:1px solid #dce4ef;border-radius:6px;background:#fff;padding:9px 10px;color:#61738b;font-size:12px}.p2-todo-tools input{width:210px}.p2-todo-list-head h2{font-size:21px}.p2-todo-card{min-height:180px}
.todo-ai-summary{padding:20px 24px;border:1px solid #dce4ef;border-radius:12px;background:#fff;margin:16px 0 24px;font-size:14px;line-height:1.8}.todo-ai-summary header{display:flex;justify-content:space-between}.todo-ai-summary header strong{font-size:17px}.todo-ai-summary header span{color:#7a8595}.todo-ai-summary button{display:flex;width:100%;text-align:left;justify-content:space-between;gap:20px;background:none;border:0;border-top:1px solid #edf0f5;padding:13px 0;cursor:pointer;color:#425169;font:inherit}.todo-owner{color:#68768a!important}
.todo-assessment{font-size:15px;line-height:1.9;color:#33465e;margin:14px 0 20px}.todo-analysis-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:16px}.todo-analysis-grid article{border:1px solid #e3e9f1;border-radius:8px;padding:16px;background:#fafbfd}.assessment-heading{display:flex;gap:12px;justify-content:space-between;align-items:start}.assessment-heading span{color:#54789c;font-size:12px;white-space:nowrap}.todo-analysis-grid p{color:#52647b;line-height:1.85;margin:12px 0}.todo-analysis-grid p b{display:block;color:#34465f;font-size:13px;margin-bottom:3px}.todo-analysis-grid footer{display:flex;align-items:center;justify-content:space-between;border-top:1px solid #e6ebf2;padding-top:10px;color:#6b7b8f;font-size:13px}.todo-ai-summary .p2-link-button{width:auto;border:0;padding:2px 0;color:#2673c9;font-size:13px}.todo-coordination{margin-top:18px;padding-top:14px;border-top:1px solid #e6ebf2}.todo-coordination p{margin:6px 0 0;color:#52647b}
.summary-status{display:flex;gap:24px;color:#6d7d91;font-size:13px}.todo-ai-summary{padding:16px 22px}.todo-assessment{margin:8px 0 12px}
</style>
