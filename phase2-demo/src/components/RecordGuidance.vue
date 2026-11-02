<template><p class="record-guidance"><span>{{label}}：{{parts.brief}}</span><span v-if="parts.help" class="record-help"><button type="button" :aria-label="parts.help">?</button><span role="tooltip">{{parts.help}}</span></span></p></template>
<script setup>
import {computed} from 'vue'
import {recordGuidance} from '../workflow/stepPresentation.js'
const props=defineProps({text:String,label:{type:String,default:'回交要求'}}),parts=computed(()=>recordGuidance(props.text))
</script>
<style scoped>
.record-guidance{display:flex;align-items:baseline;gap:6px;font-size:12px;color:#8693a3;line-height:1.7;margin:10px 0}.record-help{position:relative;display:inline-flex;flex:none}.record-help button{display:grid;place-items:center;width:17px;height:17px;border:1px solid #c9c3b3;border-radius:50%;background:#fbfaf6;color:#967846;font-size:11px;cursor:help;padding:0}.record-help>[role=tooltip]{position:absolute;z-index:15;bottom:calc(100% + 8px);right:0;width:280px;max-width:70vw;background:#fffdf8;color:#6b6251;border:1px solid #dfd6c3;border-radius:7px;padding:10px 12px;box-shadow:0 5px 20px #27344916;visibility:hidden;opacity:0;transition:opacity .15s}.record-help:hover>[role=tooltip],.record-help:focus-within>[role=tooltip]{visibility:visible;opacity:1}
</style>
