<template>
  <div class="p2-message" :class="[message.role, {'is-daily-push':daily}]" :data-stage-id="message.stageId" :data-demo="Boolean(message.demoLabel)" :data-message-type="type">
    <span v-if="message.role==='assistant'" class="p2-avatar">✦</span>
    <div class="p2-bubble">
      <small v-if="daily" class="p2-push-date">{{ message.at }}</small>
      <span v-if="message.demoLabel" class="p2-demo-label" :class="{'is-change':message.demoLabel.includes('新证据') || message.demoLabel.includes('行动提醒')}">{{ message.demoLabel }}</span>
      <TaskReceiptMessage v-if="type==='taskReceipt'" :message="message" @action="$emit('action',$event)" />
      <SceneMessage v-else-if="['dailyBrief','notice','report'].includes(type)" :message="message" :daily="daily" :expanded="expanded" :disabled-actions="disabledActions" @action="$emit('action',$event)" />
      <FeedbackRecordMessage v-else-if="type==='feedbackRecord'" :message="message" @confirm-record="$emit('confirm-record')" />
      <InquiryMessage v-else-if="type==='inquiry'" :message="message" @submit-inquiry="$emit('submit-inquiry',$event)" @update-inquiry="$emit('update-inquiry',$event)" />
      <p v-else>{{ message.text }}</p>
      <slot name="actions" />
      <small v-if="!daily">{{ message.at }}</small>
    </div>
  </div>
</template>
<script setup>
import { computed } from 'vue'
import SceneMessage from './SceneMessage.vue'
import TaskReceiptMessage from './TaskReceiptMessage.vue'
import FeedbackRecordMessage from './FeedbackRecordMessage.vue'
import InquiryMessage from './InquiryMessage.vue'
import { messageType } from '@/message-flows/resolveMessageFlow'
const props=defineProps({message:{type:Object,required:true},expanded:Boolean,disabledActions:{type:Array,default:()=>[]}})
defineEmits(['action','confirm-record','submit-inquiry','update-inquiry'])
const type=computed(()=>messageType(props.message))
const daily=computed(()=>type.value==='dailyBrief')
</script>
