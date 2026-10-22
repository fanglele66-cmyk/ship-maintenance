<template>
  <section class="sensor-board sensor-layout" :class="{ 'sensor-board-overview': overview }">
    <template v-if="layout.main">
      <header v-if="showHeading" class="sensor-board-heading"><strong>主机系统测点 <small>RT-flex50 · 六缸配置</small></strong><span>{{ readings.length }} 个测点 · 点击读数查看趋势</span></header>
      <section v-if="layout.main.columns.length" class="shared-sensor-area" aria-label="主机共用系统测点">
        <div class="sensor-system-columns"><div v-for="(column,index) in systemColumns" :key="index" class="sensor-system-column"><SensorReadingGroup v-for="group in column" :key="group.id" :group="group" compact @select-sensor="$emit('selectSensor',$event)" /></div></div>
      </section>
      <section v-if="layout.main.matrix.length" class="cylinder-sensor-area" aria-label="六缸传感器矩阵">
        <div class="sensor-area-heading"><strong>气缸测点对照</strong><span>1–6 缸 · 同一指标横向查看</span></div>
        <div class="sensor-matrix-scroll" tabindex="0" aria-label="可横向滚动的六缸测点表"><table class="sensor-cylinder-matrix">
          <thead><tr><th scope="col">测量指标 / 单位</th><th v-for="number in sensorCylinderNumbers" :key="number" scope="col"><div class="cylinder-column-head"><EnginePartIcon kind="cylinder" :size="23"/><span>{{ number }} 缸</span></div></th></tr></thead>
          <tbody><tr v-for="row in layout.main.matrix" :key="row.id" :data-cylinder-topic="row.id"><th scope="row"><span>{{ row.name }}</span><small>{{ row.unit }}<template v-if="row.note"> · 工作循环</template></small></th><td v-for="cell in row.cells" :key="cell.number"><button v-if="cell.sensor" type="button" :data-sensor-id="cell.sensor.id" :aria-label="`查看${cell.sensor.nameCn}的趋势分析`" :title="`${cell.sensor.nameCn} · ${cell.sensor.nameEn || ''} · ${cell.sensor.unit}`" @click="$emit('selectSensor',cell.sensor)">{{ formatSensorValue(cell.sensor) }}<i aria-hidden="true">›</i></button><span v-else class="sensor-cell-empty" aria-label="当前筛选无匹配测点">—</span></td></tr></tbody>
        </table></div>
      </section>
      <section v-if="layout.main.operatingGroups.length" class="operating-sensor-area" aria-label="主机运行与机械参数"><SensorReadingGroup v-for="group in layout.main.operatingGroups" :key="group.id" :group="group" compact @select-sensor="$emit('selectSensor',$event)"/></section>
      <section v-if="layout.main.additionalGroups.length" class="device-sensor-groups extra-sensor-area" aria-label="主机其他测点"><SensorReadingGroup v-for="group in layout.main.additionalGroups" :key="group.id" :group="group" compact @select-sensor="$emit('selectSensor',$event)"/></section>
    </template>
    <section v-for="device in layout.devices" :key="device.id" class="device-sensor-area" :data-device-group="device.id" :aria-label="`${device.name}系统测点`"><header class="sensor-board-heading"><strong>{{ device.name }}<small>系统测点</small></strong><span>{{ device.count }} 个测点</span></header><div class="device-sensor-groups"><SensorReadingGroup v-for="group in device.groups" :key="group.id" :group="group" compact @select-sensor="$emit('selectSensor',$event)"/></div></section>
    <div v-if="!readings.length" class="empty-state">未找到匹配的传感器</div>
  </section>
