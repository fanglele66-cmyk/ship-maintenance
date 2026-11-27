import { appUrl } from '../services/appUrl.js'
import { defineStore } from 'pinia'
import { sessionHeaders } from '../services/session.js'
import { ref, computed, reactive, watch, onScopeDispose } from 'vue'
import { mockSensors, subsystemTagsByDevice } from '@/mock/sensors'
import {
  buildConfiguredDeviceSensors,
  parsePointCodeFromSensorId,
  toTemplateUnitValue,
  isLocalSensor
} from '@/workflow/localSensorData.js'
import { simulationDefaults, buildSimulationSensors, simulationSample, simulationTrend } from '@/mock/sensorSimulation'
import { useShipConfigStore } from '@/stores/shipConfigStore'

export const useSensorStore = defineStore('sensor', () => {
  const shipConfigStore = useShipConfigStore()
  const simulationConfig = reactive({ ...simulationDefaults })
  const simulationSensors = buildSimulationSensors(mockSensors)
  const sampledAt = ref(Date.now())
  const simulationSampledAt = ref(sampledAt.value)
  let readingFailed = false
  const localData = ref(null)
  const localError = ref('正在连接本地数据服务')
  const health = ref(null)

  const configuredDeviceIds = computed(() => new Set((shipConfigStore.config?.devices || []).map((d) => d.id)))

  function isSimulatedDeviceSensor(sensor) {
    if (isLocalSensor(sensor)) return false
    if (String(sensor.deviceId || '').startsWith('aux-engine-')) return false
    if (configuredDeviceIds.value.has(sensor.deviceId)) return false
    return true
  }

  function buildAllSensors(nowTs = simulationSampledAt.value) {
    const simulated = simulationSensors
      .filter(isSimulatedDeviceSensor)
      .map((s) => simulationSample(s, nowTs, simulationConfig))
    const configured = buildConfiguredDeviceSensors(
      shipConfigStore.config?.devices || [],
      readingFailed ? [] : localData.value?.points,
      shipConfigStore.template
    )
    const speedEntry = localData.value
      ? [{
          id: 'ship-speed',
          nameCn: '航速',
          deviceId: 'ship',
          value: readingFailed ? null : localData.value.speed,
          unit: 'kn',
          status: readingFailed || localData.value.speed === null ? 'unknown' : 'normal',
          sourceKind: localData.value.source
        }]
      : []
    return [...simulated, ...configured, ...speedEntry]
  }

  const allSensors = ref(buildAllSensors())
  const localChronology = computed(() => localData.value?.chronology || { periods: [], source: '本地数据库', markdown: '' })

  function syncConfiguredSensors() {
    allSensors.value = buildAllSensors()
  }

  watch(
    () => shipConfigStore.config,
    () => {
      syncConfiguredSensors()
    },
    { deep: true }
  )

  let fetching = false
  async function refreshLocalData() {
    if (fetching) return
    fetching = true
    try {
      const responses = await Promise.all(
        ['/api/data/situation', '/api/data/health'].map((url) =>
          fetch(appUrl(url), { headers: sessionHeaders(), signal: AbortSignal.timeout(15000) })
        )
      )
      if (!responses[0].ok) throw Error('本地数据不可用，请检查后端与数据副本。')
      const data = await responses[0].json()
      readingFailed = false
      localData.value = data
      if (Number.isFinite(data.sampledAt)) sampledAt.value = data.sampledAt
      allSensors.value = buildAllSensors()
      localError.value = data.exhausted
        ? '历史回放数据已用尽，请准备新的数据副本。'
        : !data.fresh
          ? '当前数据存在缺口，等待下一条采样。'
          : ''
      if (responses[1].ok) health.value = await responses[1].json()
      if (Number.isFinite(data.sampledAt) && data.fresh) {
        retainSamples(localFrames, data.sampledAt, allSensors.value.filter(isLocalSensor))
      }
    } catch (error) {
      readingFailed = true
      localError.value = error.message
      allSensors.value = allSensors.value.map((s) => (isLocalSensor(s) ? { ...s, value: null, status: 'unknown' } : s))
    } finally {
      fetching = false
    }
  }

  let dataTimer = null
  if (typeof window !== 'undefined') {
    void refreshLocalData()
    dataTimer = setInterval(refreshLocalData, 15000)
  }

  // Retain only samples actually emitted in this session. Never regenerate a
  // past repair window from today's simulator baseline.
  const localFrames = [], simulationFrames = []
  function retainSamples(sampledFrames, timestamp, sensors) {
    const frame = {
      timestamp,
      values: Object.fromEntries(sensors.map((sensor) => [sensor.id, sensor.value]))
    }
    if (sampledFrames.at(-1)?.timestamp === frame.timestamp) sampledFrames[sampledFrames.length - 1] = frame
    else sampledFrames.push(frame)
    while (sampledFrames.length && sampledFrames[0].timestamp < frame.timestamp - 72 * 3600000) sampledFrames.shift()
  }

  function recordedSensorChannels(ids, start, end = Date.now()) {
    return ids.map((id) => {
      const sensor = allSensors.value.find((item) => item.id === id)
      return {
        channelId: id,
        name: sensor?.nameCn || id,
        unit: sensor?.unit || '',
        sourceKind: sensor?.sourceKind || 'prototype',
        trendData: (isLocalSensor(sensor) ? localFrames : simulationFrames)
          .filter((frame) => frame.timestamp >= start && frame.timestamp <= end)
          .map((frame) => ({
            timestamp: frame.timestamp,
            value: Number.isFinite(frame.values[id]) ? frame.values[id] : null
          }))
      }
    })
  }

  let timer = null
  function refreshSimulation() {
    const at = Date.now()
    simulationSampledAt.value = at
    allSensors.value = buildAllSensors(at)
    retainSamples(simulationFrames, at, allSensors.value.filter(isSimulatedDeviceSensor))
  }

  function setSimulationBaselines(updates) {
    for (const [id, settings] of Object.entries(updates)) {
      const sensor = simulationSensors.find((s) => s.id === id)
      if (sensor) Object.assign(sensor, settings)
    }
    refreshSimulation()
  }

  function configureSimulation(settings) {
    Object.assign(simulationConfig, {
      enabled: settings.enabled ?? simulationConfig.enabled,
      intervalSeconds: Math.min(300, Math.max(5, Number(settings.intervalSeconds) || 30)),
      strength: Math.min(3, Math.max(0, Number(settings.strength ?? simulationConfig.strength) || 0))
    })
  }

  watch(
    () => [simulationConfig.enabled, simulationConfig.intervalSeconds, simulationConfig.strength],
    () => {
      if (timer) clearInterval(timer)
      if (simulationConfig.enabled) refreshSimulation()
      timer = simulationConfig.enabled ? setInterval(refreshSimulation, simulationConfig.intervalSeconds * 1000) : null
      timer?.unref?.()
    },
    { immediate: true }
  )

  onScopeDispose(() => {
    if (timer) clearInterval(timer)
    if (dataTimer) clearInterval(dataTimer)
  })

  function getPointTrendByCode(pointCode, hours = 24, start = null, end = null) {
    const rawList = localData.value?.trends?.[pointCode] || []
    if (!rawList.length) return []
    const latestTs = localData.value?.now || rawList.at(-1)?.timestamp || Date.now()
    const cutoff = end !== null ? Math.min(end, latestTs) : latestTs
    const from = start !== null ? start : cutoff - hours * 3600000
    return rawList
      .filter((p) => p.timestamp >= from && p.timestamp <= cutoff)
      .map((p) => ({
        timestamp: p.timestamp,
        value: toTemplateUnitValue(pointCode, p.value),
        time: new Date(p.timestamp).toLocaleTimeString('zh-CN', {
          hour: '2-digit',
          minute: '2-digit',
          timeZone: 'Asia/Shanghai',
          hour12: false
        })
      }))
  }

  function getSimulationTrend(id, hours = 24, start = null, end = null, maxPoints = 900) {
    const localCode = parsePointCodeFromSensorId(id)
    if (localCode) {
      return getPointTrendByCode(localCode, hours, start, end)
    }
    if (id === 'ship-speed' || id === 'main-load') return []
    const sensor = simulationSensors.find((s) => s.id === id)
    if (!sensor) return []
    const cutoff = Math.min(end ?? simulationSampledAt.value, simulationSampledAt.value)
    const from = start ?? cutoff - hours * 3600000
    const data = from > cutoff ? [] : simulationTrend(sensor, from, cutoff, { ...simulationConfig, enabled: true }, maxPoints)
    const latest = allSensors.value.find((s) => s.id === id)
    if (data.length && cutoff === simulationSampledAt.value && latest) data[data.length - 1].value = latest.value
    return data
  }

  const currentSystem = ref('全部')
  const currentDeviceId = ref(null)
  const currentSubsystem = ref('全部')
  const selectedSensorId = ref(null)
  const trendHours = ref(24)

  const currentSubsystemTags = computed(() => {
    const deviceId = currentDeviceId.value
    if (!deviceId) return ['全部']
    const deviceSensors = allSensors.value.filter((sensor) => sensor.deviceId === deviceId)
    if (deviceSensors.length) {
      return ['全部', ...new Set(deviceSensors.map((sensor) => sensor.subsystem).filter(Boolean))]
    }
    if (subsystemTagsByDevice[deviceId]) return ['全部', ...subsystemTagsByDevice[deviceId]]
    return ['全部']
  })

  const filteredSensors = computed(() => {
    let list = [...allSensors.value]

    if (currentDeviceId.value) {
      list = list.filter((s) => s.deviceId === currentDeviceId.value)
      if (currentSubsystem.value !== '全部') {
        list = list.filter((s) => s.subsystem === currentSubsystem.value)
      }
    } else if (currentSystem.value !== '全部') {
      list = list.filter((s) => s.system === currentSystem.value)
    }

    const order = { over: 0, warning: 1, normal: 2 }
    list.sort((a, b) => (order[a.status] ?? 3) - (order[b.status] ?? 3))
    return list
  })

  const selectedSensor = computed(() => {
    if (!selectedSensorId.value) return null
    return allSensors.value.find((s) => s.id === selectedSensorId.value) || null
  })

  const currentTrendData = computed(() => {
    const sensor = selectedSensor.value
    if (!sensor) return []
    return getSimulationTrend(sensor.id, trendHours.value)
  })

  const sensorStats = computed(() => {
    const list = filteredSensors.value
    return {
      total: list.length,
      over: list.filter((s) => s.status === 'over').length,
      warning: list.filter((s) => s.status === 'warning').length,
      normal: list.filter((s) => s.status === 'normal').length
    }
  })

  function selectSensor(sensorId) {
    selectedSensorId.value = sensorId
  }

  function setDevice(deviceId) {
    currentDeviceId.value = deviceId
    if (configuredDeviceIds.value.has(deviceId)) trendHours.value = Math.min(trendHours.value, 24)
    currentSubsystem.value = '全部'
    selectedSensorId.value = null
  }

  function setSubsystem(subsystem) {
    currentSubsystem.value = subsystem
  }

  function clearDevice() {
    currentDeviceId.value = null
    currentSubsystem.value = '全部'
    currentSystem.value = '全部'
    selectedSensorId.value = null
  }

  function setSystem(system) {
    currentSystem.value = system
    selectedSensorId.value = null
  }

  function setTrendHours(hours) {
    trendHours.value = hours
  }

  return {
    allSensors,
    localData,
    localError,
    localChronology,
    health,
    refreshLocalData,
    simulationConfig,
    sampledAt,
    configureSimulation,
    getSimulationTrend,
    getPointTrendByCode,
    setSimulationBaselines,
    recordedSensorChannels,
    currentSystem,
    currentDeviceId,
    currentSubsystem,
    selectedSensorId,
    trendHours,
    currentSubsystemTags,
    filteredSensors,
    selectedSensor,
    currentTrendData,
    sensorStats,
    selectSensor,
    setDevice,
    setSubsystem,
    clearDevice,
    setSystem,
    setTrendHours
  }
})
