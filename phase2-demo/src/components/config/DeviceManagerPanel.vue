<template>
  <section class="device-mgr" :class="{ 'dm-scoped': deviceId }">
    <header v-if="!deviceId" class="dm-tools">
      <p><strong>{{ configStore.devices.length }}</strong> 台设备 <span>·</span> {{ configStore.enabledDevices.length }} 台已启用</p>
      <button type="button" class="dm-primary" :disabled="!configStore.loaded" @click="openAddModal">
        <Plus class="dm-icon" aria-hidden="true" />新增设备
      </button>
    </header>

    <div :class="{ 'dm-grid': !deviceId }">
      <article v-for="device in visibleDevices" :key="device.id" :class="deviceId ? 'dm-sheet' : 'dm-card'">
        <header v-if="deviceId" class="dm-sheet-head">
          <h3>基本信息</h3>
          <button type="button" class="dm-button" :disabled="!configStore.loaded" @click="openEditModal(device)">编辑信息</button>
        </header>
        <header v-else class="dm-card-head">
          <div>
            <h3>{{ device.name }} <small>{{ device.code }}</small></h3>
            <p>{{ device.deviceTypeName }}</p>
          </div>
        </header>
        <dl v-if="deviceId" class="dm-identifiers">
          <div><dt>设备编号</dt><dd>{{ device.code }}</dd></div>
          <div><dt>设备类型</dt><dd>{{ device.deviceTypeName }}</dd></div>
        </dl>
        <div class="dm-device-state">
          <span v-if="deviceId" class="dm-field-label">船端状态</span>
          <ConfigSwitch :checked="device.enabled" :label="`切换${device.name}船端启用状态`"
            :disabled="configStore.saving || !configStore.loaded" @toggle="toggleEnabled(device)" />
        </div>
        <div class="dm-points-total">
          <span class="dm-field-label">已接入点位</span>
          <strong>{{ device.enabledPointCount }} <small>/ {{ device.totalPointCount }}</small></strong>
        </div>
        <div class="dm-alarms" role="group" aria-label="报警状态">
          <span v-if="deviceId" class="dm-field-label">报警状态</span>
          <span v-for="alarm in alarmTypes" :key="alarm.key" class="dm-alarm-state"
            :class="{on: device.alarms?.[alarm.key]?.enabled}">
            <i aria-hidden="true"></i>{{ alarm.label }}
            <small>{{ device.alarms?.[alarm.key]?.enabled ? '已开启' : '已关闭' }}</small>
          </span>
        </div>
        <footer v-if="!deviceId" class="dm-card-foot">
          <button type="button" class="dm-button" :disabled="!configStore.loaded" @click="openEditModal(device)">编辑信息</button>
          <button type="button" class="dm-button dm-danger"
            :disabled="configStore.devices.length <= 1 || configStore.saving || !configStore.loaded" @click="confirmDelete(device)">删除</button>
        </footer>
      </article>
    </div>

    <dialog ref="dialog" class="dm-dialog" aria-labelledby="device-form-title" @cancel="onCancel">
      <form @submit.prevent="submitModal">
        <header class="dm-dialog-head">
          <h3 id="device-form-title">{{ modal.mode === 'add' ? '新增设备' : '编辑设备信息' }}</h3>
          <button type="button" aria-label="关闭弹窗" :disabled="configStore.saving" @click="dialog.close()"><Close class="dm-icon" aria-hidden="true" /></button>
        </header>
        <div class="dm-dialog-body">
          <div class="dm-fields">
            <label>设备类型
              <select v-model="modal.deviceTypeId" :disabled="modal.mode === 'edit'" required @change="resetPointSelection">
                <option v-for="tpl in configStore.templateTypes" :key="tpl.deviceTypeId" :value="tpl.deviceTypeId">{{ tpl.deviceTypeName }}</option>
              </select>
            </label>
            <label>设备名称 <input v-model.trim="modal.name" maxlength="48" placeholder="如 2 号主机" required /></label>
            <label>设备编号 <input v-model.trim="modal.code" maxlength="32" placeholder="如 ME-02" required /></label>
          </div>
          <template v-if="modal.mode === 'add'">
            <div class="dm-point-tools">
              <h4>接入点位 <small>已选 {{ modal.selectedCodes.length }} / {{ activeTemplate?.points.length || 0 }}</small></h4>
              <div>
                <button type="button" @click="resetPointSelection">全选</button>
                <button type="button" @click="modal.selectedCodes = []">清空</button>
              </div>
            </div>
            <input v-model.trim="modal.search" class="dm-search" type="search" aria-label="搜索点位" placeholder="搜索点位名称或编号" />
            <div class="dm-point-list" role="group" aria-label="可选点位">
              <section v-for="group in pointGroups" :key="group.systemId" class="dm-point-group">
                <h5>{{ group.systemName }}</h5>
                <label v-for="point in group.points" :key="point.pointCode" class="dm-point">
                  <input v-model="modal.selectedCodes" :value="point.pointCode" type="checkbox" />
                  <span>{{ point.defaultName }}</span>
                  <small>{{ point.pointCode }}<template v-if="point.unit"> · {{ point.unit }}</template></small>
                </label>
              </section>
              <p v-if="!pointGroups.length" class="dm-empty">无匹配点位</p>
            </div>
            <fieldset class="dm-alarm-fields">
              <legend>报警配置</legend>
              <label v-for="alarm in alarmTypes" :key="alarm.key">
                <input type="checkbox" v-model="modal.alarms[alarm.key]" />{{ alarm.label }}
              </label>
            </fieldset>
          </template>
        </div>
        <footer class="dm-dialog-foot">
          <p v-if="modal.error" role="alert">{{ modal.error }}</p>
          <button type="button" :disabled="configStore.saving" @click="dialog.close()">取消</button>
          <button type="submit" class="dm-primary" :disabled="configStore.saving">{{ configStore.saving ? '保存中…' : modal.mode === 'add' ? '确认新增' : '保存修改' }}</button>
        </footer>
      </form>
    </dialog>
  </section>
