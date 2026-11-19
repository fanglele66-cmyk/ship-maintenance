<template>
 <section class="assistant-question" :aria-label="title">
  <header><span>待你确认</span><small v-if="context">{{context}}</small></header>
  <fieldset :disabled="disabled"><legend>{{title}}</legend>
   <label v-for="(choice,index) in choices" :key="choice.id" :class="{selected:selected===choice.id}">
    <input v-model="selected" type="radio" :name="group" :value="choice.id"/>
    <span class="choice-number" aria-hidden="true">{{index+1}}</span><span class="choice-label">{{choice.label}}</span>
   </label>
  </fieldset>
  <footer><button type="button" class="question-custom" :disabled="disabled" @click="$emit('custom')">直接输入</button><button type="button" class="question-confirm" :disabled="disabled||!selected" @click="$emit('confirm',selected)">确认 →</button></footer>
 </section>
</template>
<script setup>
import {ref,useId} from 'vue'
defineProps({title:{type:String,required:true},context:String,choices:{type:Array,required:true},disabled:Boolean})
defineEmits(['confirm','custom'])
const selected=ref(''),group=useId()
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
header { display: flex; justify-content: space-between; gap: 8px; margin-bottom: 6px; font-size: 11px; color: #77674d; }
header small { font: inherit; color: #687266; text-align: right; overflow-wrap: anywhere; }
fieldset { min-width: 0; margin: 0; padding: 0; border: 0; }
legend { padding: 0; margin-bottom: 5px; font-size: 14px; line-height: 1.5; font-weight: 600; text-align: left; }
label { display: flex; align-items: center; gap: 9px; position: relative; padding: 6px 8px; margin-top: 4px; border: 1px solid #e1e3dc; border-radius: 8px; background: #fff; cursor: pointer; line-height: 1.55; }
fieldset:enabled label:hover { border-color: var(--ui-accent-line); background: #faf8f1; }
label.selected { border-color: #c4ad82; background: #f6f1e5; color: #66522f; }
label:has(input:focus-visible) { outline: 2px solid var(--ui-accent); outline-offset: 2px; }
input { position: absolute; opacity: 0; width: 1px; height: 1px; }
.choice-number { display: grid; place-items: center; flex: none; width: 21px; height: 21px; border-radius: 6px; color: #64705f; background: #eef0ea; font-variant-numeric: tabular-nums; }
.choice-label { min-width: 0; overflow-wrap: anywhere; }
.selected .choice-number { background: #8a7044; color: #fff; }
footer { display: flex; justify-content: space-between; align-items: center; gap: 8px; margin-top: 10px; }
footer button { min-height: 30px; padding: 4px 12px; border: 1px solid var(--ui-border); border-radius: 8px; font: inherit; line-height: 1.5; box-shadow: var(--ui-control-shadow); }
footer .question-custom { background: #fff; color: #566151; }
footer .question-custom:hover:enabled { border-color: #b7bead; background: #f4f5ef; }
footer .question-confirm { background: linear-gradient(#414439, #2c3027); border-color: #35392e; color: #fff; }
footer .question-confirm:hover:enabled { background: #484e3f; }
footer button:active:enabled { box-shadow: inset 0 1px 3px #29332124; }
.assistant-question footer button:disabled { color: #7b8374; background: #f1f2ed; border-color: #e2e6da; box-shadow: none; cursor: not-allowed; }
fieldset:disabled label { color: #788075; cursor: not-allowed; }
</style>
