<template>
  <div class="maintenance-arrangement">
    <h4>{{ plan.title }}</h4>
    <dl><div><dt>维护部件</dt><dd>{{ plan.device }}</dd></div><div><dt>正式计划</dt><dd>{{plan.status}}</dd></div><div><dt>周期依据</dt><dd>{{plan.basis}}</dd></div><div><dt>实施条件</dt><dd>{{plan.note}}</dd></div></dl>
    <dl class="arrangement-source"><div><dt>数据来源</dt><dd>尚未取得正式周期数据</dd></div><div><dt>接口读取时间</dt><dd>{{ syncTime }}</dd></div><div><dt>正式工单</dt><dd>{{ info.linked ? info.linked.id : info.orders.length ? '待人员确认关联' : '未取得候选工单' }}</dd></div><div><dt>工单来源</dt><dd>{{ info.source || '正在读取' }}</dd></div></dl>
    <div v-if="info.linked" class="arrangement-linked"><b>{{ info.linked.title }}</b><p>执行状态：{{ info.linked.status }}</p><p>作业范围：{{ info.linked.scope }}</p><p>原计划窗口：{{ info.linked.plannedWindow }}</p></div>
    <p>尚未取得正式周期数据，不计算计划进度或剩余寿命。正式工单内容及状态只读，选择确认在关联事件中进行。</p>
  </div>
</template>
<script setup>
import { computed, onMounted } from 'vue'
import { useEventWorkOrderStore } from '@/stores/eventWorkOrderStore'
const props=defineProps({plan:{type:Object,required:true}})
const orders=useEventWorkOrderStore(),info=computed(()=>orders.state('drift'))
const syncTime=computed(()=>info.value.syncedAt?new Date(info.value.syncedAt).toLocaleString('zh-CN',{timeZone:'Asia/Shanghai'}):'正在读取')
onMounted(()=>orders.load('drift'))
const percent=computed(()=>Math.round(props.plan.currentHours/props.plan.dueHours*100))
</script>
<style scoped>
.maintenance-arrangement h4{font-size:16px;line-height:26px;margin:0 0 18px}.maintenance-arrangement dl{margin:0;display:grid;gap:12px;font-size:14px;line-height:24px}.maintenance-arrangement dl>div{display:grid;grid-template-columns:92px minmax(0,1fr);gap:12px}.maintenance-arrangement dt{color:#7a818d}.maintenance-arrangement dd{margin:0;overflow-wrap:anywhere}.arrangement-period{display:flex;flex-wrap:wrap;justify-content:space-between;gap:8px;margin:22px 0;font-size:12px;color:#7a818d}.arrangement-period b{color:#947448}.arrangement-period progress{width:100%;height:5px;appearance:none;border:0;border-radius:4px;overflow:hidden}.arrangement-period progress::-webkit-progress-bar{background:#eceef1}.arrangement-period progress::-webkit-progress-value{background:#b7935a}.maintenance-arrangement .arrangement-source{padding-top:18px;border-top:1px solid #ebeef5;font-size:13px}.maintenance-arrangement p{font-size:12px;line-height:22px;color:#7a818d;margin:16px 0 0}
.arrangement-linked{border-top:1px solid #ebeef5;padding-top:16px;margin-top:16px}.arrangement-linked b{font-size:14px}
</style>
