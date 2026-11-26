<template>
 <section class="assistant-question" :class="{'draft-only':draftOnly}" :aria-label="title || '草稿操作'">
  <header v-if="!draftOnly">
   <span class="question-badge">{{badge}}</span>
  </header>
  <fieldset :disabled="disabled">
   <legend :class="{'sr-title':hideTitle || draftOnly}">{{title || '草稿操作'}}</legend>
   <label v-for="(choice,index) in choices" :key="choice.id" :class="{selected:selected===index}">
    <input v-model="selected" type="radio" :name="group" :value="index"/>
    <span class="choice-number" aria-hidden="true">{{index+1}}</span>
    <span class="choice-body">
     <span class="choice-label">{{choice.label}}</span>
    </span>
   </label>
   <label v-if="draftAvailable" class="draft-option" :class="{selected:selected===adoptKey}">
    <input v-model="selected" type="radio" :name="group" :value="adoptKey"/>
    <span class="choice-number" aria-hidden="true">{{choices.length+1}}</span>
    <span class="choice-label">采用到本步骤</span>
   </label>
   <div v-if="allowOther || draftAvailable" class="other-option" :class="{selected:selected==='__other__'}">
    <label class="other-trigger" :class="{selected:selected==='__other__'}">
     <input v-model="selected" type="radio" :name="group" value="__other__"/>
     <span class="choice-number" aria-hidden="true">{{choices.length+(draftAvailable?2:1)}}</span>
     <span class="choice-body"><span class="choice-label">{{freeTextLabel}}</span></span>
    </label>
    <div v-if="selected==='__other__'" class="other-input-wrap">
     <textarea ref="otherInput" v-model="otherText" rows="2" :disabled="disabled" :placeholder="draftAvailable?'填写要补充或修改的内容…':otherPlaceholder" :aria-label="freeTextLabel" @keydown.enter.exact="confirmOnEnter"/>
    </div>
   </div>
  </fieldset>
  <footer>
   <button type="button" class="question-confirm" :disabled="disabled||!canConfirm" @click="submit">确认</button>
  </footer>
 </section>
</template>
<script setup>
import {computed,nextTick,ref,useId,watch} from 'vue'
const props=defineProps({
 title:{type:String,default:''},
 hideTitle:Boolean,
 draftAvailable:Boolean,
 badge:{type:String,default:'待你确认'},
 choices:{type:Array,default:()=>[]},
 allowOther:{type:Boolean,default:false},
 otherLabel:{type:String,default:'其他（自行填写现场情况）'},
 otherPlaceholder:{type:String,default:'填写现场实际情况…'},
 disabled:Boolean,
})
const emit=defineEmits(['confirm','adopt'])
const draftOnly=computed(()=>props.draftAvailable && !props.title)
const freeTextLabel=computed(()=>{
 if(draftOnly.value)return '继续修改'
 return props.draftAvailable?'其他（补充或修改）':props.otherLabel
})
const adoptKey='__apply_step_draft__'
const selected=ref(''),otherText=ref(''),otherInput=ref(null),group=useId()
const canConfirm=computed(()=>selected.value==='__other__'?Boolean(otherText.value.trim()):selected.value===adoptKey||Boolean(props.choices[selected.value]))
watch(selected,async value=>{if(value==='__other__'){await nextTick();otherInput.value?.focus()}})
function submit(){
 if(props.disabled||!canConfirm.value)return
 if(props.draftAvailable && selected.value===adoptKey)emit('adopt')
 else if(selected.value==='__other__')emit('confirm','__other__',otherText.value.trim())
 else emit('confirm',props.choices[selected.value].id,'')
}
function confirmOnEnter(event){
 if(event.isComposing||event.keyCode===229)return
 event.preventDefault()
 submit()
}
</script>
<style scoped>
.assistant-question {
 flex: none;
 min-width: 0;
 margin: 4px 12px 0;
 padding: 12px;
 border: 1px solid #dedbcf;
 border-radius: 12px;
 background: linear-gradient(#faf9f5, #fff 48%);
 color: var(--ui-ink);
 font-size: 12px;
 box-shadow: var(--ui-control-shadow);
}
header { display: flex; justify-content: space-between; align-items: center; gap: 8px; margin-bottom: 6px; font-size: 11px; color: #77674d; }
.question-badge { font-weight: 600; color: #7c653e; }
fieldset { min-width: 0; margin: 0; padding: 0; border: 0; }
legend { padding: 0; margin-bottom: 6px; font-size: 13.5px; line-height: 1.5; font-weight: 600; text-align: left; }
.sr-title { position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip-path:inset(50%);white-space:nowrap; }
label { display: flex; align-items: flex-start; gap: 9px; position: relative; padding: 6px 8px; margin-top: 4px; border: 1px solid #e1e3dc; border-radius: 8px; background: #fff; cursor: pointer; line-height: 1.5; transition: border-color .14s, background .14s; }
fieldset:enabled label:hover { border-color: var(--ui-accent-line); background: #faf8f1; }
label.selected { border-color: #c4ad82; background: #f6f1e5; color: #66522f; }
label:has(input:focus-visible) { outline: 2px solid var(--ui-accent); outline-offset: 2px; }
input[type=radio] { position: absolute; opacity: 0; width: 1px; height: 1px; }
.choice-number { display: grid; place-items: center; flex: none; width: 20px; height: 20px; margin-top: 1px; border-radius: 6px; color: #64705f; background: #eef0ea; font-variant-numeric: tabular-nums; font-size: 11px; }
.choice-body { display: flex; flex-direction: column; gap: 2px; min-width: 0; flex: 1; }
.choice-label { min-width: 0; overflow-wrap: anywhere; }
.selected .choice-number { background: #8a7044; color: #fff; }
.other-option { margin-top: 4px; border-radius: 8px; }
.other-option .other-trigger { margin-top: 0; }
.other-option.selected .other-trigger { border-bottom-left-radius: 0; border-bottom-right-radius: 0; border-bottom-color: #e4d8bf; }
.other-input-wrap { padding: 7px 8px; border: 1px solid #c4ad82; border-top: 0; border-bottom-left-radius: 8px; border-bottom-right-radius: 8px; background: #fcfaf4; }
.other-input-wrap textarea { width: 100%; box-sizing: border-box; padding: 6px 8px; border: 1px solid #d9d3c3; border-radius: 6px; background: #fff; color: var(--ui-ink); font: inherit; line-height: 1.5; resize: vertical; min-height: 48px; }
.other-input-wrap textarea:focus { outline: none; border-color: #b49661; box-shadow: 0 0 0 2px #b4966122; }
footer { display: flex; justify-content: space-between; align-items: center; gap: 8px; margin-top: 10px; }
.draft-only { padding: 8px 10px; }
footer button { min-height: 30px; padding: 4px 12px; border: 1px solid var(--ui-border); border-radius: 8px; font: inherit; line-height: 1.5; box-shadow: var(--ui-control-shadow); cursor: pointer; }
footer .question-confirm { margin-left: auto; background: linear-gradient(#414439, #2c3027); border-color: #35392e; color: #fff; }
footer .question-confirm:hover:enabled { background: #484e3f; }
footer button:active:enabled { box-shadow: inset 0 1px 3px #29332124; }
.assistant-question footer button:disabled { color: #7b8374; background: #f1f2ed; border-color: #e2e6da; box-shadow: none; cursor: not-allowed; }
fieldset:disabled label { color: #788075; cursor: not-allowed; }
</style>
