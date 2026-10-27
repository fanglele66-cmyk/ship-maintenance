<template>
  <section v-if="eligible||record?.status==='closed'" class="tracking-disposition" aria-label="异动处置决策">
    <header><div><small>轮机长确认</small><h3>{{record?.status==='closed'?'事件闭环结果':'异动处置决策'}}</h3></div><span>{{statusLabel}}</span></header>
    <p>{{summary}}</p>
    <template v-if="record?.status==='closed'">
      <p class="decision-reason">{{record.reason}}</p>
      <dl v-if="record.arrangement"><div><dt>维保责任人</dt><dd>{{record.arrangement.owner}}</dd></div><div><dt>计划窗口</dt><dd>{{record.arrangement.due}}</dd></div><div><dt>实施范围</dt><dd>{{record.arrangement.scope}}</dd></div><div><dt>作业条件安排</dt><dd>{{record.arrangement.conditions}}</dd></div></dl>
      <button v-if="record.taskId" class="p2-secondary" type="button" @click="openTask">查看关联维保任务 →</button>
      <small class="signed">{{record.actor}} · {{record.at}}</small>
    </template>
    <template v-else>
      <div v-if="record?.status==='observing'" class="observation-plan">
        <dl><div><dt>观察负责人</dt><dd>{{record.plan.owner}}</dd></div><div><dt>复核期限</dt><dd>{{record.plan.deadline.replace('T',' ')}}</dd></div><div><dt>关注指标</dt><dd>{{record.plan.metrics}}</dd></div><div><dt>下次判断条件</dt><dd>{{record.plan.criteria}}</dd></div></dl>
        <div class="decision-actions"><button class="p2-primary" @click="openObservationTask">查看观察待办 →</button><button class="p2-secondary" @click="choose('observe')">调整观察计划</button></div>
      </div>
      <template v-else>
        <p v-if="record?.observationResult" class="decision-reason">最新观察：{{record.observationResult.findings}}</p>
        <p v-else-if="record?.status==='review'&&record?.priorProcessId" class="decision-reason">首轮回交：{{record.reason}}</p>
        <div class="decision-actions" aria-label="选择事件处置分支">
          <button class="p2-secondary" :aria-pressed="mode==='explained'" @click="choose('explained')">变化已有解释，确认闭环</button>
          <button class="p2-secondary" :aria-pressed="mode==='maintenance'||mode==='arrange'" @click="choose('maintenance')">形成维保建议</button>
          <button class="p2-secondary" :aria-pressed="mode==='observe'" @click="choose('observe')">补证并继续观察</button>
        </div>
        <div v-if="record?.status==='recommendation'&&mode!=='maintenance'" class="recommendation-preview"><h4>{{record.recommendation.title}}</h4><p>建议依据：{{record.recommendation.reason}}</p><p>建议范围：{{record.recommendation.scope}}</p><button v-if="mode!=='arrange'" class="p2-primary" @click="choose('arrange')">确认维保安排</button></div>
      </template>
      <form v-if="mode" class="decision-form" @submit.prevent="submit">
        <template v-if="mode==='explained'"><h4>确认变化解释</h4><label>变化解释与闭环依据 <em>*</em><textarea v-model="form.reason" required rows="3" placeholder="记录可解释基线变化的工况、调整或校验依据，以及本次核实结论"/></label></template>
        <template v-else-if="mode==='maintenance'"><h4>维保建议</h4><label>建议依据 <em>*</em><textarea v-model="form.reason" required rows="3" placeholder="说明未解释变化、核实发现与需要开展专项检查的原因"/></label><label>建议检查与维护范围 <em>*</em><textarea v-model="form.scope" required rows="3"/></label></template>
        <template v-else-if="mode==='arrange'"><h4>维保安排</h4><div class="form-columns"><label>维保责任人 <em>*</em><select v-model="form.owner" required><option v-for="person in crew" :key="person">{{person}}</option></select></label><label>计划窗口 <em>*</em><input v-model="form.due" required placeholder="例如：下一靠港窗口，完成隔离后安排"/></label></div><label>实施范围 <em>*</em><textarea v-model="form.scope" required rows="3"/></label><label>作业条件安排 <em>*</em><textarea v-model="form.conditions" required rows="2" placeholder="明确校验设备、备料、许可和隔离窗口的落实安排"/></label><p class="form-note">确认后生成关联维保任务并闭环本次异动事件。维保作业、验收与效果观察由任务继续推进。</p></template>
        <template v-else-if="mode==='observe'"><h4>专项观察计划</h4><div class="form-columns"><label>观察负责人 <em>*</em><select v-model="form.owner" required><option v-for="person in crew" :key="person">{{person}}</option></select></label><label>观察期限 <em>*</em><input v-model="form.deadline" type="datetime-local" required/></label></div><label>关注指标 <em>*</em><textarea v-model="form.metrics" required rows="2"/></label><label>下次判断条件 <em>*</em><textarea v-model="form.criteria" required rows="3" placeholder="明确需要覆盖的工况、资料和变化条件，据此决定闭环、维保或延长观察"/></label></template>

        <p v-if="error" role="alert" class="form-error">{{error}}</p>
        <div class="decision-actions"><button class="p2-primary" type="submit">{{submitLabel}}</button><button class="p2-secondary" type="button" @click="mode='';error=''">取消</button></div>
      </form>
      <p v-if="notice" role="status" class="form-success">{{notice}}</p>
    </template>
  </section>
