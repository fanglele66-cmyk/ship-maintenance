<template>
  <div class="point-list-view">
    <!-- Left: 3-level Tree (Device -> System -> Point) -->
    <aside class="pl-tree-pane" aria-label="设备点位树形目录">
      <div class="pl-tree-head">
        <div class="pl-tree-title">
          <span class="pl-accent-bar"></span>
          <strong>点位目录</strong>
        </div>
        <div class="pl-tree-filters">
          <label class="pl-search">
            <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <circle cx="11" cy="11" r="6.5" />
              <path d="m16 16 4 4" />
            </svg>
            <input v-model="searchQuery" type="search" placeholder="搜索点位编号/名称/系统" aria-label="搜索点位" />
          </label>
          <div class="pl-filter-row" role="group" aria-label="启用状态筛选">
            <button type="button" :class="{ active: statusFilter === 'all' }" @click="statusFilter = 'all'">全部</button>
            <button type="button" :class="{ active: statusFilter === 'enabled' }" @click="statusFilter = 'enabled'">已启用</button>
            <button type="button" :class="{ active: statusFilter === 'disabled' }" @click="statusFilter = 'disabled'">未启用</button>
          </div>
        </div>
      </div>

      <div class="pl-tree-scroll">
        <section v-for="device in treeDevices" :key="device.id" class="pl-device-node">
          <div
            class="pl-node-row pl-device-row"
            :class="{ selected: selection.kind === 'device' && selection.deviceId === device.id }"
          >
            <button
              type="button"
              class="pl-caret-btn"
              :aria-expanded="isDeviceExpanded(device.id)"
              @click="toggleDevice(device.id)"
            >
              <svg :class="{ open: isDeviceExpanded(device.id) }" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="m9 6 6 6-6 6" />
              </svg>
            </button>
            <button type="button" class="pl-row-label" @click="selectDevice(device.id)">
              <span class="pl-dev-name">{{ device.name }}</span>
              <span class="pl-count">{{ device.enabledPointCount }}/{{ device.totalPointCount }}</span>
            </button>
          </div>

          <div v-show="isDeviceExpanded(device.id)" class="pl-system-list">
            <div v-for="sys in device.systems" :key="`${device.id}:${sys.systemId}`" class="pl-system-node">
              <div
                class="pl-node-row pl-system-row"
                :class="{ selected: selection.kind === 'system' && selection.deviceId === device.id && selection.systemId === sys.systemId }"
              >
                <button
                  type="button"
                  class="pl-caret-btn"
                  :aria-expanded="isSystemExpanded(device.id, sys.systemId)"
                  @click="toggleSystem(device.id, sys.systemId)"
                >
                  <svg :class="{ open: isSystemExpanded(device.id, sys.systemId) }" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <path d="m9 6 6 6-6 6" />
                  </svg>
                </button>
                <input
                  type="checkbox"
                  class="pl-sys-check"
                  :checked="sys.allEnabled"
                  :indeterminate.prop="sys.someEnabled && !sys.allEnabled"
                  :disabled="configStore.saving"
                  :aria-label="`批量切换${device.name}${sys.systemName}点位`"
                  @change="onToggleSystem(device.id, sys.systemId, $event.target.checked)"
                />
                <button type="button" class="pl-row-label" @click="selectSystem(device.id, sys.systemId)">
                  <span class="pl-sys-name">{{ sys.systemName }}</span>
                  <span class="pl-count">{{ sys.enabledCount }}/{{ sys.totalCount }}</span>
                </button>
              </div>

              <div v-show="isSystemExpanded(device.id, sys.systemId)" class="pl-point-leaves">
                <button
                  v-for="pt in sys.points"
                  :key="pt.pointCode"
                  type="button"
                  class="pl-leaf-row"
                  :class="{
                    selected: selection.kind === 'point' && selection.deviceId === device.id && selection.pointCode === pt.pointCode,
                    off: !pt.enabled
                  }"
                  @click="selectPoint(device.id, pt.pointCode)"
                >
                  <span class="pl-leaf-dot" :class="[pt.pointKind, { off: !pt.enabled }]"></span>
                  <span class="pl-leaf-name">{{ pt.instanceName }}</span>
                  <span class="pl-leaf-code">{{ pt.pointCode }}</span>
                </button>
              </div>
            </div>
          </div>
        </section>

        <div v-if="treeDevices.length === 0" class="pl-tree-empty">未找到匹配的点位</div>
      </div>
    </aside>

    <!-- Right: Detail / Editor Pane -->
    <main class="pl-detail-pane">
      <!-- Single Point Editor -->
      <template v-if="selection.kind === 'point' && activePoint">
        <header class="pl-detail-head">
          <div class="pl-detail-title-group">
            <div class="pl-title-badges">
              <span class="code-pill">{{ activePoint.pointCode }}</span>
              <span class="kind-pill" :class="activePoint.pointKind">
                {{ activePoint.pointKind === 'alarm' ? '报警点位' : '数值点位' }}
              </span>
              <span class="sys-pill">{{ activePoint.deviceName }} · {{ activePoint.systemName }}</span>
            </div>
            <h3>{{ activePoint.instanceName }}</h3>
          </div>

          <ConfigSwitch :checked="activePoint.enabled" :label="`切换点位${activePoint.pointCode}启用状态`"
            :disabled="configStore.saving" @toggle="quickTogglePoint(activePoint)" />
        </header>

        <div class="pl-detail-body">
          <!-- Mutable Instance Tags -->
          <section class="pl-card pl-card-mutable">
            <header class="pl-card-head">
              <div>
                <h4>点位设置</h4>
              </div>
            </header>

            <form class="pl-edit-form" @submit.prevent="savePointForm">
              <div class="pl-form-group">
                <div class="pl-label-row">
                  <label for="pl-instance-name">点位名称 <em>*</em></label>
                  <button
                    v-if="form.instanceName !== activePoint.defaultName"
                    type="button"
                    class="pl-inline-reset"
                    @click="form.instanceName = activePoint.defaultName"
                  >
                    恢复模板默认（{{ activePoint.defaultName }}）
                  </button>
                </div>
                <input
                  id="pl-instance-name"
                  v-model.trim="form.instanceName"
                  type="text"
                  maxlength="64"
                  required
                  placeholder="输入本设备该点位的展示名称"
                />
              </div>

              <div class="pl-form-group">
                <div class="pl-label-row">
                  <label>正常上下限（选填）</label>
                  <div v-if="activePoint.pointKind !== 'alarm'" class="pl-range-actions">
                    <button
                      v-if="activePoint.normalRange"
                      type="button"
                      class="pl-inline-reset"
                      @click="restoreTemplateRange"
                    >
                      恢复模板参考（{{ activePoint.normalRange.min }} ~ {{ activePoint.normalRange.max }} {{ activePoint.unit }}）
                    </button>
                    <button
                      v-if="form.normalMin !== '' || form.normalMax !== ''"
                      type="button"
                      class="pl-inline-reset muted"
                      @click="clearRange"
                    >
                      清空限值
                    </button>
                  </div>
                </div>

                <div v-if="activePoint.pointKind === 'alarm'" class="pl-alarm-readonly-box">
                  <strong>开关量报警点位（无数值上下限）</strong>
                  <span>状态语义：{{ activePoint.alarmStateSpec?.normalValue ?? 0 }} = {{ activePoint.alarmStateSpec?.normalLabel || '正常' }}；{{ activePoint.alarmStateSpec?.activeValue ?? 1 }} = {{ activePoint.alarmStateSpec?.activeLabel || '报警激活' }}</span>
                </div>

                <div v-else class="pl-range-grid">
                  <div class="pl-number-wrap">
                    <span class="pl-prefix">下限</span>
                    <input
                      v-model="form.normalMin"
                      type="number"
                      step="any"
                      placeholder="留空表示不设下限"
                      aria-label="正常下限"
                    />
                    <span v-if="activePoint.unit" class="pl-unit-suffix">{{ activePoint.unit }}</span>
                  </div>
                  <span class="pl-range-sep">至</span>
                  <div class="pl-number-wrap">
                    <span class="pl-prefix">上限</span>
                    <input
                      v-model="form.normalMax"
                      type="number"
                      step="any"
                      placeholder="留空表示不设上限"
                      aria-label="正常上限"
                    />
                    <span v-if="activePoint.unit" class="pl-unit-suffix">{{ activePoint.unit }}</span>
                  </div>
                </div>

                <p v-if="activePoint.signalRole === 'control_command'" class="pl-soft-warn">
                  提示：该点位属于控制指令型输出量，随负荷动态变化，建议正常上下限保持为空。
                </p>
              </div>

              <div class="pl-form-group">
                <label for="pl-instance-note">备注（选填）</label>
                <input
                  id="pl-instance-note"
                  v-model.trim="form.note"
                  type="text"
                  maxlength="160"
                  placeholder="记录本船该测点的安装位置、换算说明或核对备忘"
                />
              </div>

              <p v-if="formError" class="pl-form-error" role="alert">{{ formError }}</p>

              <div class="pl-form-actions">
                <button type="submit" class="pl-btn-primary" :disabled="!isDirty || configStore.saving">
                  {{ configStore.saving ? '正在保存…' : '保存修改' }}
                </button>
                <button type="button" class="pl-btn-secondary" :disabled="!isDirty || configStore.saving" @click="resetFormFromActive">
                  撤销更改
                </button>
              </div>
            </form>
          </section>

          <!-- Immutable Class Attributes -->
          <section class="pl-card pl-card-locked">
            <header class="pl-card-head">
              <div>
                <h4>模板信息</h4>
              </div>
              <span class="lock-tag">
                <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <rect x="5" y="11" width="14" height="10" rx="2" />
                  <path d="M8 11V7a4 4 0 0 1 8 0v4" />
                </svg>
                只读
              </span>
            </header>

            <dl class="pl-immutable-grid">
              <div>
                <dt>点位编号</dt>
                <dd class="mono">{{ activePoint.pointCode }}</dd>
              </div>
              <div>
                <dt>内部标准键</dt>
                <dd class="mono">{{ activePoint.internalKey }}</dd>
              </div>
              <div>
                <dt>数据单位</dt>
                <dd class="mono strong">{{ activePoint.unit || '无单位（开关量）' }}</dd>
              </div>
              <div>
                <dt>点位类型</dt>
                <dd>{{ activePoint.pointKind === 'alarm' ? '报警点位（dataType = 2）' : '数值点位（dataType = 1）' }}</dd>
              </div>
              <div>
                <dt>系统 / 子系统</dt>
                <dd>{{ activePoint.systemName }} · {{ activePoint.subsystemTag }}</dd>
              </div>
              <div>
                <dt>信号角色 / 物理信号</dt>
                <dd>{{ signalRoleLabel(activePoint.signalRole) }} · {{ activePoint.signalType || '—' }}</dd>
              </div>
              <div>
                <dt>传感器物理量程</dt>
                <dd class="mono">
                  {{ activePoint.physicalRange ? `${activePoint.physicalRange.min} ~ ${activePoint.physicalRange.max} ${activePoint.physicalRange.unit}` : 'On / Off' }}
                </dd>
              </div>
              <div>
                <dt>厂家位号 / Modbus地址</dt>
                <dd class="mono">{{ activePoint.oemTagCode || '—' }} / #{{ activePoint.modbusAddress ?? '—' }}</dd>
              </div>
              <div>
                <dt>关联部件 / 缸号</dt>
                <dd>{{ activePoint.componentTag || '—' }}{{ activePoint.cylinderNo ? `（${activePoint.cylinderNo}号缸）` : '' }}</dd>
              </div>
              <div>
                <dt>模型特征归属</dt>
                <dd>
                  {{ activePoint.algorithmUsage?.inNfForecast50 ? 'NF50预测特征' : '非NF50' }} ·
                  {{ activePoint.algorithmUsage?.inHealthScore ? '健康评分测点' : '非健康评分' }}
                </dd>
              </div>
            </dl>

            <div v-if="manualSummaryLines.length" class="pl-manual-ref">
              <strong>厂家手册与单位说明</strong>
              <ul>
                <li v-for="line in manualSummaryLines" :key="line">{{ line }}</li>
              </ul>
            </div>
          </section>
        </div>
      </template>

      <!-- Device or System Table Overview -->
      <template v-else-if="overviewTable">
        <header class="pl-detail-head">
          <div class="pl-detail-title-group">
            <div class="pl-title-badges">
              <span class="sys-pill">{{ overviewTable.device.deviceTypeName }}</span>
              <span class="code-pill">{{ overviewTable.device.code }}</span>
            </div>
            <h3>{{ overviewTable.title }}</h3>
          </div>
          <div v-if="!searchQuery.trim() && statusFilter === 'all'" class="pl-overview-actions">
            <button
              type="button"
              class="pl-btn-secondary"
              :disabled="configStore.saving"
              @click="batchToggleOverview(true)"
            >
              全部启用
            </button>
            <button
              type="button"
              class="pl-btn-secondary"
              :disabled="configStore.saving"
              @click="batchToggleOverview(false)"
            >
              全部停用
            </button>
          </div>
        </header>

        <div class="pl-overview-table-wrap">
          <table class="pl-overview-table">
            <thead>
              <tr>
                <th>启用</th>
                <th>点位编号</th>
                <th>点位名称</th>
                <th>所属系统</th>
                <th>点位类型</th>
                <th>单位</th>
                <th>正常上下限</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              <tr v-if="!overviewTable.points.length"><td colspan="8">没有符合条件的点位</td></tr>
              <tr v-for="pt in overviewTable.points" :key="pt.pointCode" :class="{ off: !pt.enabled }">
                <td>
                  <input
                    type="checkbox"
                    :checked="pt.enabled"
                    :disabled="configStore.saving"
                    :aria-label="`启用点位 ${pt.pointCode}`"
                    @change="quickTogglePoint(pt)"
                  />
                </td>
                <td class="mono">{{ pt.pointCode }}</td>
                <td>
                  <strong>{{ pt.instanceName }}</strong>
                  <small v-if="pt.instanceName !== pt.defaultName" class="renamed-hint">原名：{{ pt.defaultName }}</small>
                </td>
                <td>{{ pt.systemName }}</td>
                <td>
                  <span class="kind-pill" :class="pt.pointKind">{{ pt.pointKind === 'alarm' ? '报警' : '数值' }}</span>
                </td>
                <td class="mono">{{ pt.unit || '—' }}</td>
                <td class="mono">{{ formatPointRange(pt) }}</td>
                <td>
                  <button type="button" class="pl-table-edit" @click="selectPoint(overviewTable.device.id, pt.pointCode)">
                    编辑
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </template>
    </main>
  </div>
