<template>
  <div class="alarm-panel">
    <div v-if="!deviceId" class="alarm-toolbar">
      <input v-model.trim="keyword" class="alarm-search" type="search" placeholder="搜索设备名称或编号" aria-label="搜索设备" />
      <select v-model="statusFilter" aria-label="报警开关状态">
        <option value="all">全部状态</option>
        <option value="on">已开启</option>
        <option value="off">已关闭</option>
      </select>
    </div>

    <div class="alarm-table-wrap">
      <table class="alarm-table" :aria-label="deviceId ? '本设备报警设置' : '各设备报警设置'">
        <thead>
          <tr>
            <th v-if="!deviceId" scope="col">设备</th>
            <th scope="col">报警类型</th>
            <th scope="col">启用状态</th>
            <th scope="col">处理方式与参数</th>
            <th scope="col">最近更新</th>
          </tr>
        </thead>
        <tbody v-for="{ device, rows } in groups" :key="device.id">
          <tr v-for="(row, index) in rows" :key="row.key">
            <th v-if="!deviceId && index === 0" class="alarm-device" scope="rowgroup" :rowspan="rows.length">
              <strong>{{ device.name }}</strong>
              <small>{{ device.code }} · {{ device.deviceTypeName }}</small>
            </th>
            <th class="alarm-name" scope="row">{{ row.label }}</th>
            <td class="alarm-status">
              <ConfigSwitch :checked="Boolean(row.settings.enabled)" :label="device.name + ' · ' + row.label"
                on-text="已开启" off-text="已关闭" :disabled="configStore.saving"
                @toggle="update(device.id, row.key, { enabled: !row.settings.enabled })" />
            </td>
            <td class="alarm-options">
              <template v-if="row.key === 'oem'">{{ row.settings.enabled ? '记录并提交大模型研判' : '仅记录报警信号' }}</template>
              <select v-else-if="row.key === 'aiPeriodic'" :value="row.settings.intervalMinutes || 60"
                :disabled="configStore.saving || !row.settings.enabled" :aria-label="device.name + '检测周期'"
                @change="setParameter($event, device.id, row, 'intervalMinutes')">
                <option :value="15">每 15 分钟</option>
                <option :value="30">每 30 分钟</option>
                <option :value="60">每 1 小时</option>
                <option :value="120">每 2 小时</option>
              </select>
              <div v-else class="alarm-params">
                <select :value="row.settings.windowMonths || 3" :disabled="configStore.saving || !row.settings.enabled"
                  :aria-label="device.name + '跟踪窗口'" @change="setParameter($event, device.id, row, 'windowMonths')">
                  <option v-for="months in [1, 3, 6, 12]" :key="months" :value="months">近 {{ months }} 个月</option>
                </select>
                <select :value="row.settings.granularity || 'weekly'" :disabled="configStore.saving || !row.settings.enabled"
                  :aria-label="device.name + '统计周期'" @change="setParameter($event, device.id, row, 'granularity')">
                  <option value="weekly">按周对比</option><option value="monthly">按月对比</option>
                </select>
              </div>
            </td>
            <td class="alarm-updated">
              <time :datetime="row.settings.updatedAt">{{ formatTime(row.settings.updatedAt) }}</time>
              <small v-if="row.settings.updatedBy && row.settings.updatedBy !== 'system'">{{ row.settings.updatedBy }}</small>
            </td>
          </tr>
        </tbody>
        <tbody v-if="!groups.length">
          <tr><td class="alarm-empty" :colspan="deviceId ? 4 : 5">没有符合条件的报警设置</td></tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { useShipConfigStore } from '@/stores/shipConfigStore'
import ConfigSwitch from './ConfigSwitch.vue'

const props = defineProps({ deviceId: { type: String, default: '' } })
const configStore = useShipConfigStore()
const keyword = ref('')
const statusFilter = ref('all')
const alarmTypes = [
  { key: 'oem', label: 'OEM 报警' },
  { key: 'aiPeriodic', label: 'AI 周期检测' },
  { key: 'anomalyTracking', label: '异动跟踪' }
]
const groups = computed(() => {
  const term = keyword.value.toLowerCase()
  const devices = props.deviceId
    ? configStore.devices.filter(device => device.id === props.deviceId)
    : configStore.devices.filter(device => [device.name, device.code, device.deviceTypeName].some(value => value?.toLowerCase().includes(term)))

  return devices.map(device => {
    const rows = alarmTypes.map(type => ({ ...type, settings: device.alarms?.[type.key] || {} }))
    return {
      device,
      rows: props.deviceId || statusFilter.value === 'all'
        ? rows
        : rows.filter(row => Boolean(row.settings.enabled) === (statusFilter.value === 'on'))
    }
  }).filter(group => group.rows.length)
})

