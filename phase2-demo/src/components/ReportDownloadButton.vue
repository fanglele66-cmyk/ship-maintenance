<template>
 <button type="button" v-bind="$attrs" :disabled="!report || busy" @click="save">{{busy?'正在打包…':'下载'}}</button>
 <span v-if="error" class="download-error" role="alert">{{error}} 请重试下载。</span>
</template>
<script setup>
import {ref} from 'vue'
import {downloadReportMarkdown} from '../workflow/downloadReport.js'
defineOptions({inheritAttrs:false})
const props=defineProps({report:Object})
const error=ref(''),busy=ref(false)
async function save(){
 if(busy.value || !props.report)return
 busy.value=true;error.value=''
 try{await downloadReportMarkdown(props.report)}
 catch(err){error.value=err.message || '下载报告失败。'}
 finally{busy.value=false}
}
</script>
<style scoped>
.download-error{color:var(--ui-danger,#a03b34);font-size:12px}
</style>
