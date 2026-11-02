<template>
 <div class="lc-step-note note-editor">
  <div class="note-heading"><label :for="id">{{label}}</label><button type="button" :disabled="busy||listening||!modelValue.trim()" @click="polish">✦ {{busy?'正在整理…':'AI 总结'}}</button></div>
  <div class="note-input"><textarea :id="id" :value="modelValue" @input="$emit('update:modelValue',$event.target.value)" :rows="rows" :required="required" :placeholder="placeholder"/>
   <button type="button" class="voice-button" :class="{listening}" :disabled="busy" :aria-pressed="listening" @click="voice"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="9" y="2" width="6" height="12" rx="3"/><path d="M5 10v2a7 7 0 0 0 14 0v-2M12 19v3M8 22h8"/></svg>{{listening?'结束录音':'语音输入'}}</button>
  </div>
  <small v-if="listening" role="status">正在听取语音… {{interim}}</small><small v-if="error" role="alert" class="lc-error">{{error}}</small>
  <section v-if="proposal" class="note-proposal"><strong>AI 整理建议</strong><p>{{proposal}}</p><div><button type="button" @click="apply">采用整理内容</button><button type="button" @click="proposal=''">保留原文</button></div></section>
 </div>
</template>
<script setup>
import {ref,useId,onBeforeUnmount} from 'vue'
import {aiStreamRequest} from '../services/aiClient.js'
const props=defineProps({modelValue:{type:String,default:''},label:{type:String,default:'备注（选填）'},rows:{type:Number,default:4},required:Boolean,placeholder:String,context:String})
const emit=defineEmits(['update:modelValue']),id=useId(),busy=ref(false),listening=ref(false),interim=ref(''),error=ref(''),proposal=ref('')
let recognition,controller,original='',disposed=false
async function polish(){
 original=props.modelValue;error.value='';proposal.value='';busy.value=true;controller=new AbortController()
 try{const result=await aiStreamRequest({mode:'note',text:original,noteContext:props.context},()=>{},{signal:controller.signal});if(!result.answer.trim())throw Error('未生成有效内容，请重试；原文已保留。');if(!disposed)proposal.value=result.answer.trim()}catch(e){if(!disposed)error.value=e.message}finally{busy.value=false}
}
function apply(){if(props.modelValue!==original){error.value='原文已更新，请重新点击 AI 总结，避免覆盖新记录。';return}emit('update:modelValue',proposal.value);proposal.value='';error.value=''}
function voice(){
 if(listening.value){recognition?.stop();return}
 error.value='';const Recognition=window.SpeechRecognition||window.webkitSpeechRecognition
 if(!Recognition){error.value='当前浏览器不支持语音识别，请使用支持语音输入的浏览器或直接输入文字。';return}
 recognition=new Recognition();recognition.lang='zh-CN';recognition.continuous=true;recognition.interimResults=true
 recognition.onresult=e=>{let final='',preview='';for(let i=e.resultIndex;i<e.results.length;i++){const item=e.results[i];if(item.isFinal)final+=item[0].transcript;else preview+=item[0].transcript}if(final)emit('update:modelValue',[props.modelValue.trim(),final.trim()].filter(Boolean).join('\n'));interim.value=preview}
 recognition.onerror=e=>{if(e.error!=='aborted')error.value=({'not-allowed':'未获得麦克风权限，请允许后重试。','audio-capture':'未检测到可用麦克风。','network':'语音识别连接失败，请检查网络后重试。','no-speech':'未识别到语音，请重试。'})[e.error]||'语音识别暂不可用，请重试或直接输入文字。'}
 recognition.onend=()=>{listening.value=false;interim.value=''}
 try{recognition.start();listening.value=true}catch{error.value='无法开始语音输入，请检查麦克风权限。'}
}
onBeforeUnmount(()=>{disposed=true;controller?.abort();if(recognition){recognition.onresult=null;recognition.onerror=null;recognition.onend=null;recognition.abort()}})
</script>
<style scoped>
.note-editor{display:flex;flex-direction:column;gap:9px}.note-heading{display:flex;align-items:center;gap:12px;font-size:13px}.note-heading button{font-size:12px;color:#987637;background:#faf7ef;border:1px solid #e8deca;border-radius:5px;padding:4px 9px;cursor:pointer}.note-heading button:disabled{opacity:.5;cursor:default}.note-input{position:relative}.note-input textarea{width:100%;box-sizing:border-box;padding:11px 12px 43px;border:1px solid #dcdfd7;border-radius:6px;color:#465e76;font:inherit;line-height:1.7;resize:vertical;background:#fff}.voice-button{position:absolute;bottom:10px;right:10px;display:flex;align-items:center;gap:6px;border:0;border-radius:5px;padding:5px 8px;font-size:12px;background:#f4f5f1;color:#778675;cursor:pointer}.voice-button svg{width:15px;height:15px;stroke:currentColor;fill:none;stroke-width:1.6}.voice-button.listening{background:#f9e9e5;color:#b55f51}.note-editor small{font-size:12px;color:#8390a0}.note-editor .lc-error{color:#b86a47}.note-proposal{padding:12px 15px;border-left:2px solid #bca575;background:#faf8f2;font-size:13px}.note-proposal p{white-space:pre-wrap;margin:8px 0}.note-proposal div{display:flex;gap:10px}.note-proposal button{font-size:12px;border:1px solid #dfd7c6;border-radius:4px;padding:5px 9px;background:white;color:#876e42;cursor:pointer}
</style>