</template>

<script setup>
import { computed, reactive, ref, watch } from 'vue'
import ConfigSwitch from './ConfigSwitch.vue'
import { ElMessage } from 'element-plus'
import { useShipConfigStore } from '@/stores/shipConfigStore'
import { formatNormalRangeText } from '@/workflow/localSensorData.js'

const props = defineProps({
  deviceId: { type: String, default: '' }
})

const configStore = useShipConfigStore()
const devices = computed(() => props.deviceId
  ? configStore.devices.filter(device => device.id === props.deviceId)
  : configStore.devices)
const searchQuery = ref('')
const statusFilter = ref('all')

const expandedDevices = reactive({})
const expandedSystems = reactive({})

const selection = reactive({ kind: 'device', deviceId: '', systemId: '', pointCode: '' })

watch(devices, list => {
  if (!list.length) {
    selection.deviceId = ''
    return
  }
  if (!list.some(device => device.id === selection.deviceId)) selectDevice(list[0].id)
}, { immediate: true })

const keyword = computed(() => searchQuery.value.trim().toLowerCase())
function matchesFilters(point) {
  if (statusFilter.value === 'enabled' && !point.enabled) return false
  if (statusFilter.value === 'disabled' && point.enabled) return false
  if (!keyword.value) return true
  return [point.pointCode, point.instanceName, point.defaultName, point.systemName, point.internalKey, point.deviceName]
    .some(value => String(value || '').toLowerCase().includes(keyword.value))
}

