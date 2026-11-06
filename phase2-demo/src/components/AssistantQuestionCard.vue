<template>
 <section class="assistant-question" :aria-label="title">
  <header><span>待你确认</span><small>{{context}}</small></header>
  <fieldset :disabled="disabled"><legend>{{title}}</legend>
   <label v-for="(choice,index) in choices" :key="choice.id" :class="{selected:selected===choice.id}">
    <input v-model="selected" type="radio" :name="group" :value="choice.id"/>
    <span class="choice-number" aria-hidden="true">{{index+1}}</span><span>{{choice.label}}</span><span class="choice-arrow" aria-hidden="true">→</span>
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
.assistant-question{flex:none;min-width:0;margin:0 12px 8px;padding:12px;border:1px solid #dfe5df;border-radius:12px;background:#fff;color:#40594d;font-size:12px;box-shadow:0 2px 8px #20352905}
header{display:flex;justify-content:space-between;gap:8px;margin-bottom:9px;color:#829087;font-size:11px}header small{font-size:11px}
fieldset{border:0;padding:0;margin:0;min-width:0}legend{font-size:13px;font-weight:600;margin-bottom:9px;padding:0;text-align:left}
label{display:flex;align-items:center;gap:8px;position:relative;border:1px solid transparent;border-radius:7px;padding:8px 7px;margin:3px 0;cursor:pointer;text-align:left;line-height:1.5}label:hover{background:#f6f8f5}label.selected{background:#edf5ef;border-color:#c8dbce}label:focus-within{outline:2px solid #b19b69;outline-offset:1px}
input{position:absolute;opacity:0;width:1px;height:1px}.choice-number{display:inline-flex;align-items:center;justify-content:center;flex:none;width:21px;height:21px;border:1px solid #dce2dc;border-radius:5px;color:#7b8a7f;background:#f6f8f5}.choice-arrow{margin-left:auto;color:#8e9a91}
footer{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-top:8px}button{border:0;border-radius:7px;font:inherit;padding:7px 10px;cursor:pointer}.question-custom{background:none;color:#7b8c81;padding-left:0}.question-confirm{background:#455d4e;color:#fff}button:disabled{opacity:.45;cursor:default}fieldset:disabled label{cursor:default}
</style>
