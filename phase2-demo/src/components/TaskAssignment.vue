<template>
  <section class="task-assignment" :class="{'is-compact':compact}">
    <template v-if="compact && store.todoCreated[scenario]">
      <div class="assignment-inline"><label>负责人<select :value="assignment.owner" @change="changeOwner($event.target.value)"><option v-for="person in crew" :key="person.id">{{ person.name }}（{{ person.role }}）</option></select></label><span>{{ assignment.type }}</span><span>{{ assignment.due }}</span></div>
      <details><summary>任务要求与指派记录</summary><p>{{ assignment.scope }}</p><p v-if="assignment.collaborator">协作：{{ assignment.collaborator }}</p><small>指派人：{{ assignment.assignedBy }}</small><p v-for="(record,i) in store.assignmentRecords[scenario]" :key="i">{{ record.at }} · {{ record.assignedBy }}指派{{ record.owner }}</p></details>
    </template>
    <template v-else>
    <template v-if="store.todoCreated[scenario] && !editing">
      <div class="assignment-head"><strong>任务安排</strong><button type="button" class="p2-link-button" @click="openAssignment">调整指派</button></div>
      <p>{{ assignment.owner }} · {{ assignment.type }}<span v-if="assignment.collaborator"> · 协作：{{ assignment.collaborator }}</span></p>
      <p>{{ assignment.scope }}</p><small>计划：{{ assignment.due }} · 指派：{{ assignment.assignedBy }}</small>
      <details v-if="store.assignmentRecords[scenario]?.length"><summary>指派记录</summary><p v-for="(record,i) in store.assignmentRecords[scenario]" :key="i">{{ record.at }} · {{ record.assignedBy }}指派{{ record.owner }} · {{ record.type }}<br>{{ record.scope }}</p></details>
    </template>
    <template v-else-if="!store.ignoredSuggestions[scenario] || editing">
      <div class="assignment-head"><strong>{{ store.todoCreated[scenario]?'调整任务安排':'建议安排现场检查' }}</strong></div>
      <p v-if="!store.todoCreated[scenario]">先核实读数与现场现象，检查结果不足以直接确定维修方案。</p>
      <button v-if="!editing && !ignoring" type="button" class="p2-primary" @click="openAssignment">接受建议，安排待办</button>
      <form v-if="editing" @submit.prevent="submit"><label>负责人<select v-model="draft.owner" required><option v-for="person in crew" :key="person.id">{{ person.name }}（{{ person.role }}）</option></select></label><p class="assignment-wide">{{ draft.scope }}</p>
        <details class="assignment-wide"><summary>补充任务安排（可选）</summary><div class="assignment-extra"><label>任务类型<select v-model="draft.type"><option v-for="type in types" :key="type" :disabled="!store.todoCreated[scenario] && ['维修','保养'].includes(type)">{{ type }}</option></select></label>

        <label>协作人员<select v-model="draft.collaborator"><option value="">无需协作</option><option v-for="person in crew.filter(p=>p.name+'（'+p.role+'）'!==draft.owner)" :key="person.id">{{ person.name }}（{{ person.role }}）</option></select></label>
        <label>计划时间<input v-model="draft.due" required /></label>
        <label class="assignment-wide">处理范围与反馈要求<textarea v-model="draft.scope" rows="3" required /></label>
        </div></details><p v-if="error" role="alert">{{ error }}</p>
        <div class="assignment-wide assignment-actions"><button class="p2-primary" type="submit">{{ store.todoCreated[scenario]?'保存指派':'确认建立待办' }}</button><button class="p2-secondary" type="button" @click="cancelAssignment">取消</button></div>
      </form>
      <div v-if="!store.todoCreated[scenario] && !editing" class="assignment-ignore"><button type="button" class="p2-link-button" @click="toggleIgnore">{{ ignoring?'取消忽略':'忽略本次建议' }}</button><form v-if="ignoring" class="ignore-form" @submit.prevent="ignore"><label>决定依据<textarea v-model="reason" required placeholder="请说明本次不安排检查的依据" /></label><button type="submit" class="p2-secondary">确认忽略</button></form></div>
    </template>
    <template v-else><strong>已忽略本次建议</strong><p>{{ store.ignoredSuggestions[scenario].reason }}</p><button type="button" class="p2-link-button" @click="openAssignment">重新安排</button></template>
    </template>
  </section>
</template>
<script setup>
import { computed, reactive, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { usePhase2DemoStore } from '@/stores/phase2DemoStore'
import crew from '@/mock/crew.json'
const props=defineProps({scenario:String,compact:Boolean}), store=usePhase2DemoStore(),router=useRouter()
const assignment=computed(()=>store.assignments[props.scenario]||store.defaultAssignment(props.scenario))
const draft=reactive({...assignment.value}),editing=ref(false),ignoring=ref(false),reason=ref(''),error=ref('')
watch(()=>store.assignmentRequest,id=>{if(id===props.scenario){editing.value=true;store.assignmentRequest=null}}, {immediate:true})
function openAssignment(){editing.value=true;ignoring.value=false}
function cancelAssignment(){editing.value=false}
function toggleIgnore(){ignoring.value=!ignoring.value;editing.value=false}
const types=['现场核实','检测排查','维修','保养']
function changeOwner(owner){store.assignTask(props.scenario,{...assignment.value,owner,collaborator:assignment.value.collaborator===owner?'':assignment.value.collaborator})}
function submit(){error.value='';if(!draft.scope.trim()||!draft.due.trim()||!draft.owner){error.value='请补齐负责人、计划时间与处理要求。';return}if(draft.collaborator===draft.owner){error.value='协作人员不能与负责人相同。';return}const existed=store.todoCreated[props.scenario];if(!existed&&!store.createTodo(props.scenario))return;store.assignTask(props.scenario,{...draft});editing.value=false;if(!existed){store.closeTodo();router.push('/event')}}
function ignore(){if(reason.value.trim()){store.ignoreSuggestion(props.scenario,reason.value.trim());ignoring.value=false}}
</script>
<style scoped>
.task-assignment{padding:18px;background:#f7f9fc;border:1px solid #dce4ee;border-radius:10px;margin:14px 0;font-size:14px;line-height:1.7}.assignment-head{display:flex;justify-content:space-between;align-items:center}.task-assignment p{margin:8px 0}.task-assignment small{color:#738093}.task-assignment form{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:12px}.task-assignment label{display:grid;gap:5px}.task-assignment input,.task-assignment select,.task-assignment textarea{width:100%;box-sizing:border-box;padding:9px;border:1px solid #cfd7e3;border-radius:6px;background:#fff;font:inherit}.assignment-wide{grid-column:1/-1}.assignment-actions{display:flex;gap:10px}.assignment-ignore{margin-top:12px}.assignment-ignore form{display:grid;grid-template-columns:1fr;gap:12px}.assignment-ignore form button{justify-self:start}.task-assignment form p{margin:0}.task-assignment details{margin-top:10px}.task-assignment summary{cursor:pointer}@media(max-width:700px){.task-assignment form{grid-template-columns:1fr}}
.is-compact{padding:10px 16px;margin:8px 0 14px;background:#fff}.assignment-inline{display:flex;align-items:center;gap:20px;flex-wrap:wrap}.assignment-inline label{display:flex;align-items:center;gap:8px}.assignment-inline select{width:auto;padding:5px 9px}.assignment-inline>span{color:#738093;font-size:13px}.is-compact details{font-size:13px}.assignment-extra{display:grid;grid-template-columns:1fr 1fr;gap:12px;padding-top:12px}
</style>
