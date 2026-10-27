<template>
  <section class="p2-feedback-record">
    <h3>{{ message.title }}</h3><p class="p2-record-meta">任务：{{ message.task }}<br v-if="message.actor">{{ message.actor ? '反馈人：'+message.actor : '' }}<br>反馈时间：{{ message.submittedAt || message.at }}</p>
    <div v-for="(record,i) in message.records" :key="i" class="p2-record-row"><b>{{ record.label }}</b><p>反馈：{{ record.result }}</p><p v-if="record.note">备注：{{ record.note }}</p><p v-if="record.attachments?.length">附件：{{ record.attachments.join('、') }}</p></div>
    <template v-if="message.kind==='recordDraft'"><p class="p2-dialog-question">{{ message.cancelled?'此份记录已取消或由后续补充更新。':message.confirmed?'以上反馈已确认记录。':readOnly?'以上是整理的待确认记录，请在左侧对应工作区核对并提交。':message.canAdvance?(message.destination==='observe'?'以上是我整理的措施与验收结果，是否确认记录并完成本轮人工处理？':'以上是我整理的现场反馈，是否确认记录并继续下一阶段？如有遗漏，可以直接补充。'):'以上是我整理的现场反馈，是否确认保存？仍需补齐本轮检查或验收结果后再推进。' }}</p><button v-if="!readOnly&&!message.confirmed&&!message.cancelled" class="p2-secondary" @click="$emit('confirm-record')">确认以上记录</button></template>
  </section>
</template>
<script setup>
defineProps({message:{type:Object,required:true},readOnly:Boolean})
defineEmits(['confirm-record'])
</script>