</template>

<script setup>
import { computed, reactive, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Close, Plus } from '@element-plus/icons-vue'
import { useShipConfigStore } from '@/stores/shipConfigStore'
import ConfigSwitch from './ConfigSwitch.vue'

const props = defineProps({ deviceId: { type: String, default: '' } })
const configStore = useShipConfigStore()
const visibleDevices = computed(() => props.deviceId ? configStore.devices.filter(device => device.id === props.deviceId) : configStore.devices)
const alarmTypes = [
  { key: 'oem', label: 'OEM 报警' },
  { key: 'aiPeriodic', label: 'AI 周期检测' },
  { key: 'anomalyTracking', label: '异动跟踪' }
]
const dialog = ref(null)
const modal = reactive({
  mode: 'add', deviceId: '', deviceTypeId: '', name: '', code: '',
  selectedCodes: [], search: '', alarms: {}, error: ''
})
const activeTemplate = computed(() => configStore.templateTypes.find(tpl => tpl.deviceTypeId === modal.deviceTypeId))
const pointGroups = computed(() => {
  const tpl = activeTemplate.value
  if (!tpl) return []
  const query = modal.search.toLowerCase()
  return tpl.systemTags.map(system => ({
    ...system,
    points: tpl.points.filter(point => point.systemId === system.systemId &&
      (!query || [point.defaultName, point.pointCode, system.systemName].some(value => value.toLowerCase().includes(query))))
  })).filter(group => group.points.length)
})

function resetPointSelection() {
  modal.selectedCodes = (activeTemplate.value?.points || []).map(point => point.pointCode)
}

function openAddModal() {
  Object.assign(modal, {
    mode: 'add', deviceId: '', deviceTypeId: configStore.templateTypes[0]?.deviceTypeId || '',
    name: '', code: '', search: '', error: '',
    alarms: { oem: false, aiPeriodic: true, anomalyTracking: false }
  })
  resetPointSelection()
  dialog.value.showModal()
}

function openEditModal(device) {
  Object.assign(modal, { mode: 'edit', deviceId: device.id, deviceTypeId: device.deviceTypeId, name: device.name, code: device.code, error: '' })
  dialog.value.showModal()
}

function onCancel(event) {
  if (configStore.saving) event.preventDefault()
}

async function submitModal() {
  modal.error = ''
  try {
    if (modal.mode === 'add') {
      if (!modal.selectedCodes.length) {
        modal.error = '请至少选择一个接入点位。'
        return
      }
      await configStore.addDevice({
        name: modal.name, code: modal.code, deviceTypeId: modal.deviceTypeId, selectedPointCodes: modal.selectedCodes,
        alarms: Object.fromEntries(alarmTypes.map(alarm => [alarm.key, { enabled: modal.alarms[alarm.key] }]))
      })
    } else {
      await configStore.updateDeviceMeta(modal.deviceId, { name: modal.name, code: modal.code })
    }
    ElMessage.success(`已${modal.mode === 'add' ? '新增' : '更新'}设备「${modal.name}」`)
    dialog.value.close()
  } catch (err) {
    modal.error = err.message || '保存失败'
  }
}

async function toggleEnabled(device) {
  try {
    await configStore.updateDeviceMeta(device.id, { enabled: !device.enabled })
  } catch (err) {
    ElMessage.error(err.message || '操作失败')
  }
}

