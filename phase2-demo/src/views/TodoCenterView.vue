<template>
  <div class="p2-todo-center">
    <div v-if="!store.selectedTodoId" class="p2-todo-list">
      <div class="p2-todo-list-head"><h2>待办中心</h2><div class="p2-todo-tools"><input v-model="query" type="search" placeholder="搜索待办 / 设备" aria-label="搜索待办或设备" /><select v-model="filter" aria-label="筛选处理状态"><option value="all">全部状态</option><option value="active">未处理</option><option value="closed">已处理</option></select><button class="p2-secondary" @click="reset">重置模拟数据</button></div></div>
      <template v-for="group in groups" :key="group.title"><section v-if="group.items.length"><div class="p2-list-intro"><strong>{{ group.title }}</strong><span>{{ group.items.length }} 项</span></div>
        <div class="p2-todo-grid"><button v-for="todo in group.items" :key="todo.id" class="p2-todo-card" :class="todo.id" @click="store.selectTodo(todo.id)">
          <div class="p2-card-top"><span class="p2-badge" :class="closed(todo)?'blue':todo.id==='fault'||todo.id==='drift'&&store.progress.drift>=2?'red':'blue'">{{ cardType(todo) }}</span><span class="p2-card-state">{{ closed(todo)?'已处理':'未处理' }}</span></div>
          <strong>{{ cardTitle(todo) }}</strong><p>{{ summary(todo) }}</p><div class="p2-card-foot"><span>{{ todo.device }}</span><span>{{ closed(todo)?'查看详情':'继续处理' }} →</span></div>
        </button></div>
      </section></template>
      <div v-if="!groups.some(group=>group.items.length)" class="p2-empty">暂无符合条件的待办</div>
      <div class="p2-list-jump"><button class="p2-secondary" @click="router.push('/situation')">查看设备态势 →</button></div>
    </div>
    <template v-else><TodoDetail /><Phase2Assistant mode="todo" /></template>
  </div>
</template>
<script setup>
import { computed,ref } from 'vue'
import { useRouter } from 'vue-router'
import { usePhase2DemoStore } from '@/stores/phase2DemoStore'
import TodoDetail from './TodoDetailPad.vue'
import Phase2Assistant from '@/components/Phase2Assistant.vue'
const router=useRouter(),store=usePhase2DemoStore(),query=ref(''),filter=ref('all')
function closed(todo){return store.isTaskHandled(todo.id)}
function cardTitle(todo){return todo.id==='drift'&&store.progress.drift>=2?todo.eventTitle:todo.initialTitle}
function cardType(todo){return todo.id==='drift'&&store.progress.drift>=2?'故障/异常事件的排查与处置':todo.cardType}
function summary(todo){return closed(todo)?'本轮检查、处置与验收已提交；持续效果在设备态势跟踪，案例材料按来源事件自动汇集。':todo.stages[store.progress[todo.id]].summary}
const groups=computed(()=>{const items=store.visibleTodos.filter(todo=>(cardTitle(todo)+todo.device+cardType(todo)).includes(query.value.trim())&&(filter.value==='all'||(filter.value==='closed')===closed(todo)));return[{title:'优先处理',items:items.filter(todo=>todo.id==='fault'&&!closed(todo))},{title:'待办',items:items.filter(todo=>todo.id!=='fault'&&!closed(todo))},{title:'已处理',items:items.filter(closed)}]})
function reset(){store.resetDemo();query.value='';filter.value='all'}
</script>
<style scoped>
.p2-todo-tools{display:flex;gap:9px;align-items:center}.p2-todo-tools input,.p2-todo-tools select{border:1px solid #dce4ef;border-radius:6px;background:#fff;padding:9px 10px;color:#61738b;font-size:12px}.p2-todo-tools input{width:210px}.p2-todo-list-head h2{font-size:21px}.p2-todo-card{min-height:180px}
</style>