const treeDevices = computed(() => {
  return devices.value
    .map((device) => {
      const systems = (device.systemTags || [])
        .map((sys) => {
          const allSysPoints = device.resolvedPoints.filter((p) => p.systemId === sys.systemId)
          const filtered = allSysPoints.filter(matchesFilters)
          const enabledCount = allSysPoints.filter((p) => p.enabled).length
          return {
            ...sys,
            points: filtered,
            enabledCount,
            allEnabled: allSysPoints.length > 0 && enabledCount === allSysPoints.length,
            totalCount: allSysPoints.length,
            someEnabled: enabledCount > 0
          }
        })
        .filter((sys) => sys.points.length > 0)

      return { ...device, systems }
    })
    .filter((device) => device.systems.length > 0 || (!keyword.value && statusFilter.value === 'all'))
})

function isDeviceExpanded(deviceId) {
  return searchQuery.value.trim() ? true : Boolean(expandedDevices[deviceId])
}

function toggleDevice(deviceId) {
  expandedDevices[deviceId] = !expandedDevices[deviceId]
}

function isSystemExpanded(deviceId, systemId) {
  return searchQuery.value.trim() ? true : Boolean(expandedSystems[`${deviceId}:${systemId}`])
}

function toggleSystem(deviceId, systemId) {
  const key = `${deviceId}:${systemId}`
  expandedSystems[key] = !expandedSystems[key]
}

