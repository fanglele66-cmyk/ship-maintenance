<template>
 <Teleport to="body"><dialog ref="dialog" class="manual-anomaly-dialog" aria-labelledby="manual-anomaly-title" @cancel.prevent="close">
  <header><div><small>长航碧玉 · 事件中心</small><h2 id="manual-anomaly-title">异常上报</h2></div><button type="button" :disabled="pending" aria-label="关闭异常上报" @click="close">×</button></header>
  <form @submit.prevent="submit">
   <fieldset :disabled="pending"><div class="report-fields">
    <label>设备 <em>*</em><select v-model="form.deviceId" aria-label="上报设备" required><option value="" disabled>请选择设备</option><option v-for="device in reportDevices" :key="device.id" :value="device.id">{{device.name}}</option></select></label>
    <label>系统<select v-model="system" aria-label="筛选系统" :disabled="!form.deviceId"><option value="">全部系统</option><option v-for="name in systems" :key="name">{{name}}</option></select></label>
    <label>开始时间 <em>*</em><input v-model="form.start" type="datetime-local" aria-label="异常开始时间" required/></label>
    <label>结束时间 <em>*</em><input v-model="form.end" type="datetime-local" aria-label="异常结束时间" required/></label>
   </div>
   <section class="sensor-picker" aria-label="关联传感器"><div class="sensor-heading"><strong>关联传感器 <em>*</em></strong><span>已选 {{form.sensorIds.length}} 项<button v-if="form.sensorIds.length" type="button" @click="form.sensorIds=[]">清空</button></span></div><input v-model="search" aria-label="搜索传感器" placeholder="搜索测点名称" :disabled="!form.deviceId"/><div class="sensor-options"><label v-for="sensor in filteredSensors" :key="sensor.id"><input type="checkbox" v-model="form.sensorIds" :value="sensor.id"/><span>{{sensor.nameCn}}<small>{{sensor.subsystem}} · {{sensor.unit}}</small></span></label><p v-if="!filteredSensors.length">{{form.deviceId?'没有匹配的测点':'请先选择设备'}}</p></div><p v-if="form.sensorIds.length" class="selected-sensors">{{selectedNames.join('、')}}</p></section>
   <label class="report-description">异常描述 <em>*</em><textarea v-model="form.description" rows="4" minlength="5" maxlength="3000" required placeholder="描述异常现象、持续时间、现场读数及当前状态。"/></label>
   </fieldset>
   <p v-if="error" class="report-error" role="alert">{{error}}</p><p v-if="pending" class="report-progress" role="status">{{progress||'正在提交异常资料…'}}</p>
   <footer><span>提交人：{{store.people[store.state.role]}}</span><button type="submit" :disabled="pending">{{pending?'AI 分析中…':'提交异常报告'}}</button></footer>
  </form>
 </dialog></Teleport>
