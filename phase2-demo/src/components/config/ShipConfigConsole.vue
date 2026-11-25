<template>
  <section class="cfg-console" :class="{ 'cfg-global': !scoped, 'cfg-device': scoped, 'cfg-device-points': scoped && (activeSection === 'points' || activeSection === 'point-query') }" :aria-label="scoped ? '当前设备配置' : '本船配置'">
    <div v-if="configStore.loading && !configStore.loaded" class="cfg-feedback" role="status">正在读取配置…</div>
    <div v-else-if="!configStore.loaded && configStore.error" class="cfg-feedback" role="alert">
      {{ configStore.error }}
      <button type="button" @click="configStore.loadConfig()">重新加载</button>
    </div>
    <div v-else-if="scoped && !device" class="cfg-feedback">未找到当前设备的配置</div>
    <template v-else>
      <nav class="cfg-sections" :aria-label="scoped ? '设备配置项目' : '本船配置项目'">
        <button v-for="section in sections" :key="section.id" type="button"
          :aria-current="section.id === activeSection ? 'page' : undefined"
          :class="{ active: section.id === activeSection }"
          @click="activeSection = section.id">{{ section.label }}</button>
      </nav>

      <section class="cfg-workspace">
        <DeviceManagerPanel v-if="activeSection === 'devices'" :device-id="activeDeviceId" />
        <AlarmConfigPanel v-else-if="activeSection === 'alarms'" :device-id="activeDeviceId" />
        <PointListPanel v-else-if="activeSection === 'points'" :device-id="activeDeviceId" />
        <PointQueryPanel v-else-if="activeSection === 'point-query'" :device-id="activeDeviceId" />
      </section>
    </template>
  </section>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { useShipConfigStore } from '@/stores/shipConfigStore'
import AlarmConfigPanel from './AlarmConfigPanel.vue'
import DeviceManagerPanel from './DeviceManagerPanel.vue'
import PointListPanel from './PointListPanel.vue'
import PointQueryPanel from './PointQueryPanel.vue'

const props = defineProps({ activeDeviceId: { type: String, default: '' } })
const configStore = useShipConfigStore()
const scoped = computed(() => Boolean(props.activeDeviceId))
const device = computed(() => configStore.devices.find(item => item.id === props.activeDeviceId))
const sections = computed(() => scoped.value ? [
  { id: 'alarms', label: '报警设置' },
  { id: 'points', label: '点位配置' },
  { id: 'devices', label: '设备信息' },
  { id: 'point-query', label: '点位查询' }
] : [
  { id: 'devices', label: '设备管理' },
  { id: 'alarms', label: '报警设置' },
  { id: 'points', label: '点位配置' },
  { id: 'point-query', label: '点位查询' }
])
const activeSection = ref(sections.value[0].id)
watch(() => props.activeDeviceId, () => {
  activeSection.value = sections.value[0].id
})
</script>

<style scoped>
.cfg-console { display: flex; flex-direction: column; flex: 1; min-height: 0; min-width: 0; overflow: hidden; color: var(--ui-ink); background: white; }
.cfg-global { margin: 12px; padding: 0 20px 16px; border-radius: 10px; }
.cfg-device { margin-top: 10px; }
.cfg-sections { display: flex; flex: none; gap: 8px; overflow-x: auto; }
.cfg-sections { border-bottom: 1px solid var(--ui-line); }
.cfg-sections button { flex: none; font: inherit; font-size: 13px; cursor: pointer; color: #646963; white-space: nowrap; }
.cfg-sections button { padding: 14px 5px 12px; margin-right: 12px; border: 0; border-bottom: 2px solid transparent; background: transparent; }
.cfg-sections button:hover, .cfg-sections button.active { color: var(--ui-accent); }
.cfg-sections button.active { font-weight: 650; border-color: var(--ui-accent-line); }
.cfg-device .cfg-sections { align-self: flex-start; max-width: 100%; gap: 2px; padding: 3px; border: 1px solid var(--ui-line); border-radius: 8px; background: #f5f5f2; }
.cfg-device .cfg-sections button { padding: 5px 10px; margin: 0; border: 1px solid transparent; border-radius: 5px; font-size: 12px; }
.cfg-device .cfg-sections button.active { background: white; border-color: var(--ui-border); box-shadow: var(--ui-control-shadow); }
.cfg-workspace { display: flex; flex-direction: column; flex: 1; min-height: 0; min-width: 0; padding-top: 12px; overflow: auto; }
.cfg-feedback button { border: 1px solid var(--ui-border); border-radius: 6px; padding: 5px 10px; background: white; box-shadow: var(--ui-control-shadow); }
.cfg-feedback { padding: 24px; color: var(--ui-muted); }
@media (min-width: 741px) {
  .cfg-device-points {
    display: grid;
    grid-template-columns: max-content minmax(0, 1fr);
    grid-template-rows: auto minmax(0, 1fr);
    grid-template-areas: "navigation detail" "tree detail";
    gap: 10px 12px;
  }
  .cfg-device-points .cfg-sections { grid-area: navigation; justify-self: start; }
  .cfg-device-points .cfg-feedback { grid-column: 1 / -1; }
  .cfg-device-points .cfg-workspace,
  .cfg-device-points :deep(.point-list-view),
  .cfg-device-points :deep(.pq-view) { display: contents; }
  .cfg-device-points :deep(.pl-tree-pane),
  .cfg-device-points :deep(.pq-sidebar) { grid-area: tree; width: auto; min-width: 0; min-height: 0; contain: inline-size; }
  .cfg-device-points :deep(.pl-detail-pane),
  .cfg-device-points :deep(.pq-canvas) { grid-area: detail; min-height: 0; background: #f7f7f4; }
  .cfg-device-points :deep(.pl-detail-head) { padding-top: 6px; }
  .cfg-device-points :deep(.pq-canvas) { padding: 0; }
}
@media (max-width: 760px) {
  .cfg-global { margin: 6px; padding: 0 10px 8px; }
  .cfg-sections { gap: 2px; }
  .cfg-sections button { margin-right: 5px; }
}
</style>
