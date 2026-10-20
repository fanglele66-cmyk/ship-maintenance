<template>
  <section class="sensor-system" :data-system-group="group.id">
    <header class="sensor-system-head">
      <EnginePartIcon :kind="group.icon" :size="36" />
      <div><h4>{{ group.title }}</h4><small v-if="group.code">{{ group.code }}</small></div>
    </header>
    <div v-for="(section, index) in group.sections" :key="index" class="sensor-system-section">
      <div v-if="section.title" class="sensor-section-label">{{ section.title }}</div>
      <button v-for="sensor in section.sensors" :key="sensor.id" type="button" class="sensor-reading"
        :data-sensor-id="sensor.id" :aria-label="`查看${sensor.nameCn}的趋势分析`"
        :title="`${sensor.nameCn} · ${sensor.nameEn || ''}`" @click="$emit('selectSensor', sensor)">
        <span class="sensor-reading-name">{{ sensor.nameCn }}</span>
        <span class="sensor-reading-value">{{ formatSensorValue(sensor) }}<small>{{ sensor.unit }}</small><i aria-hidden="true">›</i></span>
      </button>
    </div>
  </section>
</template>

<script setup>
import EnginePartIcon from './EnginePartIcon.vue'
import { formatSensorValue } from '@/mock/sensorLayout.js'
defineProps({ group: { type: Object, required: true } })
defineEmits(['selectSensor'])
</script>

<style scoped>
.sensor-system{min-width:0;padding:10px 14px 12px}
.sensor-system-head{display:flex;align-items:center;gap:8px;min-height:39px;margin-bottom:6px}
.sensor-system-head>div{min-width:0}
h4{margin:0;font-size:13px;font-weight:600;line-height:1.5;color:#354052}
.sensor-system-head small{display:block;font-size:9px;letter-spacing:1.05px;color:#8993a1;line-height:1.5}
.sensor-system-section+.sensor-system-section{margin-top:6px}
.sensor-section-label{font-size:10px;line-height:1.8;color:#8993a1;padding:1px 5px 2px}
.sensor-reading{display:flex;width:100%;align-items:center;justify-content:space-between;gap:10px;min-height:31px;padding:5px;border:0;border-radius:4px;background:transparent;font:inherit;cursor:pointer;text-align:left}
.sensor-reading+.sensor-reading{border-top:1px solid #f1f3f6}
.sensor-reading-name{min-width:0;font-size:12px;color:#667184;line-height:1.5}
.sensor-reading-value{display:inline-flex;align-items:baseline;gap:4px;flex:none;color:#354052;font:600 15px/1.4 Consolas,monospace;font-variant-numeric:tabular-nums}
.sensor-reading-value small{min-width:17px;font:400 10px/1.5 Arial,sans-serif;color:#8993a1}
.sensor-reading-value i{color:#a6b0bf;font:400 14px/1 Arial,sans-serif;width:6px}
.sensor-reading:hover{background:#edf4ff}
.sensor-reading:hover .sensor-reading-value,.sensor-reading:hover .sensor-reading-value i{color:#106bff}
.sensor-reading:focus-visible{outline:2px solid #106bff;outline-offset:1px;background:#edf4ff}
</style>