</template>
<script setup>
import {computed,reactive,ref,watch} from 'vue'
import {useEventLifecycleStore} from '../stores/eventLifecycleStore.js'
import {reportDevices,reportSensors} from '../workflow/manualAnomaly.js'
const emit=defineEmits(['submitted']),store=useEventLifecycleStore(),dialog=ref(null),pending=ref(false),error=ref(''),progress=ref(''),system=ref(''),search=ref('')
const localInput=value=>new Date(value).toLocaleString('sv-SE',{timeZone:'Asia/Shanghai'}).slice(0,16).replace(' ','T')
const form=reactive({deviceId:'',sensorIds:[],start:localInput(Date.now()-1800000),end:localInput(Date.now()),description:''})
let requestId=crypto.randomUUID()
const sensors=computed(()=>reportSensors(form.deviceId)),systems=computed(()=>[...new Set(sensors.value.map(s=>s.subsystem))]),filteredSensors=computed(()=>sensors.value.filter(s=>(!system.value||s.subsystem===system.value)&&(!search.value||s.nameCn.includes(search.value.trim())))),selectedNames=computed(()=>sensors.value.filter(s=>form.sensorIds.includes(s.id)).map(s=>s.nameCn))
watch(()=>form.deviceId,()=>{form.sensorIds=[];system.value='';search.value=''})
watch(form,()=>{requestId=crypto.randomUUID();error.value=''})
watch(()=>store.state.role,()=>{if(!pending.value){close();Object.assign(form,{deviceId:'',sensorIds:[],description:''})}})
function open(){error.value='';dialog.value.showModal()}
function close(){if(!pending.value)dialog.value.close()}
async function submit(){if(pending.value)return;pending.value=true;error.value='';progress.value='正在提交异常资料…';try{const event=await store.reportAnomaly({...form,sensorIds:[...form.sensorIds]},requestId,(kind,data)=>{if(kind==='progress')progress.value=data.label});pending.value=false;dialog.value.close();Object.assign(form,{deviceId:'',sensorIds:[],description:''});emit('submitted',event)}catch(e){error.value=e.message}finally{pending.value=false}}
defineExpose({open})
</script>
<style scoped>
.manual-anomaly-dialog{margin:auto;width:min(780px,calc(100vw - 32px));max-height:calc(100dvh - 40px);padding:0;border:1px solid #e1e5e8;border-radius:12px;background:#fff;color:#304359;box-shadow:0 24px 90px #14283b35;font:14px/1.6 'Segoe UI','Microsoft YaHei',sans-serif;overflow:auto;box-sizing:border-box}.manual-anomaly-dialog::backdrop{background:#15233366;backdrop-filter:blur(2px)}header{display:flex;align-items:center;justify-content:space-between;padding:22px 28px;border-bottom:1px solid #e8ecef}header small{color:#8c795b;font-size:12px}h2{font-size:23px;margin:3px 0 0;color:#25364a}header button{font-size:27px;border:0;background:transparent;color:#8290a0;cursor:pointer}form{padding:22px 28px}fieldset{border:0;margin:0;padding:0;min-width:0}.report-fields{display:grid;grid-template-columns:1fr 1fr;gap:18px 22px}label{display:block;font-weight:500}em{color:#b7744f;font-style:normal}select,input:not([type=checkbox]),textarea{display:block;box-sizing:border-box;width:100%;margin-top:7px;border:1px solid #d9e0e7;border-radius:6px;background:#fff;color:#34485f;font:inherit;padding:10px 12px;outline:none}select:focus,input:focus,textarea:focus{border-color:#b59a64;box-shadow:0 0 0 3px #b59a6414}textarea{resize:vertical;min-height:100px}.sensor-picker{margin:20px 0}.sensor-heading{display:flex;align-items:center;justify-content:space-between;font-size:13px}.sensor-heading strong{font-weight:500}.sensor-heading span{color:#7e8c9e}.sensor-heading button{border:0;background:none;color:#95753c;margin-left:10px;cursor:pointer}.sensor-options{display:grid;grid-template-columns:1fr 1fr;gap:2px 12px;max-height:184px;overflow:auto;border:1px solid #e1e6eb;border-radius:6px;margin-top:8px;padding:8px}.sensor-options label{display:flex;align-items:center;gap:8px;padding:7px;font-size:13px;font-weight:400;border-radius:4px;cursor:pointer}.sensor-options label:hover{background:#f6f5f1}.sensor-options input{accent-color:#9b7e48}.sensor-options small{display:block;color:#8a97a5;font-size:11px}.sensor-options p{padding:8px;color:#8a97a5}.selected-sensors{font-size:12px;color:#8b744c;line-height:1.65;margin:8px 0}.report-error{color:#b24739}.report-progress{color:#987a40}footer{display:flex;justify-content:space-between;gap:16px;align-items:center;margin-top:22px;padding-top:18px;border-top:1px solid #e8ecef}footer span{font-size:12px;color:#7d8b9d}footer button{border:1px solid #30332b;border-radius:6px;padding:11px 24px;background:#30332b;color:#fff;font:inherit;cursor:pointer}button:disabled{opacity:.55;cursor:wait}@media(max-width:560px){header{padding:18px}form{padding:18px}.report-fields{grid-template-columns:1fr;gap:12px}.sensor-options{grid-template-columns:1fr}footer{align-items:stretch;flex-direction:column}footer button{width:100%}}
</style>
