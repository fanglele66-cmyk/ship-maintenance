import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { mockSensors, systemTags, generateTrendData, subsystemTagsByDevice } from '@/mock/sensors'

export const useSensorStore = defineStore('sensor', () => {
  const allSensors = ref([...mockSensors])
  const currentSystem = ref('全部')
  const currentDeviceId = ref(null)
  const currentSubsystem = ref('全部')
  const selectedSensorId = ref(null)
  const trendHours = ref(24)

  /**
   * 当前设备对应的子系统标签列表
   */
  const currentSubsystemTags = computed(() => {
    const deviceId = currentDeviceId.value
    if (!deviceId || !subsystemTagsByDevice[deviceId]) return ['全部']
    return ['全部', ...subsystemTagsByDevice[deviceId]]
  })

  /**
   * 传感器筛选逻辑：
   * 1. 如果选中了特定设备 → 按设备筛选 + 按子系统二次筛选
   * 2. 否则 → 按旧 system 字段筛选
   */
  const filteredSensors = computed(() => {
    let list = [...allSensors.value]

    if (currentDeviceId.value) {
      // 设备级：先按设备筛选
      list = list.filter(s => s.deviceId === currentDeviceId.value)
      // 再按子系统二次筛选
      if (currentSubsystem.value !== '全部') {
        list = list.filter(s => s.subsystem === currentSubsystem.value)
      }
    } else {
      // 全局级：按旧 system 字段筛选
      if (currentSystem.value !== '全部') {
        list = list.filter(s => s.system === currentSystem.value)
      }
    }

    // 超限/异常排前面
    const order = { over: 0, warning: 1, normal: 2 }
    list.sort((a, b) => (order[a.status] ?? 3) - (order[b.status] ?? 3))
    return list
  })

  const selectedSensor = computed(() => {
    if (!selectedSensorId.value) return null
    return allSensors.value.find(s => s.id === selectedSensorId.value) || null
  })

  // 当前选中传感器的趋势数据
  const currentTrendData = computed(() => {
    const sensor = selectedSensor.value
    if (!sensor) return []
    return generateTrendData(sensor.value, sensor.value * 0.1, trendHours.value)
  })

  // 统计数据
  const sensorStats = computed(() => {
    const list = filteredSensors.value
    return {
      total: list.length,
      over: list.filter(s => s.status === 'over').length,
      warning: list.filter(s => s.status === 'warning').length,
      normal: list.filter(s => s.status === 'normal').length
    }
  })

  function selectSensor(sensorId) {
    selectedSensorId.value = sensorId
  }

  /**
   * 进入设备级视图：锁定到特定设备，默认显示全部子系统
   */
  function setDevice(deviceId) {
    currentDeviceId.value = deviceId
    currentSubsystem.value = '全部'
    selectedSensorId.value = null
  }

  /**
   * 设置子系统筛选
   */
  function setSubsystem(subsystem) {
    currentSubsystem.value = subsystem
  }

  /**
   * 退出设备级视图，回到全局系统视图
   */
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
