import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { mockSensors, systemTags, generateTrendData } from '@/mock/sensors'

export const useSensorStore = defineStore('sensor', () => {
  const allSensors = ref([...mockSensors])
  const currentSystem = ref('全部')
  const selectedSensorId = ref(null)
  const trendHours = ref(24)

  // 按系统筛选
  const filteredSensors = computed(() => {
    let list = [...allSensors.value]
    if (currentSystem.value !== '全部') {
      list = list.filter(s => s.system === currentSystem.value)
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
    selectedSensorId,
    trendHours,
    filteredSensors,
    selectedSensor,
    currentTrendData,
    sensorStats,
    selectSensor,
    setSystem,
    setTrendHours
  }
})