function selectDevice(deviceId) {
  selection.kind = 'device'
  selection.deviceId = deviceId
  selection.systemId = ''
  selection.pointCode = ''
  expandedDevices[deviceId] = true
}

function selectSystem(deviceId, systemId) {
  selection.kind = 'system'
  selection.deviceId = deviceId
  selection.systemId = systemId
  selection.pointCode = ''
  expandedDevices[deviceId] = true
  expandedSystems[`${deviceId}:${systemId}`] = true
}

function selectPoint(deviceId, pointCode) {
  selection.kind = 'point'
  selection.deviceId = deviceId
  selection.pointCode = pointCode
  expandedDevices[deviceId] = true
  const pt = devices.value.find((d) => d.id === deviceId)?.resolvedPoints.find((p) => p.pointCode === pointCode)
  if (pt?.systemId) expandedSystems[`${deviceId}:${pt.systemId}`] = true
}

const activePoint = computed(() => {
  if (selection.kind !== 'point') return null
  const dev = devices.value.find((d) => d.id === selection.deviceId)
  return dev?.resolvedPoints.find((p) => p.pointCode === selection.pointCode) || null
})

const overviewTable = computed(() => {
  if (selection.kind === 'point') return null
  const device = devices.value.find((d) => d.id === selection.deviceId)
  if (!device) return null
  if (selection.kind === 'system') {
    const sys = device.systemTags.find((s) => s.systemId === selection.systemId)
    return {
      device,
      systemId: selection.systemId,
      title: `${device.name} · ${sys?.systemName || selection.systemId}（点位列表）`,
      points: device.resolvedPoints.filter((p) => p.systemId === selection.systemId && matchesFilters(p))
    }
  }
  return {
    device,
    systemId: null,
    title: `${device.name} · 全部点位（${device.enabledPointCount} / ${device.totalPointCount} 已启用）`,
    points: device.resolvedPoints.filter(matchesFilters)
  }
})

// Editable form state
const form = reactive({
  instanceName: '',
  normalMin: '',
  normalMax: '',
  note: ''
})
const formError = ref('')

function resetFormFromActive() {
  const pt = activePoint.value
  formError.value = ''
  if (!pt) return
  form.instanceName = pt.instanceName || pt.defaultName || ''
  form.normalMin = pt.normalMin !== null && pt.normalMin !== undefined ? String(pt.normalMin) : ''
  form.normalMax = pt.normalMax !== null && pt.normalMax !== undefined ? String(pt.normalMax) : ''
  form.note = pt.note || ''
}

watch(activePoint, resetFormFromActive, { immediate: true })