async function update(deviceId, alarmKey, patch) {
  try {
    await configStore.updateDeviceAlarm(deviceId, alarmKey, patch)
    ElMessage.success('报警设置已保存')
    return true
  } catch (error) {
    ElMessage.error(error.message || '保存报警设置失败')
    return false
  }
}
async function setParameter(event, deviceId, row, field) {
  const select = event.currentTarget
  const value = field === 'granularity' ? select.value : Number(select.value)
  if (!await update(deviceId, row.key, { [field]: value })) {
    select.value = row.settings[field]
  }
}
function formatTime(value) {
  if (!value) return '—'
  return new Date(value).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
}
</script>

<style scoped>
.alarm-panel { min-width: 0; color: var(--ui-ink); }
.alarm-toolbar, .alarm-params { display: flex; align-items: center; gap: 8px; }
.alarm-toolbar { margin-bottom: 12px; }
.alarm-search, .alarm-panel select {
  height: 32px; border: 1px solid var(--ui-border); border-radius: var(--ui-radius); padding: 0 9px;
  background: white; box-shadow: var(--ui-control-shadow); font: inherit; font-size: 12px; color: var(--ui-ink);
}
.alarm-search { width: 220px; max-width: 62%; }
.alarm-panel select:not(:disabled) { cursor: pointer; }
.alarm-panel select:disabled { color: var(--ui-muted); background: #f7f7f4; box-shadow: none; }
.alarm-table-wrap { border: 1px solid var(--ui-line); border-radius: var(--ui-radius); overflow: hidden; }
.alarm-table { width: 100%; border-collapse: collapse; font-size: 13px; }
.alarm-table th, .alarm-table td { padding: 12px 16px; text-align: left; vertical-align: middle; }
.alarm-table thead th { background: #f7f7f4; font-size: 12px; color: #62675f; font-weight: 600; }
.alarm-table tbody th, .alarm-table tbody td { border-top: 1px solid var(--ui-line); }
.alarm-table tbody + tbody tr:first-child > * { border-top-color: var(--ui-border-hover); }
.alarm-table .alarm-device { vertical-align: top; background: #fcfcfa; border-right: 1px solid var(--ui-line); }
.alarm-device strong, .alarm-name { font-weight: 600; }
.alarm-table small { display: block; margin-top: 3px; font-size: 11px; font-weight: 400; color: var(--ui-muted); }
.alarm-updated { font-variant-numeric: tabular-nums; white-space: nowrap; }
.alarm-status { white-space: nowrap; }
.alarm-params { flex-wrap: wrap; }
.alarm-table .alarm-empty { text-align: center; padding: 26px; color: var(--ui-muted); }

@media (max-width: 760px) {
  .alarm-table, .alarm-table tbody { display: block; }
  .alarm-table thead { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); }
  .alarm-table tr { display: grid; grid-template-columns: minmax(0, 1fr) auto; align-items: center; gap: 4px 12px; padding: 10px 12px; }
  .alarm-table tbody tr + tr, .alarm-table tbody + tbody { border-top: 1px solid var(--ui-line); }
  .alarm-table tbody th, .alarm-table tbody td { border: 0; padding: 0; }
  .alarm-table .alarm-device { grid-column: 1 / -1; margin: -10px -12px 5px; padding: 10px 12px; border-bottom: 1px solid var(--ui-line); }
  .alarm-table .alarm-status { justify-self: end; }
  .alarm-table .alarm-options, .alarm-table .alarm-updated, .alarm-table .alarm-empty { grid-column: 1 / -1; }
  .alarm-table .alarm-updated { font-size: 11px; color: var(--ui-muted); }
  .alarm-updated::before { content: '最近更新 '; }
  .alarm-updated small { display: inline; margin-left: 5px; }
}
</style>
