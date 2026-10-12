<template>
  <section class="event-work-order-link">
    <div class="work-order-heading"><h3>关联船管工单</h3><span>{{ info.linked?'已关联':'AI 推荐 · 待用户确认' }}</span></div>
    <p v-if="info.loading">正在读取已有工单…</p>
    <div v-else-if="info.error"><p role="alert">{{ info.error }}</p><button class="p2-secondary" @click="orders.load(eventId)">重试</button></div>
    <template v-else-if="candidate">
      <div class="work-order-title"><b>{{ candidate.title }}</b><span>{{ candidate.id }} · {{ candidate.status }}</span></div>
      <dl class="work-order-facts"><div><dt>设备与部位</dt><dd>{{ candidate.device }}</dd></div><div><dt>作业范围</dt><dd>{{ candidate.scope }}</dd></div><div><dt>计划窗口</dt><dd>{{ candidate.plannedWindow }}</dd></div><div><dt>匹配说明</dt><dd>{{ candidate.reason }}</dd></div><div><dt>数据来源</dt><dd>{{ info.source }} · {{ syncTime }}</dd></div></dl>
      <p v-if="info.linked&&info.pendingId!==info.linked.id" class="work-order-notice">待确认更换：当前仍关联 {{ info.linked.id }}，确认后才替换关联。</p>
      <div v-if="!core.isTaskHandled(eventId)" class="work-order-buttons"><button class="p2-primary" :disabled="info.linked?.id===candidate.id" @click="confirm">{{ info.linked?'确认更换关联':'确认关联' }}</button><button class="p2-secondary" @click="selectorOpen=!selectorOpen">更换工单</button></div>
      <div v-if="selectorOpen" class="work-order-candidates" role="group" aria-label="候选船管工单"><p>选择一笔已有工单，再确认关联。工单内容只读。</p><button v-for="order in info.orders" :key="order.id" type="button" :class="{selected:info.pendingId===order.id}" :aria-pressed="info.pendingId===order.id" @click="select(order.id)"><b>{{ order.title }}</b><span>{{ order.id }} · {{ order.status }} · {{ order.plannedWindow }}</span><p>{{ order.scope }}</p></button></div>
      <p v-if="notice" role="status">{{ notice }}</p>
      <p class="work-order-limit">关联仅记录本次选择，不修改原工单内容，不代表工单已变更或现场已执行。</p>
      <details v-if="info.records.length"><summary>工单选择记录 · {{ info.records.length }} 条</summary><div v-for="record in info.records" :key="record.id" class="work-order-record"><b>{{ record.action }} · {{ record.orderId }}</b><time>{{ record.at }}</time><p>{{ record.title }}{{ record.previousId?'；此前关联 '+record.previousId:'' }}</p></div></details>
    </template>
    <p v-else>当前接口未返回候选工单。</p>
  </section>
</template>
<script setup>
import { computed, onMounted, ref } from 'vue'
import { useEventWorkOrderStore } from '@/stores/eventWorkOrderStore'
import { usePhase2DemoStore } from '@/stores/phase2DemoStore'
const props=defineProps({eventId:{type:String,required:true}})
const orders=useEventWorkOrderStore(),core=usePhase2DemoStore(),selectorOpen=ref(false),notice=ref('')
const info=computed(()=>orders.state(props.eventId)),candidate=computed(()=>info.value.orders.find(order=>order.id===info.value.pendingId)||info.value.linked)
const syncTime=computed(()=>info.value.syncedAt?new Date(info.value.syncedAt).toLocaleString('zh-CN',{timeZone:'Asia/Shanghai'}):'未读取')
onMounted(()=>orders.load(props.eventId))
function select(id){orders.choose(props.eventId,id);selectorOpen.value=false;notice.value='已选择候选，请确认关联。'}
function confirm(){if(orders.confirm(props.eventId)){notice.value='关联已确认，原工单保持不变。';selectorOpen.value=false}}
</script>
<style scoped>
.event-work-order-link{margin:20px 0;padding:20px;border:1px solid #e8ebf1;border-radius:8px;line-height:1.7;color:#303744}.work-order-heading{display:flex;justify-content:space-between;gap:16px;align-items:center}.work-order-heading h3{font-size:16px;margin:0}.work-order-heading>span{font-size:12px;color:#947448}.work-order-title{display:flex;gap:16px;flex-wrap:wrap;align-items:baseline;margin:16px 0}.work-order-title b{font-size:16px}.work-order-title span,.work-order-limit{font-size:12px;color:#7a818d}.work-order-facts{display:grid;gap:8px;margin:0;font-size:13px}.work-order-facts>div{display:grid;grid-template-columns:90px minmax(0,1fr);gap:12px}.work-order-facts dt{color:#7a818d}.work-order-facts dd{margin:0}.work-order-buttons{display:flex;gap:10px;margin:18px 0}.work-order-candidates>button{display:block;width:100%;background:#fff;border:1px solid #e8ebf1;border-radius:6px;text-align:left;padding:12px;margin:8px 0;font:inherit;cursor:pointer}.work-order-candidates>button.selected{border-color:#b7935a;background:#faf8f3}.work-order-candidates span{display:block;font-size:12px;color:#7a818d;margin:4px 0}.work-order-candidates p,.work-order-record p{font-size:13px;margin:4px 0}.work-order-record{padding:12px 0;border-bottom:1px solid #ebeef5;font-size:13px}.work-order-record time{display:block;font-size:12px;color:#7a818d}.event-work-order-link details summary{cursor:pointer;color:#947448;font-size:13px}.work-order-notice{color:#947448;font-size:13px}button:focus-visible,summary:focus-visible{outline:2px solid #b7935a;outline-offset:2px}
</style>