</template>
<script setup>
import {computed,reactive,ref,watch} from 'vue'
import {useRouter} from 'vue-router'
import {usePhase2DemoStore} from '@/stores/phase2DemoStore'
import {trackingDispositionSummary} from '@/mock/trackingDisposition'
import {maintenanceChildIds} from '@/mock/issueRelationships'
import crewMembers from '@/mock/crew.json'
const props=defineProps({scenario:{type:String,required:true}}),store=usePhase2DemoStore(),router=useRouter()
const record=computed(()=>store.trackingDispositions[props.scenario]),eligible=computed(()=>store.canDecideTracking(props.scenario))
const summary=computed(()=>trackingDispositionSummary(record.value)||'结合核实结论确认本次事件的处理方向。'),statusLabel=computed(()=>({closed:'已闭环',observing:'专项观察中',recommendation:'待确认安排',review:'待轮机长确认'}[record.value?.status]||'待轮机长确认'))
const crew=crewMembers.filter(person=>person.role!=='轮机长').map(person=>person.name+'（'+person.role+'）'),mode=ref(''),error=ref(''),notice=ref('')
const form=reactive({reason:'',scope:'',owner:crew[0],due:'',conditions:'',deadline:'',metrics:'',criteria:'',observedAt:'',findings:''})
const submitLabel=computed(()=>({explained:'确认解释并闭环',maintenance:'生成维保建议',arrange:'确认安排并闭环事件',observe:'保存并派发观察任务'}[mode.value]))
function choose(next){
  mode.value=next;error.value='';notice.value=''
  if(next==='maintenance'){form.reason=record.value?.recommendation?.reason||'';form.scope=record.value?.recommendation?.scope||store.cases[maintenanceChildIds(props.scenario)[0]]?.taskScope||'核对测温链路、历史调整与同工况数据，按现场发现确定专项检查范围。'}
  if(next==='explained')form.reason=''
  if(next==='arrange'){form.scope=record.value.recommendation.scope;const assignment=store.assignments[record.value.recommendation.taskId];form.owner=assignment?.owner||crew[0];form.due='';form.conditions=''}
  if(next==='observe'){Object.assign(form,record.value?.plan||{owner:crew[0],deadline:'',metrics:props.scenario.includes('c4')?'四缸相对其余五缸均值偏差、同刻六缸排温、负荷与转速、独立测温与调整记录':'一缸相对其余五缸均值及逐时最高值偏差、同刻六缸排温、负荷与转速、独立测温与调整记录',criteria:''})}
  if(next==='observe'&&record.value?.status!=='observing')form.deadline=''
}
function submit(){const action=mode.value,result=action==='arrange'?store.confirmTrackingMaintenance(props.scenario,form):store.decideTracking(props.scenario,action,form);if(!result.ok){error.value=result.error;return}mode.value='';error.value='';notice.value=action==='maintenance'?'建议已保存，请确认维保安排。':action==='observe'?'观察任务已派发至待办，已有记录保留，执行人只需提交本轮新增观察。':''}
function openObservationTask(){store.selectTodo(record.value.observationTaskId);router.push({path:'/event',query:{todo:record.value.observationTaskId,parent:props.scenario}})}
function openTask(){store.selectTodo(record.value.taskId);router.push({path:'/event',query:{todo:record.value.taskId,parent:props.scenario}})}
watch(()=>props.scenario,()=>{mode.value='';error.value='';notice.value=''})
</script>
<style scoped>
.tracking-disposition{border:1px solid #dfd4bf;background:#fcfbf8;border-radius:8px;padding:20px;margin:20px 0;color:#445870;font-size:14px;line-height:1.7}.tracking-disposition header{display:flex;justify-content:space-between;gap:16px;align-items:center}.tracking-disposition header small,.tracking-disposition header>span{color:#8b6c36;font-size:12px}.tracking-disposition h3{margin:2px 0;font-size:17px;color:#293d50}.tracking-disposition h4{margin:0 0 12px;font-size:15px}.tracking-disposition p{overflow-wrap:anywhere}.decision-actions{display:flex;gap:10px;flex-wrap:wrap;margin:14px 0 0}.decision-actions button[aria-pressed=true]{border-color:#a88b52;background:#f4edde}.decision-form,.recommendation-preview{border-top:1px solid #e5dfd2;margin-top:18px;padding-top:18px}.decision-form label{display:block;margin-bottom:14px;color:#40536a}.decision-form input,.decision-form textarea,.decision-form select{display:block;width:100%;box-sizing:border-box;border:1px solid #d9e0e8;border-radius:5px;background:white;padding:9px 11px;font:inherit;color:#30465d;margin-top:5px}.decision-form textarea{resize:vertical;min-height:70px}.decision-form em{font-style:normal;color:#bc5346}.form-columns{display:grid;grid-template-columns:1fr 1fr;gap:16px}.form-note,.signed{font-size:12px;color:#7d8797}.signed{display:block;margin-top:12px}.form-error{color:#b43d38}.form-success{color:#417655}dl{margin:12px 0}dl>div{display:grid;grid-template-columns:120px 1fr;gap:15px;padding:8px 0;border-bottom:1px solid #ebe7de}dt{color:#8c7856}dd{margin:0;white-space:pre-wrap;overflow-wrap:anywhere}.decision-reason{white-space:pre-wrap}@media(max-width:650px){.tracking-disposition{padding:16px}.form-columns{grid-template-columns:1fr;gap:0}dl>div{grid-template-columns:1fr;gap:2px}.decision-actions button{max-width:100%;white-space:normal}}
</style>
