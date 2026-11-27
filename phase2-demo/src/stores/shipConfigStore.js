import {createReportCatalog} from '../workflow/manualAnomaly.js'
import { defineStore } from 'pinia'
import { ref, computed, watch } from 'vue'
import {createDefaultShipConfig} from '../workflow/defaultShipConfig.js'
import defaultTemplate from '../../data/device-type-template.json' with { type: 'json' }
import { appUrl } from '@/services/appUrl.js'
import { sessionHeaders } from '@/services/session.js'
import { auth } from '@/services/auth'

export const useShipConfigStore = defineStore('shipConfig', () => {
  const template = ref(defaultTemplate)
  const config = ref(createDefaultShipConfig(defaultTemplate))
  const reportCatalog = computed(() => createReportCatalog(config.value.devices, template.value))
  const loading = ref(false)
  const saving = ref(false)
  const loaded = ref(false)
  const error = ref('')

  const templateTypes = computed(() => template.value?.deviceTypes || [])
  const typeById = computed(() => new Map(templateTypes.value.map((t) => [t.deviceTypeId, t])))

  const devices = computed(() =>
    (config.value?.devices || []).map((device) => {
      const tpl = typeById.value.get(device.deviceTypeId) || templateTypes.value[0]
      const tplPointMap = new Map((tpl?.points || []).map((p) => [p.pointCode, p]))
      const resolvedPoints = (device.points || []).map((inst) => {
        const meta = tplPointMap.get(inst.pointCode) || {}
        return {
          ...meta,
          ...inst,
          deviceId: device.id,
          deviceName: device.name,
          immutable: {
            pointCode: meta.pointCode || inst.pointCode,
            internalKey: meta.internalKey || '',
            systemId: meta.systemId || '',
            systemName: meta.systemName || '',
            subsystemTag: meta.subsystemTag || '',
            pointKind: meta.pointKind || 'numeric',
            apiDataType: meta.apiDataType || 1,
            unit: meta.unit ?? '',
            signalRole: meta.signalRole || 'measurement'
          }
        }
      })
      const enabledPointCount = resolvedPoints.filter((p) => p.enabled).length
      const alarmPointCount = resolvedPoints.filter((p) => p.enabled && p.pointKind === 'alarm').length
      return {
        ...device,
        deviceTypeName: tpl?.deviceTypeName || device.deviceTypeId,
        deviceTypeCode: tpl?.deviceTypeCode || '',
        systemTags: tpl?.systemTags || [],
        resolvedPoints,
        enabledPointCount,
        totalPointCount: resolvedPoints.length,
        alarmPointCount
      }
    })
  )

  const enabledDevices = computed(() => devices.value.filter((d) => d.enabled))

  const instantiatedTree = computed(() =>
    enabledDevices.value.map((device) => ({
      deviceId: device.id,
      deviceName: device.name,
      deviceCode: device.code,
      deviceTypeName: device.deviceTypeName,
      points: device.resolvedPoints.filter((p) => p.enabled)
    }))
  )

  async function loadConfig() {
    if (typeof window === 'undefined' || !auth.user) return
    loading.value = true
    error.value = ''
    try {
      const res = await fetch(appUrl('/api/config/ship'), {
        headers: sessionHeaders(),
        signal: AbortSignal.timeout(10000)
      })
      if (!res.ok) throw new Error('加载船端配置失败')
      const data = await res.json()
      if (data.template) template.value = data.template
      if (data.config) config.value = data.config
      loaded.value = true
    } catch (err) {
      error.value = err.message || '加载船端配置失败'
    } finally {
      loading.value = false
    }
  }

  async function persist(nextConfig) {
    saving.value = true
    error.value = ''
    try {
      const res = await fetch(appUrl('/api/config/ship'), {
        method: 'PUT',
        headers: { ...sessionHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ config: nextConfig })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || '保存配置失败')
      if (data.template) template.value = data.template
      if (data.config) config.value = data.config
      return data.config
    } catch (err) {
      error.value = err.message || '保存配置失败'
      throw err
    } finally {
      saving.value = false
    }
  }

  function cloneRawConfig() {
    return JSON.parse(JSON.stringify(config.value))
  }

  async function addDevice({ name, code, deviceTypeId, selectedPointCodes, alarms }) {
    const tpl = typeById.value.get(deviceTypeId)
    if (!tpl) throw new Error('请选择有效的设备类型模板')
    const draft = cloneRawConfig()
    const trimmedName = String(name || '').trim()
    if (!trimmedName) throw new Error('请输入设备名称')
    if (draft.devices.some((d) => d.name === trimmedName)) throw new Error(`设备名称「${trimmedName}」已存在`)

    const id = `dev-${Date.now().toString(36)}`
    const selectedSet = Array.isArray(selectedPointCodes) ? new Set(selectedPointCodes) : null
    const nowIso = new Date().toISOString()
    const operator = auth.user?.name || auth.user?.username || '超级管理员'

    draft.devices.push({
      id,
      name: trimmedName,
      code: String(code || '').trim() || `ME-${String(draft.devices.length + 1).padStart(2, '0')}`,
      deviceTypeId: tpl.deviceTypeId,
      enabled: true,
      isBuiltin: false,
      alarms: {
        oem: {
          enabled: Boolean(alarms?.oem?.enabled),
          updatedAt: nowIso,
          updatedBy: operator,
          note: 'OEM 硬件报警触发后进入大模型分析研判'
        },
        aiPeriodic: {
          enabled: alarms?.aiPeriodic?.enabled !== false,
          intervalMinutes: Number(alarms?.aiPeriodic?.intervalMinutes) || 60,
          updatedAt: nowIso,
          updatedBy: operator,
          note: '定时 AI 周期异常检测并产生预警事件'
        },
        anomalyTracking: {
          enabled: Boolean(alarms?.anomalyTracking?.enabled),
          windowMonths: Number(alarms?.anomalyTracking?.windowMonths) || 3,
          granularity: alarms?.anomalyTracking?.granularity || 'weekly',
          updatedAt: nowIso,
          updatedBy: operator,
          note: '多月运行数据长期趋势偏移跟踪与异动跟踪报警'
        }
      },
      points: tpl.points.map((point) => ({
        pointCode: point.pointCode,
        enabled: selectedSet ? selectedSet.has(point.pointCode) : true,
        instanceName: point.defaultName,
        normalMin: point.normalRange?.min ?? null,
        normalMax: point.normalRange?.max ?? null,
        note: ''
      }))
    })

    await persist(draft)
    return id
  }

  async function updateDeviceMeta(deviceId, patch) {
    const draft = cloneRawConfig()
    const target = draft.devices.find((d) => d.id === deviceId)
    if (!target) throw new Error('设备不存在')
    if (patch.name !== undefined) target.name = String(patch.name).trim()
    if (patch.code !== undefined) target.code = String(patch.code).trim()
    if (patch.enabled !== undefined) target.enabled = Boolean(patch.enabled)
    await persist(draft)
  }

  async function deleteDevice(deviceId) {
    const draft = cloneRawConfig()
    if (draft.devices.length <= 1) throw new Error('至少需要保留一台设备')
    const idx = draft.devices.findIndex((d) => d.id === deviceId)
    if (idx < 0) throw new Error('设备不存在')
    draft.devices.splice(idx, 1)
    await persist(draft)
  }

  async function updateDeviceAlarm(deviceId, alarmKey, patch) {
    const draft = cloneRawConfig()
    const target = draft.devices.find((d) => d.id === deviceId)
    if (!target) throw new Error('设备不存在')
    const nowIso = new Date().toISOString()
    const operator = auth.user?.name || auth.user?.username || '超级管理员'
    target.alarms = target.alarms || {}
    target.alarms[alarmKey] = {
      ...(target.alarms[alarmKey] || {}),
      ...patch,
      updatedAt: nowIso,
      updatedBy: operator
    }
    await persist(draft)
  }

  async function updatePoint(deviceId, pointCode, patch) {
    const draft = cloneRawConfig()
    const device = draft.devices.find((d) => d.id === deviceId)
    if (!device) throw new Error('设备不存在')
    const point = device.points.find((p) => p.pointCode === pointCode)
    if (!point) throw new Error(`点位 ${pointCode} 不存在`)
    if (patch.enabled !== undefined) point.enabled = Boolean(patch.enabled)
    if (patch.instanceName !== undefined) point.instanceName = String(patch.instanceName).trim()
    if (patch.normalMin !== undefined) point.normalMin = patch.normalMin === '' ? null : patch.normalMin
    if (patch.normalMax !== undefined) point.normalMax = patch.normalMax === '' ? null : patch.normalMax
    if (patch.note !== undefined) point.note = String(patch.note || '').trim()
    await persist(draft)
  }

  async function setSystemPointsEnabled(deviceId, systemId, enabled) {
    const draft = cloneRawConfig()
    const device = draft.devices.find((d) => d.id === deviceId)
    if (!device) throw new Error('设备不存在')
    const tpl = typeById.value.get(device.deviceTypeId)
    const codes = new Set((tpl?.points || []).filter((p) => p.systemId === systemId).map((p) => p.pointCode))
    for (const point of device.points) {
      if (codes.has(point.pointCode)) point.enabled = Boolean(enabled)
    }
    await persist(draft)
  }

  async function setAllPointsEnabled(deviceId, enabled) {
    const draft = cloneRawConfig()
    const device = draft.devices.find((d) => d.id === deviceId)
    if (!device) throw new Error('设备不存在')
    for (const point of device.points) point.enabled = Boolean(enabled)
    await persist(draft)
  }

  async function resetConfig() {
    saving.value = true
    error.value = ''
    try {
      const res = await fetch(appUrl('/api/config/ship/reset'), {
        method: 'POST',
        headers: sessionHeaders()
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || '重置配置失败')
      if (data.template) template.value = data.template
      if (data.config) config.value = data.config
      return data.config
    } catch (err) {
      error.value = err.message || '重置配置失败'
      throw err
    } finally {
      saving.value = false
    }
  }

  if (typeof window !== 'undefined') {
    watch(
      () => auth.user?.username,
      (username) => {
        if (username) void loadConfig()
      },
      { immediate: true }
    )
  }

  return {
    reportCatalog,
    template,
    templateTypes,
    config,
    devices,
    enabledDevices,
    instantiatedTree,
    loading,
    saving,
    loaded,
    error,
    loadConfig,
    addDevice,
    updateDeviceMeta,
    deleteDevice,
    updateDeviceAlarm,
    updatePoint,
    setSystemPointsEnabled,
    setAllPointsEnabled,
    resetConfig
  }
})
