<template>
  <section class="home-core-sensors" aria-label="核心传感器">
    <ModuleHeader title="核心传感器">
      <span class="sampling-source">{{ store.simulationConfig.enabled ? `${store.simulationConfig.intervalSeconds}秒刷新` : '采样已暂停' }}</span>
      <time :datetime="sampleTimeIso">更新于 {{ sampleTimeLabel }}</time>
    </ModuleHeader>
    <dl class="core-sensor-grid">
      <div v-for="point in readings" :key="point.id" class="core-sensor" :data-sensor-id="point.id">
        <dt>
          <span class="core-sensor-device">{{ point.device }}</span>
          <span class="core-sensor-name">{{ point.label }}</span>
        </dt>
        <dd :class="{ 'reading-alert': point.sensor?.status === 'over' }">
          <span class="core-sensor-value">{{ formatSensorValue(point.sensor) }}</span>
          <small>{{ point.sensor?.unit || point.unit }}</small>
          <span v-if="point.sensor?.status === 'over'" class="reading-status">超限</span>
        </dd>
      </div>
    </dl>
  </section>
</template>

<script setup>
import { computed } from 'vue'
import ModuleHeader from './ModuleHeader.vue'
import { useSensorStore } from '@/stores/sensorStore'
import { formatSensorValue } from '@/mock/sensorLayout.js'

const store = useSensorStore()
// References only: values and sampling time remain owned by the shared sensor store.
const corePoints = [
  { id: 'main-fuel-rail-pressure', device: '主机 · 燃油', label: '燃油共轨压力', unit: 'bar' },
  { id: 'main-servo-rail-pressure', device: '主机 · 伺服油', label: '伺服油共轨压力', unit: 'bar' },
  { id: 'main-control-air-pressure', device: '主机 · 控制空气', label: '控制空气进口压力', unit: 'bar' },
  { id: 's-009', device: '主机 · 润滑', label: '滑油压力', unit: 'MPa' },
  { id: 's-004', device: '主机 · 排气', label: '排气温度', unit: '°C' },
  { id: 's-007', device: '主机 · 冷却', label: '缸套水出口温度', unit: '°C' },
  { id: 'aux-1-load', device: '1号辅机 · 发电', label: '发电负荷', unit: '%' },
  { id: 'aux-2-load', device: '2号辅机 · 发电', label: '发电负荷', unit: '%' },
]
const readings = computed(() => {
  const byId = new Map(store.allSensors.map(sensor => [sensor.id, sensor]))
  return corePoints.map(point => ({ ...point, sensor: byId.get(point.id) }))
})
const sampleTimeIso = computed(() => new Date(store.sampledAt).toISOString())
const sampleTimeLabel = computed(() => new Date(store.sampledAt).toLocaleTimeString('zh-CN', { hour12: false, timeZone: 'Asia/Shanghai' }))
</script>

<style scoped>
.home-core-sensors{min-width:0;background:#fff;border:1px solid #e6ebf2;border-radius:8px;overflow:hidden}
.home-core-sensors :deep(.module-header){padding:10px 18px;min-height:42px;box-sizing:border-box}
.home-core-sensors :deep(.module-header h3){font-size:var(--home-title-size,23px);color:#293646}
.home-core-sensors :deep(.module-tools){gap:8px 16px;font-size:15px}
.sampling-source{color:#8c806a;font-size:15px}
.core-sensor-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));margin:0;padding:0 18px 4px;gap:0 24px}
.core-sensor{min-width:0;padding:10px 0;border-top:1px solid #eceeea}
.core-sensor dt{display:flex;flex-direction:column;align-items:flex-start;gap:2px}
.core-sensor-device{font-size:14px;color:#798780;line-height:1.5;white-space:nowrap}
.core-sensor-name{font-size:17px;color:#52667d;line-height:1.5;overflow-wrap:anywhere}
.core-sensor dd{display:flex;align-items:baseline;flex-wrap:wrap;gap:7px;margin:3px 0 0;color:#263e52;line-height:1.25}
.core-sensor-value{font-size:31px;font-weight:600;font-variant-numeric:tabular-nums;letter-spacing:-.5px}
.core-sensor small{font-size:15px;color:#7c8c98;font-weight:400}
.core-sensor .reading-alert{color:#bd5c50}
.reading-status{font-size:13px;line-height:1.6;padding:1px 5px;border-radius:3px;background:#fcf0ed;color:#b56154;align-self:center}
@media(max-width:1600px){.core-sensor-grid{gap:0 16px}.core-sensor-value{font-size:27px}.core-sensor-name{font-size:15px}.core-sensor-device{font-size:13px}}
@media(max-width:1100px){.core-sensor-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.core-sensor{padding:12px 0}}
@media(max-width:400px){.home-core-sensors :deep(.module-tools){margin-left:0}.core-sensor-grid{gap:0 12px;padding:0 14px 10px}.core-sensor-value{font-size:23px}}
</style>
