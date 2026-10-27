<template>
 <section v-if="preview||error||applied" class="record-import">
  <p v-if="error" role="alert">{{error}}</p>
  <div v-if="preview" class="record-import-preview">
   <strong>{{filename}} · 识别到 {{Object.keys(preview.values).length}} 项</strong>
   <dl><template v-for="(value,key) in preview.values" :key="key"><dt>{{message.fields.find(field=>field.key===key)?.label}}</dt><dd>{{value}}</dd></template></dl>
   <p v-if="preview.unmatched.length">待人工核对：{{preview.unmatched.join('、')}}</p>
   <button type="button" class="p2-secondary" :disabled="!Object.keys(preview.values).length" @click="apply">确认回填草稿</button>
   <button type="button" class="p2-link-button" @click="preview=null">取消</button>
  </div>
  <p v-if="applied" role="status">已回填草稿，核对后提交。</p>
 </section>
</template>
<script setup>
import {ref,watch} from 'vue'
import {parseRecordImport} from '@/message-flows/recordImport'
const props=defineProps({message:{type:Object,required:true}}),emit=defineEmits(['apply','preview'])
const preview=ref(null),filename=ref(''),error=ref(''),applied=ref(false)
watch(()=>props.message.id,()=>{preview.value=null;error.value='';applied.value=false})
async function readFile(event){const file=event.target.files?.[0],messageId=props.message.id;if(!file)return;preview.value=null;error.value='';applied.value=false;try{if(file.size>2*1024*1024)throw Error('请选择 2 MB 以内的文本记录。');const text=await file.text();if(props.message.id!==messageId)return;preview.value=parseRecordImport(text,file.name,props.message.fields);filename.value=file.name}catch(e){error.value=e.message||'文件解析失败，请检查格式。'}finally{event.target.value='';emit('preview')}}
function apply(){if(props.message.status==='submitted')return;emit('apply',{...preview.value.values});preview.value=null;applied.value=true}
defineExpose({readFile})
</script>
<style scoped>
.record-import{font-size:12px;margin:12px 0;color:#6b7889;line-height:1.7}.record-import-trigger{display:inline-block;border:1px solid #d9c5a2;border-radius:5px;padding:6px 10px;color:#886c37;cursor:pointer}.record-import-trigger input{display:none}.record-import-formats{display:block;margin-top:4px;color:#8a94a3}.record-import-preview{padding:12px;background:#faf8f3;margin-top:8px;border-radius:6px}.record-import-preview dl{margin:10px 0}.record-import-preview dt{font-weight:600}.record-import-preview dd{margin:2px 0 10px;white-space:pre-wrap;overflow-wrap:anywhere;max-height:160px;overflow:auto}.record-import-preview button{margin-right:8px}
</style>
