<template>
  <div class="sensor-grid">
    <div class="sg-tabs-wrapper"><div class="sg-tabs" aria-label="传感器系统筛选"><template v-if="sensorStore.currentDeviceId"><button v-for="tag in sensorStore.currentSubsystemTags" :key="tag" type="button" class="filter-tag" :class="{active:sensorStore.currentSubsystem===tag}" :aria-pressed="sensorStore.currentSubsystem===tag" @click="sensorStore.setSubsystem(tag)">{{ tag }}</button></template><template v-else><button v-for="tag in systemTags" :key="tag" type="button" class="filter-tag" :class="{active:sensorStore.currentSystem===tag}" :aria-pressed="sensorStore.currentSystem===tag" @click="sensorStore.setSystem(tag)">{{ tag }}</button></template></div></div>
    <SensorBoard :readings="filteredSensors" @select-sensor="$emit('selectSensor',$event)"/>
  </div>
</template>
<script setup>
import {computed} from 'vue'
import {useSensorStore} from '@/stores/sensorStore'
import {systemTags} from '@/mock/sensors'
import {filterSensorReadings} from '@/mock/sensorLayout.js'
import SensorBoard from '@/components/SensorBoard.vue'
const props=defineProps({searchQuery:{type:String,default:''}})
defineEmits(['selectSensor'])
const sensorStore=useSensorStore()
const filteredSensors=computed(()=>filterSensorReadings(sensorStore.filteredSensors,props.searchQuery))
</script>
<style scoped>
.sensor-grid{min-width:0;display:flex;flex-direction:column;gap:6px;padding-bottom:2px}
.sg-tabs-wrapper{display:flex;align-items:center;min-width:0}.sg-tabs{display:flex;flex-wrap:wrap;align-items:center;gap:4px;min-width:0;padding:2px 0}.filter-tag{height:25px;padding:2px 7px;border:1px solid #e1e2e5;border-radius:5px;background:#f7f7f8;color:#686a70;font:inherit;font-size:10px;line-height:18px;cursor:pointer;white-space:nowrap}.filter-tag:hover{color:#106bff;background:#f5f9ff;border-color:#bfd4ff}.filter-tag.active{color:#106bff;background:#edf4ff;border-color:#bfd4ff;font-weight:600}.filter-tag:focus-visible{outline:2px solid #106bff;outline-offset:1px}
@media(min-width:1800px){.filter-tag{font-size:11px;padding-inline:9px;height:27px}.sensor-grid{gap:8px}}
@media(max-width:760px){.sg-tabs{flex-wrap:nowrap;overflow-x:auto;padding-bottom:5px}.filter-tag{height:28px;flex:none;padding-inline:9px}}
</style>