const isDirty = computed(() => {
  const pt = activePoint.value
  if (!pt) return false
  const origMin = pt.normalMin !== null && pt.normalMin !== undefined ? String(pt.normalMin) : ''
  const origMax = pt.normalMax !== null && pt.normalMax !== undefined ? String(pt.normalMax) : ''
  return (
    form.instanceName.trim() !== (pt.instanceName || pt.defaultName) ||
    String(form.normalMin).trim() !== origMin ||
    String(form.normalMax).trim() !== origMax ||
    form.note.trim() !== (pt.note || '')
  )
})

function restoreTemplateRange() {
  const r = activePoint.value?.normalRange
  if (!r) return
  form.normalMin = r.min !== null && r.min !== undefined ? String(r.min) : ''
  form.normalMax = r.max !== null && r.max !== undefined ? String(r.max) : ''
}

function clearRange() {
  form.normalMin = ''
  form.normalMax = ''
}

async function savePointForm() {
  const pt = activePoint.value
  if (!pt) return
  formError.value = ''
  const name = form.instanceName.trim()
  if (!name) {
    formError.value = '点位名称不能为空。'
    return
  }
  const minVal = pt.pointKind === 'alarm' || String(form.normalMin).trim() === '' ? null : Number(form.normalMin)
  const maxVal = pt.pointKind === 'alarm' || String(form.normalMax).trim() === '' ? null : Number(form.normalMax)
  if ((minVal !== null && !Number.isFinite(minVal)) || (maxVal !== null && !Number.isFinite(maxVal))) {
    formError.value = '正常上下限必须为合法数字。'
    return
  }
  if (minVal !== null && maxVal !== null && minVal > maxVal) {
    formError.value = '正常下限不能大于正常上限。'
    return
  }
  try {
    await configStore.updatePoint(pt.deviceId, pt.pointCode, {
      instanceName: name,
      normalMin: minVal,
      normalMax: maxVal,
      note: form.note.trim()
    })
    ElMessage.success(`已保存点位 ${pt.pointCode}（${name}）配置`)
  } catch (err) {
    formError.value = err.message || '保存失败'
  }
}

async function quickTogglePoint(pt) {
  const next = !pt.enabled
  try {
    await configStore.updatePoint(pt.deviceId, pt.pointCode, { enabled: next })
    ElMessage.success(`已${next ? '启用' : '停用'}点位 ${pt.pointCode}（${pt.instanceName}）`)
  } catch (err) {
    ElMessage.error(err.message || '操作失败')
  }
}

async function onToggleSystem(deviceId, systemId, enabled) {
  try {
    await configStore.setSystemPointsEnabled(deviceId, systemId, enabled)
    ElMessage.success(`已${enabled ? '批量启用' : '批量停用'}该系统全部点位`)
  } catch (err) {
    ElMessage.error(err.message || '操作失败')
  }
}

async function batchToggleOverview(enabled) {
  if (!overviewTable.value) return
  try {
    if (overviewTable.value.systemId) {
      await configStore.setSystemPointsEnabled(overviewTable.value.device.id, overviewTable.value.systemId, enabled)
    } else {
      await configStore.setAllPointsEnabled(overviewTable.value.device.id, enabled)
    }
    ElMessage.success(`已${enabled ? '全部启用' : '全部停用'}当前范围点位`)
  } catch (err) {
    ElMessage.error(err.message || '批量更新失败')
  }
}

const manualSummaryLines = computed(() => {
  const pt = activePoint.value
  if (!pt) return []
  const lines = []
  if (pt.manualOperatingRange) {
    const r = pt.manualOperatingRange
    const minStr = r.min ?? '—'
    const maxStr = r.max ?? '—'
    lines.push(`厂家 MCR 运行范围：${minStr} ~ ${maxStr} ${r.unit}（${r.condition}）`)
  }
  if (pt.oemProtectionLimits) {
    const l = pt.oemProtectionLimits
    const parts = []
    if (l.alarmLow) parts.push(`低报 ${l.alarmLow.originalText}`)
    if (l.alarmHigh) parts.push(`高报 ${l.alarmHigh.originalText}`)
    if (l.alarmDeviation) parts.push(`偏差报 ${l.alarmDeviation.originalText}`)
    if (l.slowdownLow) parts.push(`低减速 ${l.slowdownLow.originalText}`)
    if (l.slowdownHigh) parts.push(`高减速 ${l.slowdownHigh.originalText}`)
    if (l.slowdownDeviation) parts.push(`偏差减速 ${l.slowdownDeviation.originalText}`)
    if (l.shutdownLow) parts.push(`低停机 ${l.shutdownLow.originalText}`)
    if (l.shutdownHigh) parts.push(`高停机 ${l.shutdownHigh.originalText || `${l.shutdownHigh.relativePctOfRated}%`}`)
    if (parts.length) lines.push(`厂家保护限值：${parts.join('；')}`)
    if (l.configDependencyNote) lines.push(`配置说明：${l.configDependencyNote}`)
  }
  if (pt.unitConversionNote) lines.push(`单位口径：${pt.unitConversionNote}`)
  if (pt.legacyCompatibilityNote) lines.push(`兼容性说明：${pt.legacyCompatibilityNote}`)
  if (pt.notes) lines.push(`工程备注：${pt.notes}`)
  return lines
})

