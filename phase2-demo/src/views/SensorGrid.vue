<template>
  <div class="sensor-grid">
    <div class="sg-tabs-wrapper">
      <div class="sg-tabs" aria-label="传感器系统筛选">
        <template v-if="sensorStore.currentDeviceId">
          <button v-for="tag in sensorStore.currentSubsystemTags" :key="tag" type="button"
            class="filter-tag" :class="{ active: sensorStore.currentSubsystem === tag }"
            :aria-pressed="sensorStore.currentSubsystem === tag" @click="sensorStore.setSubsystem(tag)">{{ tag }}</button>
        </template>
        <template v-else>
          <button v-for="tag in systemTags" :key="tag" type="button"
            class="filter-tag" :class="{ active: sensorStore.currentSystem === tag }"
            :aria-pressed="sensorStore.currentSystem === tag" @click="sensorStore.setSystem(tag)">{{ tag }}</button>
        </template>
      </div>
      <span class="sg-stats">{{ filteredSensors.length }} 个测点</span>
    </div>

    <div ref="listScrollRef" class="sg-content-scroll">
      <div class="sensor-layout">
        <template v-if="layout.main">
          <div class="sensor-layout-heading"><div><span class="sensor-layout-kicker">MAIN ENGINE</span><h3>主机测点总览 <small>RT-flex50 · 六缸配置</small></h3></div><span>点击读数查看趋势 <b aria-hidden="true">↗</b></span></div>
          <section v-if="layout.main.columns.length" class="shared-sensor-area" aria-label="主机共用系统测点">
            <div class="sensor-area-heading"><strong>共用系统</strong><span>燃油 · 油路 · 空气 · 排气 · 冷却</span></div>
            <div class="sensor-system-columns">
              <div v-for="(column, index) in layout.main.columns" :key="index" class="sensor-system-column">
                <SensorReadingGroup v-for="group in column" :key="group.id" :group="group" @select-sensor="emit('selectSensor', $event)" />
              </div>
            </div>
          </section>

          <section v-if="layout.main.matrix.length" class="cylinder-sensor-area" aria-label="六缸传感器矩阵">
            <div class="sensor-area-heading"><strong>气缸测点对照</strong><span>同一指标横向查看 1–6 缸</span></div>
            <div class="sensor-matrix-scroll" tabindex="0" aria-label="可横向滚动的六缸测点表">
              <table class="sensor-cylinder-matrix">
                <thead><tr><th scope="col">测量指标 <small>单位</small></th><th v-for="number in sensorCylinderNumbers" :key="number" scope="col"><div class="cylinder-column-head"><EnginePartIcon kind="cylinder" :size="36" /><span>{{ number }}<small>缸</small></span></div></th></tr></thead>
                <tbody><tr v-for="row in layout.main.matrix" :key="row.id" :data-cylinder-topic="row.id">
                  <th scope="row"><span>{{ row.name }}</span><small>{{ row.unit }}<template v-if="row.note"> · {{ row.note }}</template></small></th>
                  <td v-for="cell in row.cells" :key="cell.number">
                    <button v-if="cell.sensor" type="button" :data-sensor-id="cell.sensor.id"
                      :aria-label="`查看${cell.sensor.nameCn}的趋势分析`" :title="`${cell.sensor.nameCn} · ${cell.sensor.nameEn || ''} · ${cell.sensor.unit}`"
                      @click="emit('selectSensor', cell.sensor)">{{ formatSensorValue(cell.sensor) }}<i aria-hidden="true">›</i></button>
                    <span v-else class="sensor-cell-empty" aria-label="当前筛选无匹配测点">—</span>
                  </td>
                </tr></tbody>
              </table>
            </div>
          </section>

          <section v-if="layout.main.operatingGroups.length" class="operating-sensor-area" aria-label="主机运行与机械参数">
            <SensorReadingGroup v-for="group in layout.main.operatingGroups" :key="group.id" :group="group" @select-sensor="emit('selectSensor', $event)" />
          </section>
          <section v-if="layout.main.additionalGroups.length" class="extra-sensor-area" aria-label="主机其他测点">
            <div class="sensor-area-heading"><strong>其他测点</strong></div>
            <div class="device-sensor-groups"><SensorReadingGroup v-for="group in layout.main.additionalGroups" :key="group.id" :group="group" @select-sensor="emit('selectSensor', $event)" /></div>
          </section>
        </template>

        <section v-for="device in layout.devices" :key="device.id" class="device-sensor-area" :data-device-group="device.id" :aria-label="`${device.name}系统测点`">
          <div class="sensor-layout-heading"><div><span class="sensor-layout-kicker">EQUIPMENT</span><h3>{{ device.name }}测点总览</h3></div><span>{{ device.count }} 个测点 · 点击读数查看趋势</span></div>
          <div class="device-sensor-groups"><SensorReadingGroup v-for="group in device.groups" :key="group.id" :group="group" @select-sensor="emit('selectSensor', $event)" /></div>
        </section>
        <div v-if="!filteredSensors.length" class="empty-state">未找到匹配的传感器</div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, nextTick } from 'vue'
