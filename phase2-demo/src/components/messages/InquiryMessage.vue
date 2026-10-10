<template>
  <section class="p2-inquiry" :data-inquiry-id="message.id">
    <p class="p2-inquiry-text">{{ message.text }}</p>
    <p v-if="message.hint" class="p2-inquiry-hint">{{ message.hint }}</p>
    <dl v-if="message.status==='submitted'" class="p2-inquiry-receipt">
      <div v-for="field in message.fields" :key="field.key"><dt>{{ field.label }}</dt><dd>{{ displayInquiryValue(field, values[field.key]) }}</dd></div>
    </dl>
    <form v-else novalidate @submit.prevent="submit">
      <fieldset :disabled="message.status==='inactive' || message.busy">
        <div v-for="field in message.fields" :key="field.key" class="p2-inquiry-field" :class="{'is-boolean':field.type==='boolean'}">
          <label :for="fieldId(field)">{{ field.label }}<span v-if="field.required" class="p2-inquiry-required"> *</span></label>
          <textarea v-if="field.type==='textarea'" :id="fieldId(field)" v-model="values[field.key]" rows="2" :placeholder="field.placeholder" :aria-required="field.required" :aria-invalid="Boolean(errors[field.key])" :aria-describedby="errors[field.key] ? fieldId(field)+'-error' : undefined" @input="update" />
          <select v-else-if="['select','multiselect'].includes(field.type)" :id="fieldId(field)" v-model="values[field.key]" :multiple="field.type==='multiselect'" :aria-required="field.required" :aria-invalid="Boolean(errors[field.key])" :aria-describedby="errors[field.key] ? fieldId(field)+'-error' : undefined" @change="update"><option v-if="field.type==='select'" value="" disabled>请选择</option><option v-for="option in field.options" :key="String(option.value)" :value="option.value">{{ option.label }}</option></select>
          <input v-else :id="fieldId(field)" v-model="values[field.key]" :type="field.type==='boolean' ? 'checkbox' : field.type" :min="field.min" :max="field.max" :step="field.type==='number' ? 'any' : undefined" :placeholder="field.placeholder" :aria-required="field.required" :aria-invalid="Boolean(errors[field.key])" :aria-describedby="errors[field.key] ? fieldId(field)+'-error' : undefined" @input="update" @change="field.type==='boolean' && update()" />
          <span v-if="errors[field.key]" :id="fieldId(field)+'-error'" class="p2-inquiry-error">{{ errors[field.key] }}</span>
        </div>
        <button type="submit">{{ message.busy ? '提交中…' : message.submitLabel || '提交' }}</button>
      </fieldset>
    </form>
    <p v-if="message.status==='submitted'" class="p2-inquiry-status" role="status">已提交{{ message.submittedAt ? ' · '+message.submittedAt : '' }}{{ message.receiptText ? '。'+message.receiptText : '' }}</p>
    <p v-if="message.status==='inactive'" class="p2-inquiry-hint">{{ message.inactiveReason || '此项询问当前不可提交' }}</p>
    <p v-if="message.submitError" class="p2-inquiry-error" role="alert">{{ message.submitError }}</p>
  </section>
</template>
<script setup>
import { computed, reactive, ref, watch, useId } from 'vue'
import { inquiryValues, validateInquiry, displayInquiryValue, assertInquiry } from '@/message-flows/inquiryFields'
const props=defineProps({message:{type:Object,required:true}})
const emit=defineEmits(['submit-inquiry','update-inquiry'])
const prefix=useId(),values=reactive({}),attempted=ref(false)
watch(()=>[props.message.id,props.message.values,props.message.status],()=>{
  assertInquiry(props.message)
  for(const key of Object.keys(values)) delete values[key]
  Object.assign(values,inquiryValues(props.message))
  attempted.value=false
},{immediate:true,deep:true})
const errors=computed(()=>attempted.value ? validateInquiry(props.message,values) : {})
function fieldId(field){return prefix+'-'+field.key}
function payload(){return {messageId:props.message.id,values:Object.fromEntries(Object.entries(values).map(([key,value])=>[key,Array.isArray(value)?[...value]:value]))}}
function update(){emit('update-inquiry',payload())}
function submit(){
  if(props.message.status==='submitted'||props.message.status==='inactive'||props.message.busy)return
  attempted.value=true
  if(Object.keys(errors.value).length)return
  emit('submit-inquiry',payload())
}
</script>
