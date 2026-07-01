import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import {
  deviceList, DEVICE_STATUS, generateTrendData, sensorData,
  SENSOR_PRESET_GROUPS, DEVICE_SYSTEMS
} from '@/mock'

/**
 * 设备状态管理（对齐 V1.0 文档）
 * - 设备四色状态：绿(正常)/黄(异常未排查)/红(故障未解决)/灰(离线)
 * - 传感器分组：预设组合(燃油/排气/启动观察组) + 按系统分组
 * - 异常传感器自动前置排序
 */
export const useDeviceStore = defineStore('device', () => {
  const devices = ref(JSON.parse(JSON.stringify(deviceList)))
  const selectedDeviceId = ref(null)   // 首页点选设备联动（null=全部）
  const monitorDeviceId = ref(devices.value[0]?.id || null)  // 监控中心选中
  const trendCache = ref({})
  const refreshTick = ref(0)
  const sensors = ref(JSON.parse(JSON.stringify(sensorData)))
  const sensorUpdatedAt = ref('2026-06-26 12:00:00')

  // ============ Getters ============
  const selectedDevice = computed(() =>
    devices.value.find(d => d.id === selectedDeviceId.value) || null
  )
  const monitorDevice = computed(() =>
    devices.value.find(d => d.id === monitorDeviceId.value) || null
  )
  const deviceCount = computed(() => devices.value.length)

  const statusStats = computed(() => {
    const stats = { normal: 0, warning: 0, danger: 0, offline: 0 }
    devices.value.forEach(d => { stats[d.status]++ })
    return stats
  })
  const normalCount = computed(() => statusStats.value.normal)
  const alarmCount = computed(() => statusStats.value.danger + statusStats.value.warning)
  const offlineCount = computed(() => statusStats.value.offline)

  const abnormalDevices = computed(() =>
    devices.value.filter(d => d.status === DEVICE_STATUS.WARNING || d.status === DEVICE_STATUS.DANGER)
  )

  // 异常传感器（高亮闪烁）
  const abnormalSensors = computed(() =>
    sensors.value.filter(s => s.status === 'danger' || s.status === 'warning')
  )

  // 传感器按系统分组
  const sensorsBySystem = computed(() => {
    const grouped = {}
    sensors.value.forEach(s => {
      if (!grouped[s.system]) grouped[s.system] = []
      grouped[s.system].push(s)
    })
    return grouped
  })

  // 按预设分组取传感器
  function sensorsByPreset(groupKey) {
    const group = SENSOR_PRESET_GROUPS.find(g => g.key === groupKey)
    if (!group || !group.sensorIds) return sortedSensors.value
    return sensors.value
      .filter(s => group.sensorIds.includes(s.id))
      .sort((a, b) => sortAbnormalFirst(a, b))
  }

  // 排序：异常(danger/warning)前置，danger 优先
  function sortAbnormalFirst(a, b) {
    const w = s => s.status === 'danger' ? 0 : s.status === 'warning' ? 1 : 2
    return w(a) - w(b)
  }
  // 全部传感器，异常前置
  const sortedSensors = computed(() =>
    [...sensors.value].sort((a, b) => sortAbnormalFirst(a, b))
  )

  // 按系统分组设备（树形）
  const devicesBySystem = computed(() => {
    const grouped = {}
    devices.value.forEach(d => {
      if (!grouped[d.system]) grouped[d.system] = []
      grouped[d.system].push(d)
    })
    return grouped
  })

  // 健康度
  const healthScore = computed(() => {
    if (deviceCount.value === 0) return 0
    return Math.round((normalCount.value / deviceCount.value) * 100)
  })

  // 系统级联选项（设备→系统）
  const cascadeOptions = computed(() =>
    DEVICE_SYSTEMS.map(sys => ({
      value: sys.key,
      label: sys.name,
      children: sys.children.map(sub => ({
        value: sub.key,
        label: sub.name,
        children: devices.value
          .filter(d => d.system === sys.key && d.subSystem === sub.key)
          .map(d => ({ value: d.id, label: d.name }))
      })).filter(sub => sub.children.length)
    })).filter(sys => sys.children.length)
  )

  // ============ Actions ============
  function selectDevice(id) {
    selectedDeviceId.value = selectedDeviceId.value === id ? null : id
  }
  function selectMonitorDevice(id) { monitorDeviceId.value = id }

  function getTrendData(sensorIds, hours) {
    const key = Array.isArray(sensorIds) ? sensorIds.join(',') : sensorIds
    const cacheKey = `${key}_${hours || 24}`
    if (!trendCache.value[cacheKey]) {
      trendCache.value[cacheKey] = generateTrendData(sensorIds, hours || 24)
    }
    return trendCache.value[cacheKey]
  }

  /** 实时刷新设备指标（小幅波动） */
  function refreshMetrics() {
    devices.value.forEach(d => {
      if (d.status === DEVICE_STATUS.OFFLINE) return
      Object.keys(d.metrics).forEach(key => {
        const base = d.metrics[key]
        d.metrics[key] = +(base + base * (Math.random() - 0.5) * 0.04).toFixed(2)
      })
      if (d.id === 'DEV-001') {
        d.metrics.temperature = +(91 + Math.random() * 3).toFixed(1)
        d.metrics.vibration = +(8.3 + Math.random() * 0.7).toFixed(2)
      }
    })
    refreshSensors()
    refreshTick.value++
  }

  /** 刷新传感器数据 */
  function refreshSensors() {
    sensors.value.forEach(s => {
      const base = s.value
      s.value = +(base + base * (Math.random() - 0.5) * 0.05).toFixed(s.unit === '%' ? 3 : 2)
      const [min, max] = s.range
      if (s.value > max * 1.08) s.status = 'danger'
      else if (s.value > max) s.status = 'warning'
      else if (s.value < min * 0.9) s.status = 'warning'
      else s.status = 'normal'
      // DEV-001 排温/振动/缸3保持异常
      if (s.deviceId === 'DEV-001' && (s.id === 'S-01' || s.id === 'S-02' || s.id === 'S-09')) {
        s.status = 'danger'
        if (s.id === 'S-01') s.value = +(91 + Math.random() * 2).toFixed(1)
        if (s.id === 'S-02') s.value = +(8.4 + Math.random() * 0.5).toFixed(2)
        if (s.id === 'S-09') s.value = +(93 + Math.random() * 2).toFixed(1)
      }
      if (s.id === 'S-14') { s.status = 'danger'; s.value = +(16 + Math.random() * 4).toFixed(0) }
    })
    const now = new Date()
    const pad = n => String(n).padStart(2, '0')
    sensorUpdatedAt.value = `${now.getFullYear()}-${pad(now.getMonth()+1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`
  }

  /** 联动更新设备状态 */
  function updateDeviceStatus(deviceId, newStatus) {
    const device = devices.value.find(d => d.id === deviceId)
    if (device) {
      device.status = newStatus
      if (newStatus === DEVICE_STATUS.NORMAL) device.alarm = null
    }
  }

  return {
    devices, selectedDeviceId, monitorDeviceId, trendCache, refreshTick,
    sensors, sensorUpdatedAt,
    selectedDevice, monitorDevice, deviceCount,
    statusStats, normalCount, alarmCount, offlineCount,
    abnormalDevices, abnormalSensors, sensorsBySystem, sortedSensors,
    devicesBySystem, healthScore, cascadeOptions,
    selectDevice, selectMonitorDevice, sensorsByPreset,
    getTrendData, refreshMetrics, refreshSensors, updateDeviceStatus
  }
})