function signalRoleLabel(role) {
  return (
    {
      measurement: '测量型传感器',
      derived_deviation: '派生偏差量',
      control_command: '控制指令输出',
      discrete_alarm: '离散报警开关'
    }[role] || role
  )
}

function formatPointRange(pt) {
  return formatNormalRangeText(pt.normalMin, pt.normalMax, pt.unit, pt.pointKind)
}
</script>

<style scoped>
.point-list-view {
  flex: 1;
  min-height: 0;
  display: flex;
  overflow: hidden;
  background: #f7f7f4;
}

.pl-tree-pane {
  width: 292px;
  flex: 0 0 292px;
  background: #ffffff;
  border-right: 1px solid var(--ui-line);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.pl-tree-head {
  padding: 12px 12px 10px;
  border-bottom: 1px solid var(--ui-line);
  display: flex;
  flex-direction: column;
  gap: 9px;
}

.pl-tree-title {
  display: flex;
  align-items: center;
  gap: 7px;
}

.pl-accent-bar {
  width: 3px;
  height: 14px;
  border-radius: 2px;
  background: var(--ui-accent);
}

.pl-tree-title strong {
  font-size: 13px;
  color: var(--ui-ink);
}

.pl-tree-filters {
  display: flex;
  flex-direction: column;
  gap: 7px;
}

.pl-search {
  height: 30px;
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 0 9px;
  border: 1px solid var(--ui-border);
  border-radius: 6px;
  background: #f7f7f4;
  color: var(--ui-muted);
}

.pl-search:focus-within {
  border-color: var(--ui-accent-line);
  background: #ffffff;
}

.pl-search svg {
  width: 14px;
  height: 14px;
  stroke: currentColor;
  stroke-width: 1.8;
  stroke-linecap: round;
}

.pl-search input {
  flex: 1;
  min-width: 0;
  border: 0;
  outline: 0;
  background: transparent;
  font: inherit;
  font-size: 12px;
  color: var(--ui-ink);
}

.pl-filter-row {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 3px;
  padding: 2px;
  background: #f1f2ed;
  border-radius: 6px;
}

.pl-filter-row button {
  border: 0;
  border-radius: 4px;
  padding: 4px 0;
  background: transparent;
  color: #636960;
  font: inherit;
  font-size: 11.5px;
  cursor: pointer;
}

.pl-filter-row button.active {
  background: #ffffff;
  color: var(--ui-accent);
  font-weight: 600;
  box-shadow: 0 1px 2px rgba(20, 29, 47, 0.08);
}

.pl-tree-scroll {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 8px 8px 16px;
}

.pl-device-node + .pl-device-node {
  margin-top: 6px;
}

.pl-node-row {
  display: flex;
  align-items: center;
  gap: 4px;
  border-radius: 6px;
  padding: 4px 6px 4px 2px;
}

.pl-node-row:hover {
  background: #f6f4ee;
}

.pl-node-row.selected {
  background: var(--ui-warm);
}

.pl-caret-btn {
  width: 20px;
  height: 20px;
  flex: none;
  border: 0;
  background: transparent;
  color: var(--ui-muted);
  display: grid;
  place-items: center;
  cursor: pointer;
}

.pl-caret-btn svg {
  width: 13px;
  height: 13px;
  stroke: currentColor;
  stroke-width: 2;
  stroke-linecap: round;
  stroke-linejoin: round;
  transition: transform 0.14s ease;
}

.pl-caret-btn svg.open {
  transform: rotate(90deg);
}

.pl-row-label {
  flex: 1;
  min-width: 0;
  border: 0;
  background: transparent;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 6px;
  padding: 2px 2px;
  font: inherit;
  cursor: pointer;
  text-align: left;
}

.pl-dev-name {
  font-size: 13px;
  font-weight: 700;
  color: var(--ui-ink);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.pl-sys-name {
  font-size: 12.5px;
  font-weight: 600;
  color: var(--ui-ink);
}

.pl-count {
  font-family: Consolas, monospace;
  font-size: 11px;
  color: var(--ui-muted);
  flex: none;
}

.pl-system-list {
  padding-left: 10px;
  margin-top: 2px;
}

.pl-sys-check {
  width: 14px;
  height: 14px;
  accent-color: var(--ui-accent);
  cursor: pointer;
  flex: none;
}

.pl-point-leaves {
  padding-left: 20px;
  display: flex;
  flex-direction: column;
  gap: 1px;
  margin: 2px 0 4px;
}

.pl-leaf-row {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 5px 8px;
  border: 0;
  border-radius: 5px;
  background: transparent;
  font: inherit;
  cursor: pointer;
  text-align: left;
  transition: background-color 0.12s;
}

.pl-leaf-row:hover {
  background: #f6f4ee;
}

.pl-leaf-row.selected {
  background: var(--ui-warm);
}

.pl-leaf-row.off {
  opacity: 0.56;
}

.pl-leaf-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  flex: none;
  background: var(--ui-accent);
}

.pl-leaf-dot.alarm {
  background: #e04640;
}

.pl-leaf-dot.off {
  background: #c5c8c0;
}

.pl-leaf-name {
  flex: 1;
  min-width: 0;
  font-size: 12px;
  color: var(--ui-ink);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.pl-leaf-row.selected .pl-leaf-name {
  color: var(--ui-accent);
  font-weight: 600;
}

.pl-leaf-code {
  font-family: Consolas, monospace;
  font-size: 10.5px;
  color: var(--ui-muted);
  flex: none;
}

.pl-tree-empty {
  text-align: center;
  padding: 28px 10px;
  font-size: 12px;
  color: var(--ui-muted);
}

/* Right Detail Pane */
.pl-detail-pane {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.pl-detail-head {
  padding: 14px 18px;
  background: #ffffff;
  border-bottom: 1px solid var(--ui-line);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
  flex-wrap: wrap;
}

.pl-title-badges {
  display: flex;
  align-items: center;
  gap: 7px;
  margin-bottom: 5px;
  flex-wrap: wrap;
}

.code-pill {
  font-family: Consolas, monospace;
  font-size: 11.5px;
  font-weight: 600;
  padding: 2px 7px;
  border-radius: 4px;
  background: #f1f2ed;
  color: var(--ui-ink);
}

.kind-pill {
  font-size: 11px;
  font-weight: 600;
  padding: 2px 7px;
  border-radius: 4px;
  background: var(--ui-warm);
  color: var(--ui-accent);
}

.kind-pill.alarm {
  background: #fff1f0;
  color: #cf3731;
}

.sys-pill {
  font-size: 11.5px;
  color: var(--ui-muted);
}

.pl-detail-title-group h3 {
  margin: 0;
  font-size: 16px;
  font-weight: 700;
  color: var(--ui-ink);
}

.pl-detail-body {
  flex: 1;
  min-height: 0;
  overflow: auto;
  padding: 16px 18px 22px;
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.pl-card {
  background: #ffffff;
  border: 1px solid var(--ui-line);
  border-radius: 10px;
  padding: 16px 18px;
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.pl-card-locked {
  background: #f7f7f4;
}

.pl-card-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  padding-bottom: 10px;
  border-bottom: 1px solid var(--ui-line);
}

.pl-card-head h4 {
  margin: 0 0 3px;
  font-size: 14px;
  font-weight: 700;
  color: var(--ui-ink);
}

.pl-card-head small {
  font-size: 12px;
  color: var(--ui-muted);
}

.edit-tag,
.lock-tag {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 3px 9px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 600;
  flex-shrink: 0;
}

.edit-tag {
  background: var(--ui-warm);
  color: var(--ui-accent);
}

.lock-tag {
  background: #f1f2ed;
  color: #636960;
}

.lock-tag svg {
  width: 12px;
  height: 12px;
  stroke: currentColor;
  stroke-width: 2;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.pl-edit-form {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.pl-form-group {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.pl-label-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  flex-wrap: wrap;
}

.pl-form-group label {
  font-size: 12.5px;
  font-weight: 600;
  color: var(--ui-ink);
}

.pl-form-group em {
  color: #e03e36;
  font-style: normal;
}

.pl-range-actions {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}

.pl-inline-reset {
  border: 0;
  background: transparent;
  color: var(--ui-accent);
  font: inherit;
  font-size: 11.5px;
  cursor: pointer;
}

.pl-inline-reset.muted {
  color: var(--ui-muted);
}

.pl-inline-reset:hover {
  text-decoration: underline;
}

.pl-edit-form input[type='text'] {
  height: 36px;
  padding: 0 11px;
  border: 1px solid var(--ui-border);
  border-radius: 7px;
  background: #ffffff;
  color: var(--ui-ink);
  font: inherit;
  font-size: 13px;
}

.pl-edit-form input[type='text']:focus {
  outline: none;
  border-color: var(--ui-accent);
  box-shadow: 0 0 0 2px #b7935a1c;
}

.pl-range-grid {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.pl-number-wrap {
  flex: 1;
  min-width: 170px;
  height: 36px;
  display: flex;
  align-items: center;
  border: 1px solid var(--ui-border);
  border-radius: 7px;
  background: #ffffff;
  overflow: hidden;
}

.pl-number-wrap:focus-within {
  border-color: var(--ui-accent);
  box-shadow: 0 0 0 2px #b7935a1c;
}

.pl-prefix,
.pl-unit-suffix {
  padding: 0 10px;
  font-size: 12px;
  color: var(--ui-muted);
  background: #f7f7f4;
  height: 100%;
  display: inline-flex;
  align-items: center;
}

.pl-prefix {
  border-right: 1px solid var(--ui-line);
}

.pl-unit-suffix {
  border-left: 1px solid var(--ui-line);
  font-family: Consolas, monospace;
  color: var(--ui-ink);
  font-weight: 600;
}

.pl-number-wrap input {
  flex: 1;
  min-width: 0;
  height: 100%;
  padding: 0 10px;
  border: 0;
  outline: 0;
  font: inherit;
  font-family: Consolas, monospace;
  font-size: 13px;
  color: var(--ui-ink);
}

.pl-range-sep {
  font-size: 12px;
  color: var(--ui-muted);
}

.pl-alarm-readonly-box {
  padding: 10px 12px;
  border-radius: 7px;
  background: #fff7f6;
  border: 1px solid #f7dcd9;
  display: flex;
  flex-direction: column;
  gap: 3px;
  font-size: 12px;
  color: #9e322c;
}

.pl-soft-warn {
  margin: 0;
  font-size: 11.5px;
  color: #a46a10;
}

.pl-form-error {
  margin: 0;
  font-size: 12px;
  color: #cf3731;
}

.pl-form-actions,
.pl-overview-actions {
  display: flex;
  gap: 10px;
  align-items: center;
}

.pl-btn-primary,
.pl-btn-secondary {
  min-height: 32px;
  padding: 4px 12px;
  border-radius: var(--ui-radius);
  box-shadow: var(--ui-control-shadow);
  font: inherit;
  font-size: 12.5px;
  font-weight: 600;
  cursor: pointer;
}

.pl-btn-primary {
  border: 1px solid #302f29;
  background: linear-gradient(#393a33, #282923);
  color: #ffffff;
}

.pl-btn-primary:hover:not(:disabled) {
  background: #665536;
}

.pl-btn-secondary {
  border: 1px solid var(--ui-border);
  background: linear-gradient(#fff, #fafbf8);
  color: var(--ui-ink);
}

.pl-btn-secondary:hover:not(:disabled) {
  background: #f7f7f4;
}

.pl-btn-primary:disabled,
.pl-btn-secondary:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

/* Immutable Grid */
.pl-immutable-grid {
  margin: 0;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 11px 16px;
}

.pl-immutable-grid > div {
  padding: 8px 10px;
  border-radius: 7px;
  background: #ffffff;
  border: 1px solid var(--ui-line);
}

.pl-immutable-grid dt {
  font-size: 11px;
  color: var(--ui-muted);
  margin-bottom: 4px;
}

.pl-immutable-grid dd {
  margin: 0;
  font-size: 12.5px;
  color: var(--ui-ink);
}

.pl-immutable-grid dd.mono {
  font-family: Consolas, monospace;
}

.pl-immutable-grid dd.strong {
  font-weight: 700;
  color: var(--ui-accent);
}

.pl-manual-ref {
  padding: 11px 13px;
  border-radius: 8px;
  background: #f1f2ed;
  border: 1px solid var(--ui-line);
}

.pl-manual-ref strong {
  display: block;
  font-size: 12px;
  color: var(--ui-ink);
  margin-bottom: 6px;
}

.pl-manual-ref ul {
  margin: 0;
  padding-left: 16px;
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 12px;
  line-height: 1.55;
  color: #636960;
}

/* Overview Table */
.pl-overview-table-wrap {
  flex: 1;
  min-height: 0;
  overflow: auto;
  padding: 14px 18px 20px;
}

.pl-overview-table {
  width: 100%;
  border-collapse: separate;
  border-spacing: 0;
  background: #ffffff;
  border: 1px solid var(--ui-line);
  border-radius: var(--ui-radius);
  overflow: hidden;
  min-width: 680px;
}

.pl-overview-table th {
  text-align: left;
  padding: 10px 12px;
  font-size: 12px;
  font-weight: 600;
  color: #62675f;
  background: #f7f7f4;
  border-bottom: 1px solid var(--ui-line);
  white-space: nowrap;
}

.pl-overview-table td {
  padding: 10px 12px;
  font-size: 12.5px;
  color: var(--ui-ink);
  border-bottom: 1px solid var(--ui-line);
  vertical-align: middle;
}

.pl-overview-table tbody tr:last-child td { border-bottom: 0; }
.pl-overview-table tbody tr:hover { background: #fbfaf7; }
.pl-overview-table tr.off td { color: #696d65; }

.pl-overview-table td.mono {
  font-family: Consolas, monospace;
  font-variant-numeric: tabular-nums;
}

.renamed-hint {
  display: block;
  font-size: 11px;
  color: var(--ui-muted);
  font-weight: 400;
}

.pl-table-edit {
  min-height: 30px;
  padding: 4px 10px;
  border: 1px solid var(--ui-border);
  border-radius: var(--ui-radius);
  background: linear-gradient(#fff, #fafbf8);
  color: var(--ui-ink);
  font: inherit;
  font-size: 12px;
  white-space: nowrap;
  cursor: pointer;
}
.pl-overview-table th:last-child,
.pl-overview-table td:last-child {
  width: 92px;
  white-space: nowrap;
  text-align: center;
}

.pl-table-edit:hover {
  background: var(--ui-warm);
  border-color: var(--ui-accent-line);
  color: var(--ui-accent);
}

.pl-overview-table input[type='checkbox'] { accent-color: var(--ui-accent); }
.pl-table-edit { box-shadow: var(--ui-control-shadow); }
@media (max-width: 1100px) {
  .pl-tree-pane { width: 205px; flex-basis: 205px; }
}
@media (max-width: 740px) {
  .point-list-view { flex-direction: column; overflow: auto; }
  .pl-tree-pane { width: 100%; flex: none; max-height: 210px; border-right: 0; border-bottom: 1px solid var(--ui-line); }
  .pl-detail-pane { flex: 1 0 360px; }
  .pl-detail-head, .pl-overview-table-wrap, .pl-detail-body { padding: 10px; }
}
</style>
