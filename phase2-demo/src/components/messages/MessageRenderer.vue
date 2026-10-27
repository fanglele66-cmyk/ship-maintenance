<template>
  <div class="p2-message" :class="[message.role, {'is-daily-push':daily}]" :data-stage-id="message.stageId" :data-demo="Boolean(message.demoLabel)" :data-message-type="type">
    <span v-if="message.role==='assistant'" class="p2-avatar">✦</span>
    <div class="p2-bubble">
      <small v-if="daily" class="p2-push-date">{{ message.at }}</small>
      <span v-if="message.demoLabel" class="p2-demo-label" :class="{'is-change':message.demoLabel.includes('新证据') || message.demoLabel.includes('行动提醒')}">{{ message.demoLabel }}</span>
      <TaskReceiptMessage v-if="type==='taskReceipt'" :message="conversationMessage" @action="ask" />
      <SceneMessage v-else-if="['dailyBrief','notice','report'].includes(type)" :message="conversationMessage" :daily="daily" :expanded="expanded" :disabled-actions="disabledActions" @action="ask" />
      <FeedbackRecordMessage v-else-if="type==='feedbackRecord'" :message="message" read-only />
      <InquiryMessage v-else-if="type==='inquiry'" :message="message" read-only />
      <MarkdownContent v-else-if="message.role==='assistant'" :content="message.text||''"/>
      <p v-else>{{ message.text }}</p>
      <small v-if="message.noteCandidate?.registered">这条补充已登记到跟踪记录</small>
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
import MarkdownContent from '../MarkdownContent.vue'
import { messageType } from '@/message-flows/resolveMessageFlow'
import { conversationAction, conversationActions } from '@/message-flows/conversationActions'
const props=defineProps({message:{type:Object,required:true},expanded:Boolean,disabledActions:{type:Array,default:()=>[]}})
const emit=defineEmits(['action'])
const conversationMessage=computed(()=>({...props.message,actions:conversationActions(props.message.actions)}))
function ask(id){if(conversationAction(id))emit('action',id)}
const type=computed(()=>messageType(props.message))
const daily=computed(()=>type.value==='dailyBrief')
</script>
