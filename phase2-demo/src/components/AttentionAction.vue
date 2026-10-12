<template>
  <section class="p2-attention-action">
    <h4>当前行动 · {{ action.phase }}</h4>
    <p><b>{{ action.required || action.linked ? '需要你：' : '当前安排：' }}</b>{{ action.text }}</p>
    <template v-if="action.linked">
      <p>检查与补证在关联事件中进行，这里不重复填写检查表。</p>
      <button class="p2-primary" type="button" @click="openEvent">进入关联事件 · {{ store.cases[scenario].stages[store.progress[scenario]].label }} →</button>
    </template>
    <button v-else-if="action.decisionRequired && inConversation" class="p2-primary" type="button" @click="$emit('request-inquiry')">在对话中确认安排</button>
    <button v-else-if="action.required && inConversation" class="p2-primary" type="button" @click="$emit('request-inquiry')">在对话中核实 →</button>
    <button v-else-if="action.required && compact && !formOpen" class="p2-primary" type="button" @click="formOpen=true">填写现场核实</button>
    <form v-if="!inConversation && action.required && !action.linked && (!compact || formOpen)" @submit.prevent="submit">
      <p class="p2-action-hint">完成要求：提供现场读数、可比运行工况和现场现象，并确认已经核对。普通对话或留言不自动完成此要求。</p>
      <label>现场排温读数（°C）<input v-model="evidence.reading" type="number" min="0" step="any" required /></label>
      <label>运行工况（转速／负荷及核对时间）<input v-model="evidence.conditions" required /></label>
      <label>现场现象（是否有异响、波动等，可填写未见异常）<textarea v-model="evidence.phenomenon" rows="2" required /></label>
      <label class="p2-action-confirm"><input v-model="evidence.confirmed" type="checkbox" required /> 已核对现场仪表与上述记录</label>
      <button class="p2-primary" type="submit" :disabled="!valid">提交现场核实</button>
    </form>
    <div v-if="feedback && !compact" class="p2-action-receipt"><b>现场核实已提交 · {{ feedback.at }}</b><p>排温 {{ feedback.reading }}°C · {{ feedback.conditions }}</p><p>{{ feedback.phenomenon }}</p><p>该项核实要求已完成，不等于确认设备无故障；系统继续分析。</p></div>
    <p v-if="!action.required && !action.linked">可在右侧助手补充现场信息或追问；留言保留为记录。</p>
  </section>
</template>
<script setup>
import { computed, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { usePhase2DemoStore } from '@/stores/phase2DemoStore'
const props = defineProps({ scenario:String, compact:Boolean, inConversation:Boolean })
defineEmits(['request-inquiry'])
const formOpen = ref(false)
const store = usePhase2DemoStore(), router = useRouter()
const action = computed(() => store.attentionAction(props.scenario))
const feedback = computed(() => store.attentionFeedback[props.scenario])
const evidence = reactive({ reading:'', conditions:'', phenomenon:'', confirmed:false })
const valid = computed(() => evidence.reading !== '' && Number.isFinite(Number(evidence.reading)) && Number(evidence.reading)>=0 && evidence.conditions.trim() && evidence.phenomenon.trim() && evidence.confirmed)
function submit() { if(valid.value) store.submitAttentionFeedback(props.scenario, evidence) }
function openEvent() { store.selectTodo(props.scenario); router.push('/event') }
</script>
<style>
.p2-attention-action{margin:16px 0;padding:18px;border:1px solid #dce7f5;border-radius:10px;background:#f7faff;font-size:13px;line-height:1.7}.p2-attention-action h4{margin:0 0 8px;color:#284b78}.p2-attention-action p{margin:8px 0}.p2-attention-action form{display:grid;gap:12px;margin-top:12px}.p2-attention-action label{display:grid;gap:4px;color:#41556f}.p2-attention-action input:not([type=checkbox]),.p2-attention-action textarea{width:100%;box-sizing:border-box;border:1px solid #cbd9eb;border-radius:6px;padding:8px;background:white;font:inherit}.p2-attention-action .p2-action-confirm{display:flex;align-items:center;gap:8px}.p2-attention-action button{justify-self:start}.p2-attention-action button:disabled{opacity:.45;cursor:not-allowed}.p2-action-hint{color:#66788f}.p2-action-receipt{border-top:1px solid #dce7f5;margin-top:12px;padding-top:12px}
</style>