import { useSensorStore } from '@/stores/sensorStore'
import { systemTags } from '@/mock/sensors'
import { buildSensorLayout, filterSensorReadings, formatSensorValue, sensorCylinderNumbers } from '@/mock/sensorLayout.js'
import EnginePartIcon from '@/components/EnginePartIcon.vue'
import SensorReadingGroup from '@/components/SensorReadingGroup.vue'

const emit = defineEmits(['selectSensor'])
const props = defineProps({ searchQuery: { type: String, default: '' } })
const sensorStore = useSensorStore()
const listScrollRef = ref(null)
const filteredSensors = computed(() => filterSensorReadings(sensorStore.filteredSensors, props.searchQuery))
const layout = computed(() => buildSensorLayout(filteredSensors.value))

watch(() => filteredSensors.value.map(sensor => sensor.id).sort().join('|'), () => {
  nextTick(() => listScrollRef.value?.scrollTo({ top: 0 }))
})
</script>

<style scoped>
.sensor-grid{height:100%;min-width:0;display:flex;flex-direction:column;overflow:hidden}
.sg-tabs-wrapper{display:flex;align-items:center;gap:16px;padding:10px 16px 8px;flex-shrink:0;min-width:0}
.sg-tabs{min-width:0;flex:1;display:flex;align-items:center;gap:6px;overflow-x:auto;scrollbar-width:thin;scrollbar-color:#d8dee8 transparent;padding-bottom:3px}
.filter-tag{height:32px;box-sizing:border-box;flex:none;padding:5px 12px;border:1px solid #e1e2e5;border-radius:7px;background:#f7f7f8;color:#686a70;font:inherit;font-size:12px;line-height:20px;cursor:pointer;white-space:nowrap}
.filter-tag:hover{color:#106bff;background:#f5f9ff;border-color:#bfd4ff}
.filter-tag.active{color:#106bff;background:#edf4ff;border-color:#bfd4ff;font-weight:600}
.filter-tag:focus-visible{outline:2px solid #106bff;outline-offset:1px}
.sg-stats{flex:none;color:#8993a1;font-size:12px;white-space:nowrap}
.sg-content-scroll{flex:1;min-height:0;min-width:0;overflow:auto}
.sensor-layout{min-width:0;padding:7px 16px 22px}
.sensor-layout-heading{display:flex;align-items:flex-end;justify-content:space-between;gap:16px;margin:0 0 13px}
.sensor-layout-kicker{font-size:9px;color:#8a94a5;letter-spacing:1.5px;font-weight:600}
.sensor-layout-heading h3{margin:3px 0 0;color:#344054;font-size:16px;line-height:1.5}
.sensor-layout-heading h3 small{font-size:11px;font-weight:400;color:#8993a1;margin-left:10px;white-space:nowrap}
.sensor-layout-heading>span{font-size:11px;color:#8993a1;flex:none;padding-bottom:2px}
.sensor-layout-heading>span b{font-size:14px;font-weight:400;margin-left:4px}
.shared-sensor-area,.cylinder-sensor-area,.operating-sensor-area,.extra-sensor-area,.device-sensor-groups{min-width:0;border:1px solid #e2e7ef;border-radius:8px;background:#fff;overflow:hidden}
.sensor-area-heading{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:10px 14px;background:#f7f9fc;border-bottom:1px solid #e7ebf1}
.sensor-area-heading strong{color:#465265;font-size:12px;font-weight:600}
.sensor-area-heading>span{color:#8993a1;font-size:10px}
.sensor-system-columns{display:grid;grid-template-columns:repeat(3,minmax(0,1fr))}
.sensor-system-column{min-width:0}
.sensor-system-column+.sensor-system-column{border-left:1px solid #e7ebf1}
.sensor-system-column>.sensor-system+.sensor-system{border-top:1px solid #e7ebf1}
.cylinder-sensor-area{margin-top:14px}
.sensor-matrix-scroll{overflow-x:auto;max-width:100%}
.sensor-matrix-scroll:focus-visible{outline:2px solid #106bff;outline-offset:-2px}
.sensor-cylinder-matrix{border-collapse:collapse;width:100%;min-width:690px;table-layout:fixed;color:#465265}
.sensor-cylinder-matrix thead th{height:58px;background:linear-gradient(#fff,#fafbfc);border-bottom:1px solid #e5eaf1}
.sensor-cylinder-matrix th:first-child{width:194px;text-align:left;padding:8px 16px;position:sticky;left:0;z-index:2;background:#fff;box-shadow:1px 0 #e7ebf1}
.sensor-cylinder-matrix tbody tr:nth-child(even) th:first-child{background:#fbfcfe}
.sensor-cylinder-matrix th{font-size:12px;font-weight:500}
.sensor-cylinder-matrix th small{display:block;color:#98a1af;font-size:10px;line-height:1.5;margin-top:3px;font-weight:400}
.cylinder-column-head{display:flex;align-items:center;justify-content:center;gap:3px}
.cylinder-column-head>span{font:600 20px/1.1 Consolas,monospace;color:#556377}
.cylinder-column-head>span small{display:inline;font:400 10px/1.5 inherit;margin-left:3px}
.sensor-cylinder-matrix td{padding:3px 5px;text-align:center;border-left:1px solid #eff2f7;height:40px}
.sensor-cylinder-matrix tbody tr+tr{border-top:1px solid #eef1f5}
.sensor-cylinder-matrix tbody tr:nth-child(even){background:#fbfcfe}
.sensor-cylinder-matrix td button{position:relative;display:block;width:100%;min-height:33px;padding:5px 12px 5px 5px;border:0;border-radius:4px;background:transparent;color:#3d4a5d;font:600 16px/1.4 Consolas,monospace;cursor:pointer;font-variant-numeric:tabular-nums}
.sensor-cylinder-matrix td button i{position:absolute;right:4px;top:50%;transform:translateY(-50%);color:#afbac9;font:400 13px/1 Arial,sans-serif}
.sensor-cylinder-matrix td button:hover{color:#106bff;background:#edf4ff}
.sensor-cylinder-matrix td button:focus-visible{outline:2px solid #106bff;outline-offset:0}
.sensor-cell-empty{color:#c0c7d1;font-size:13px}
.operating-sensor-area{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,2fr);margin-top:14px}
.operating-sensor-area>.sensor-system+.sensor-system{border-left:1px solid #e7ebf1}
.operating-sensor-area :deep(.sensor-system-section){display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:0 15px}
.operating-sensor-area :deep(.sensor-reading+.sensor-reading){border-top:0}
.device-sensor-area{min-width:0;margin-top:22px}
.device-sensor-area:first-child{margin-top:0}
.device-sensor-groups{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));background:#fff}
.device-sensor-groups>.sensor-system{background:#fff;box-shadow:1px 0 #e7ebf1,0 1px #e7ebf1}
.extra-sensor-area{margin-top:14px}
.extra-sensor-area>.device-sensor-groups{border:0;border-radius:0}
.empty-state{padding:48px 16px;text-align:center;font-size:13px;color:#8993a1}
@media(max-width:1200px){.sensor-system-columns{grid-template-columns:repeat(2,minmax(0,1fr))}.sensor-system-column:last-child:nth-child(odd){grid-column:1 / -1;display:grid;grid-template-columns:repeat(2,minmax(0,1fr));border-left:0;border-top:1px solid #e7ebf1}.sensor-system-column:last-child:nth-child(odd)>.sensor-system+.sensor-system{border-top:0;border-left:1px solid #e7ebf1}.operating-sensor-area{grid-template-columns:1fr 1.4fr}.operating-sensor-area :deep(.sensor-system-section){grid-template-columns:1fr}.device-sensor-groups{grid-template-columns:repeat(2,minmax(0,1fr))}}
@media(max-width:760px){.sg-tabs-wrapper{padding:10px 10px 6px;gap:10px}.sg-stats{font-size:10px}.sensor-layout{padding:6px 10px 16px}.sensor-layout-heading{align-items:flex-start;gap:8px;flex-direction:column;margin-bottom:10px}.sensor-layout-heading h3{font-size:15px}.sensor-layout-heading h3 small{font-size:10px;margin-left:6px}.sensor-layout-heading>span{font-size:10px}.sensor-system-columns{grid-template-columns:1fr}.sensor-system-column+.sensor-system-column{border-left:0;border-top:1px solid #e7ebf1}.sensor-system-column:last-child:nth-child(odd){display:block;grid-column:auto}.sensor-system-column:last-child:nth-child(odd)>.sensor-system+.sensor-system{border-left:0;border-top:1px solid #e7ebf1}.sensor-area-heading{padding:9px 12px}.sensor-area-heading>span{font-size:9px}.operating-sensor-area{grid-template-columns:1fr}.operating-sensor-area>.sensor-system+.sensor-system{border-left:0;border-top:1px solid #e7ebf1}.operating-sensor-area :deep(.sensor-system-section){grid-template-columns:1fr}.device-sensor-groups{grid-template-columns:1fr}.sensor-cylinder-matrix th:first-child{width:134px;padding-left:10px;padding-right:8px}.sensor-cylinder-matrix{min-width:650px}}
@media(prefers-reduced-motion:reduce){*{scroll-behavior:auto}}
</style>