async function confirmDelete(device) {
  try {
    await ElMessageBox.confirm(`确定移除「${device.name}」及其点位配置吗？`, '移除设备', {
      confirmButtonText: '移除设备', cancelButtonText: '取消', type: 'warning'
    })
    await configStore.deleteDevice(device.id)
    ElMessage.success(`已移除设备「${device.name}」`)
  } catch (err) {
    if (err !== 'cancel' && err !== 'close') ElMessage.error(err?.message || '删除设备失败')
  }
}
</script>

<style scoped>
.device-mgr { min-width: 0; flex: 1; min-height: 0; overflow: auto; padding: 18px 20px; color: var(--ui-ink); }
.dm-tools, .dm-card-head, .dm-dialog-head, .dm-dialog-foot, .dm-point-tools, .dm-points-total { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.dm-tools { justify-content: flex-start; flex-wrap: wrap; gap: 10px 16px; margin-bottom: 16px; }
.dm-tools p, .dm-card p { margin: 0; color: var(--ui-muted); font-size: 13px; }
.dm-tools strong { color: var(--ui-ink); }
.dm-tools .dm-primary, .dm-dialog-head button { display: inline-flex; align-items: center; justify-content: center; gap: 5px; }
.dm-icon { width: 15px; height: 15px; flex: none; }
.dm-tools p span { margin: 0 7px; }
.device-mgr button { font: inherit; cursor: pointer; color: inherit; }
.device-mgr button:disabled { opacity: .5; cursor: not-allowed; }
.dm-tools button, .device-mgr .dm-button, .dm-dialog-foot button {
  min-height: 32px; padding: 5px 11px; border: 1px solid var(--ui-border); border-radius: var(--ui-radius);
  background: linear-gradient(#fff, #fafaf7); box-shadow: var(--ui-control-shadow); font-size: 12px;
}
.device-mgr .dm-button:hover:not(:disabled), .dm-dialog-foot button:hover:not(:disabled) { border-color: var(--ui-border-hover); }
.device-mgr button.dm-primary { padding-inline: 15px; color: white; background: linear-gradient(#46483e, #30322b); border: 1px solid #383a31; box-shadow: 0 1px 2px #32342a21; font-size: 13px; font-weight: 600; }
.device-mgr button.dm-primary:hover:not(:disabled) { background: #44463b; }
.dm-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(100%, 340px), 1fr)); gap: 14px; }
.dm-card { display: grid; grid-template-columns: minmax(0,1fr) auto; gap: 16px 12px; min-width: 0; padding: 18px; background: #fff; border: 1px solid var(--ui-border); border-radius: var(--ui-radius); box-shadow: 0 1px 3px #24282007; }
.dm-card > :is(.dm-points-total,.dm-alarms,.dm-card-foot) { grid-column: 1 / -1; }
.dm-card .dm-device-state { align-self: start; }
.dm-card-head { align-items: flex-start; }
.dm-card-head h3, .dm-dialog-head h3, .dm-point-tools h4 { margin: 0; }
.dm-card-head h3 { font-size: 17px; overflow-wrap: anywhere; }
.dm-card-head h3 small { display: inline-block; font: 11px ui-monospace, monospace; color: var(--ui-muted); }
.dm-card-head p { margin-top: 4px; }
.dm-points-total { padding-bottom: 9px; border-bottom: 1px solid var(--ui-line); font-size: 13px; }
.dm-points-total strong, .dm-point-tools small { font-variant-numeric: tabular-nums; }
.dm-points-total small, .dm-point-tools small { font-weight: 400; color: var(--ui-muted); }
.dm-alarms, .dm-card-foot, .dm-alarm-fields { display: flex; align-items: center; flex-wrap: wrap; gap: 7px; }
.dm-alarm-state { display: inline-flex; align-items: center; gap: 5px; font-size: 12px; color: var(--ui-ink); white-space: nowrap; }
.dm-alarm-state small { color: var(--ui-muted); font-size: 11px; }
.dm-card .dm-alarms { gap: 6px 12px; }
.dm-alarms i { width: 6px; height: 6px; border-radius: 50%; background: #b8bcb2; }
.dm-alarms .on i { background: #368562; }
.dm-card-foot { margin-top: auto; }
.dm-card-foot .dm-button.dm-danger { margin-left: auto; color: #a54c41; }
.device-mgr.dm-scoped { padding: 2px 0; }
.dm-sheet { margin: 0; padding: 0; }
.dm-sheet-head { display: flex; align-items: center; gap: 16px; padding: 12px 0; border-bottom: 1px solid var(--ui-line); }
.dm-sheet-head h3 { margin: 0; font-size: 15px; font-weight: 600; }
.dm-sheet .dm-identifiers { margin: 0; }
.dm-sheet .dm-identifiers > div, .dm-sheet .dm-device-state, .dm-sheet .dm-points-total, .dm-sheet .dm-alarms {
  display: flex; align-items: center; flex-wrap: wrap; justify-content: flex-start; gap: 8px 14px;
  min-height: 44px; padding: 8px 0; box-sizing: border-box; border-bottom: 1px solid var(--ui-line); font-size: 13px;
}
.dm-sheet :is(dt,.dm-field-label) { flex: 0 0 92px; color: var(--ui-muted); }
.dm-sheet dd { margin: 0; }
.dm-sheet .dm-identifiers > div:first-child dd { font-family: ui-monospace, monospace; }
.dm-sheet .dm-alarms { column-gap: 14px; }
.dm-dialog { width: min(680px, calc(100vw - 28px)); max-width: none; max-height: calc(100dvh - 36px); margin: auto; padding: 0; color: var(--ui-ink); border: 1px solid var(--ui-border); border-radius: 12px; box-shadow: 0 16px 60px #24282036; }
.dm-dialog::backdrop { background: #24251f61; }
.dm-dialog form { display: flex; flex-direction: column; max-height: calc(100dvh - 40px); }
.dm-dialog-head, .dm-dialog-foot { flex-shrink: 0; padding: 14px 20px; }
.dm-dialog-head { border-bottom: 1px solid var(--ui-line); }
.dm-dialog-head h3 { font-size: 17px; }
.dm-dialog-head button { width: 28px; height: 28px; border: 0; background: transparent; font-size: 21px; color: var(--ui-muted); }
.dm-dialog-body { padding: 18px 20px; min-height: 0; overflow: auto; }
.dm-fields { display: grid; grid-template-columns: 1.1fr 1fr 1fr; gap: 12px; }
.dm-fields label { display: grid; gap: 5px; min-width: 0; font-size: 13px; }
.dm-fields input, .dm-fields select, .dm-search { box-sizing: border-box; width: 100%; min-width: 0; padding: 7px 10px; color: var(--ui-ink); background: #fff; border: 1px solid var(--ui-border); border-radius: 7px; font: inherit; font-size: 13px; }
.dm-fields select:disabled { background: var(--ui-warm); }
.dm-point-tools { margin: 18px 0 8px; }
.dm-point-tools h4, .dm-alarm-fields legend { font-size: 14px; font-weight: 600; }
.dm-point-tools small { margin-left: 4px; }
.dm-point-tools button { background: transparent; border: none; padding: 4px 6px; color: #785e35; font-size: 12px; }
.dm-point-list { overflow: auto; max-height: min(32vh, 260px); margin-top: 8px; border: 1px solid var(--ui-line); border-radius: 7px; }
.dm-point-group h5 { margin: 0; padding: 6px 10px; background: var(--ui-warm); color: #685e48; font-size: 12px; font-weight: 600; }
.dm-point, .dm-alarm-fields label { display: flex; align-items: center; gap: 8px; font-size: 13px; cursor: pointer; }
.dm-point { padding: 5px 10px; }
.dm-point:hover { background: #fbfaf7; }
.dm-point small { margin-left: auto; font: 11px ui-monospace, monospace; color: var(--ui-muted); white-space: nowrap; }
.dm-point input, .dm-alarm-fields input { accent-color: var(--ui-accent); }
.dm-empty { margin: 14px; text-align: center; color: var(--ui-muted); font-size: 13px; }
.dm-alarm-fields { border: 0; margin: 16px 0 0; padding: 0; gap: 12px; }
.dm-alarm-fields legend { margin-bottom: 5px; }
.dm-dialog-foot { justify-content: flex-end; border-top: 1px solid var(--ui-line); }
.dm-dialog-foot p { margin: 0 auto 0 0; color: #a54c41; font-size: 13px; }
@media(max-width: 680px) {
  .device-mgr { padding: 12px; }
  .dm-card { padding: 13px; }
  .dm-sheet :is(dt,.dm-field-label) { flex-basis: 72px; }
  .dm-sheet .dm-alarms { display: grid; grid-template-columns: 72px 1fr; }
  .dm-sheet .dm-alarms .dm-field-label { align-self: start; grid-row: span 3; }
  .dm-fields { grid-template-columns: 1fr 1fr; }
  .dm-fields label:first-child { grid-column: 1 / -1; }
  .dm-dialog-head, .dm-dialog-foot, .dm-dialog-body { padding: 12px; }
}
</style>