</template>
<script setup>
import {computed} from 'vue'
import EnginePartIcon from './EnginePartIcon.vue'
import SensorReadingGroup from './SensorReadingGroup.vue'
import {buildSensorLayout,formatSensorValue,sensorCylinderNumbers} from '@/mock/sensorLayout.js'
const props=defineProps({readings:{type:Array,default:()=>[]},overview:Boolean,showHeading:{type:Boolean,default:true}})
defineEmits(['selectSensor'])
const layout=computed(()=>buildSensorLayout(props.readings))
// Short, balanced columns keep the entire engine board visible beside the assistant.
const systemColumns=computed(()=>{
  const groups=new Map((layout.value.main?.columns.flat()||[]).map(group=>[group.id,group]))
  return [['fuel','servo'],['lubrication','exhaust'],['air'],['cooling']]
    .map(ids=>ids.flatMap(id=>groups.has(id)?[groups.get(id)]:[])).filter(column=>column.length)
})
</script>
<style scoped>
.sensor-board{min-width:0;display:flex;flex-direction:column;gap:8px}
.sensor-board-heading{display:flex;justify-content:space-between;align-items:center;gap:10px;min-height:23px;color:#465265;font-size:12px}.sensor-board-heading strong{font-weight:600}.sensor-board-heading small{font-size:10px;font-weight:400;margin-left:8px;color:#8993a1}.sensor-board-heading>span{font-size:10px;color:#8993a1}
.shared-sensor-area,.cylinder-sensor-area,.operating-sensor-area,.device-sensor-groups{min-width:0;border:1px solid #e2e7ef;border-radius:6px;background:#fff}
.sensor-system-columns{display:grid;grid-template-columns:repeat(4,minmax(0,1fr))}.sensor-system-column{min-width:0}.sensor-system-column+.sensor-system-column{border-left:1px solid #e7ebf1}.sensor-system-column>.sensor-system+.sensor-system{border-top:1px solid #e7ebf1}
.sensor-area-heading{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:4px 10px;background:#f7f9fc;border-bottom:1px solid #e7ebf1;border-radius:6px 6px 0 0;min-height:24px;box-sizing:border-box}.sensor-area-heading strong{font-size:11px;font-weight:600;color:#465265}.sensor-area-heading>span{font-size:10px;color:#8993a1}
.sensor-matrix-scroll{max-width:100%;overflow-x:auto}.sensor-matrix-scroll:focus-visible{outline:2px solid #106bff;outline-offset:-2px}.sensor-cylinder-matrix{border-collapse:collapse;width:100%;min-width:620px;table-layout:fixed;color:#465265}.sensor-cylinder-matrix th{font-size:11px;font-weight:500}.sensor-cylinder-matrix thead th{height:30px;background:#fafbfc;border-bottom:1px solid #e5eaf1}.sensor-cylinder-matrix th:first-child{width:220px;text-align:left;padding:3px 10px;position:sticky;left:0;z-index:2;background:#fff;box-shadow:1px 0 #e7ebf1}.sensor-cylinder-matrix tbody th small{font-size:9px;color:#8993a1;font-weight:400;line-height:1.2;margin-left:7px;white-space:nowrap}.sensor-cylinder-matrix tbody th{line-height:1.2}.cylinder-column-head{display:flex;align-items:center;justify-content:center;gap:5px}.cylinder-column-head>span{font-size:11px;color:#637085}.sensor-cylinder-matrix td{height:26px;padding:0 4px;text-align:center;border-left:1px solid #eff2f7}.sensor-cylinder-matrix tbody tr+tr{border-top:1px solid #eef1f5}.sensor-cylinder-matrix tbody tr:nth-child(even),.sensor-cylinder-matrix tbody tr:nth-child(even) th:first-child{background:#fbfcfe}.sensor-cylinder-matrix td button{position:relative;display:block;width:100%;min-height:24px;padding:2px 12px 2px 4px;border:0;border-radius:3px;background:transparent;color:#3d4a5d;font:600 13px/1.4 Consolas,monospace;cursor:pointer;font-variant-numeric:tabular-nums}.sensor-cylinder-matrix td button i{position:absolute;right:4px;top:50%;transform:translateY(-50%);color:#a9b5c5;font:400 12px Arial,sans-serif}.sensor-cylinder-matrix td button:hover{color:#106bff;background:#edf4ff}.sensor-cylinder-matrix td button:focus-visible{outline:2px solid #106bff;outline-offset:0}.sensor-cell-empty{color:#c0c7d1;font-size:12px}
.operating-sensor-area{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,2fr)}.operating-sensor-area>.sensor-system+.sensor-system{border-left:1px solid #e7ebf1}.operating-sensor-area :deep(.sensor-system-section){display:grid;grid-template-columns:repeat(2,minmax(0,1fr));column-gap:12px}.operating-sensor-area :deep(.sensor-reading+.sensor-reading){border-top:0}.sensor-board-overview .operating-sensor-area{grid-template-columns:1fr}.sensor-board-overview .operating-sensor-area :deep(.sensor-system){display:grid;grid-template-columns:140px minmax(0,1fr);gap:16px;align-items:center}.sensor-board-overview .operating-sensor-area :deep(.sensor-system-head){margin:0}
.device-sensor-area{min-width:0}.device-sensor-groups{display:grid;grid-template-columns:repeat(5,minmax(0,1fr))}.device-sensor-groups>.sensor-system{box-shadow:1px 0 #e7ebf1}.device-sensor-area .sensor-board-heading{margin-bottom:5px}.empty-state{padding:30px;text-align:center;color:#8993a1;font-size:12px}
.sensor-board-overview{gap:10px}
.sensor-board-overview :deep(.sensor-system.compact){padding:7px 10px}
.sensor-board-overview :deep(.compact .sensor-system-head){min-height:28px;margin-bottom:2px}
.sensor-board-overview :deep(.compact h4){font-size:12px}
.sensor-board-overview :deep(.compact .sensor-section-label){font-size:10px}
.sensor-board-overview :deep(.compact .sensor-reading){min-height:26px;padding:3px}
.sensor-board-overview :deep(.compact .sensor-reading-name){font-size:11px}
.sensor-board-overview :deep(.compact .sensor-reading-value){font-size:14px}
.sensor-board-overview :deep(.compact .sensor-reading-value small){font-size:10px}
.sensor-board-overview .sensor-area-heading{min-height:27px;padding:5px 10px}
.sensor-board-overview .sensor-area-heading strong,.sensor-board-overview .sensor-cylinder-matrix th,.sensor-board-overview .cylinder-column-head>span{font-size:12px}
.sensor-board-overview .sensor-cylinder-matrix tbody th small{font-size:10px}
.sensor-board-overview .sensor-cylinder-matrix td{height:29px}
.sensor-board-overview .sensor-cylinder-matrix td button{font-size:14px;min-height:27px}
@media(min-width:1800px){.sensor-board{gap:10px}.sensor-cylinder-matrix td{height:29px}.sensor-cylinder-matrix td button{min-height:27px;font-size:14px}.sensor-cylinder-matrix th{font-size:12px}}
@media(min-width:1800px){.sensor-board-overview{gap:12px}.sensor-board-overview :deep(.compact h4){font-size:13px}.sensor-board-overview :deep(.compact .sensor-reading-name){font-size:12px}.sensor-board-overview :deep(.compact .sensor-reading-value){font-size:15px}.sensor-board-overview :deep(.compact .sensor-reading){min-height:29px}.sensor-board-overview .sensor-area-heading strong,.sensor-board-overview .sensor-cylinder-matrix th,.sensor-board-overview .cylinder-column-head>span{font-size:13px}.sensor-board-overview .sensor-cylinder-matrix td{height:32px}.sensor-board-overview .sensor-cylinder-matrix td button{font-size:15px;min-height:30px}}
@media(max-width:1100px){.sensor-system-columns{grid-template-columns:repeat(2,minmax(0,1fr))}.sensor-system-column:nth-child(3){border-left:0;border-top:1px solid #e7ebf1}.sensor-system-column:nth-child(4){border-top:1px solid #e7ebf1}.device-sensor-groups{grid-template-columns:repeat(3,minmax(0,1fr))}.device-sensor-groups>.sensor-system{box-shadow:1px 0 #e7ebf1,0 1px #e7ebf1}.sensor-cylinder-matrix th:first-child{width:154px}.sensor-cylinder-matrix tbody th small{display:block;margin:2px 0 0}.sensor-cylinder-matrix td{height:32px}}
@media(max-width:760px){.sensor-board{gap:10px}.sensor-system-columns{grid-template-columns:1fr}.sensor-system-column+.sensor-system-column{border-left:0;border-top:1px solid #e7ebf1}.sensor-board-heading{align-items:flex-start;flex-wrap:wrap;gap:3px}.sensor-area-heading{flex-wrap:wrap;padding:7px 9px}.sensor-area-heading>span{font-size:9px}.sensor-cylinder-matrix th:first-child{width:132px}.sensor-cylinder-matrix{min-width:620px}.sensor-cylinder-matrix td{height:35px}.operating-sensor-area{grid-template-columns:1fr}.operating-sensor-area>.sensor-system+.sensor-system{border-left:0;border-top:1px solid #e7ebf1}.sensor-board-overview .operating-sensor-area :deep(.sensor-system){display:block}.operating-sensor-area :deep(.sensor-system-section){grid-template-columns:1fr}.device-sensor-groups{grid-template-columns:1fr 1fr}}
</style>
