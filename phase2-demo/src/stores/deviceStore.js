import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { shipInfo, mockDevices } from '@/mock/devices'
import { useSensorStore } from '@/stores/sensorStore'
import { useShipConfigStore } from '@/stores/shipConfigStore'

export const useDeviceStore = defineStore('device', () => {
  const ship = ref({ ...shipInfo })
  const sensorStore = useSensorStore()
  const shipConfigStore = useShipConfigStore()

  const devices = computed(() => {
    const configured = shipConfigStore.devices.map((cfg) => {
      const points = sensorStore.allSensors.filter((s) => s.deviceId === cfg.id)
      const rpm = points.find((s) => s.pointCode === 'DC0001')
      const temp = points.find((s) => s.pointCode === 'DC0046') || points.find((s) => s.unit === '°C')
      const hasOver = points.some((s) => s.status === 'over')
      const base = mockDevices.find((d) => d.id === cfg.id)
      return {
        ...(base || {}),
        id: cfg.id,
        name: cfg.name,
        code: cfg.code,
        deviceTypeId: cfg.deviceTypeId,
        deviceTypeName: cfg.deviceTypeName,
        system: null,
        enabled: cfg.enabled,
        status: hasOver ? 'warning' : 'normal',
        metrics: [
          { label: '转速', value: rpm?.value ?? null, unit: rpm?.unit || 'RPM', status: rpm?.status || 'normal' },
          { label: '冷却水温', value: temp?.value ?? null, unit: temp?.unit || '°C', status: temp?.status || 'normal' }
        ]
      }
    })
    const configuredIds = new Set(configured.map((d) => d.id))
    const legacy = mockDevices
      .filter((d) => !configuredIds.has(d.id) && d.id !== 'aux-engine-1')
      .map((device) => {
        const points = sensorStore.allSensors.filter((s) => s.deviceId === device.id)
        return {
          ...device,
          metrics: device.metrics.map((metric) => {
            const point = metric.label === '转速'
              ? points.find((s) => s.unit === 'rpm')
              : metric.label.includes('水温')
                ? points.find((s) => s.nameCn.includes('水出口温度'))
                : null
            return point ? { ...metric, value: point.value, status: point.status } : metric
          })
        }
      })
    return [...configured, ...legacy]
  })

  const selectedDeviceId = ref(null)

  const selectedDevice = computed(() => {
    if (!selectedDeviceId.value) return null
    return devices.value.find((d) => d.id === selectedDeviceId.value) || null
  })

  const dangerDevices = computed(() => devices.value.filter((d) => d.status === 'danger'))
  const warningDevices = computed(() => devices.value.filter((d) => d.status === 'warning'))

  function selectDevice(deviceId) {
    selectedDeviceId.value = deviceId
  }

  function getDeviceById(id) {
    return devices.value.find((d) => d.id === id) || null
  }

  function getDevicesBySystem(system) {
    if (system === '全部' || !system) return devices.value
    return devices.value.filter((d) => d.system === system)
  }

  return {
    ship,
    devices,
    selectedDeviceId,
    selectedDevice,
    dangerDevices,
    warningDevices,
    selectDevice,
    getDeviceById,
    getDevicesBySystem
  }
})
