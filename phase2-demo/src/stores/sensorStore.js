import { defineStore } from 'pinia'
import { ref, computed, reactive, watch, onScopeDispose } from 'vue'
import { mockSensors, subsystemTagsByDevice } from '@/mock/sensors'
import {simulationDefaults,buildSimulationSensors,simulationSample,simulationTrend} from '@/mock/sensorSimulation'

export const useSensorStore = defineStore('sensor', () => {
  const simulationConfig=reactive({...simulationDefaults})
  const simulationSensors=buildSimulationSensors(mockSensors)
  const sampledAt=ref(Date.now())
  const allSensors = ref(simulationSensors.map(s=>simulationSample(s,sampledAt.value,simulationConfig)))
  let timer=null
  function refreshSimulation(){sampledAt.value=Date.now();allSensors.value=simulationSensors.map(s=>simulationSample(s,sampledAt.value,simulationConfig))}
  function setSimulationBaselines(updates){
    for(const [id,settings] of Object.entries(updates)){const sensor=simulationSensors.find(s=>s.id===id);if(sensor)Object.assign(sensor,settings)}
    refreshSimulation()
  }
  function configureSimulation(settings){
    Object.assign(simulationConfig,{enabled:settings.enabled??simulationConfig.enabled,intervalSeconds:Math.min(300,Math.max(5,Number(settings.intervalSeconds)||30)),strength:Math.min(3,Math.max(0,Number(settings.strength??simulationConfig.strength)||0))})
  }
  watch(()=>[simulationConfig.enabled,simulationConfig.intervalSeconds,simulationConfig.strength],()=>{
    if(timer)clearInterval(timer)
    if(simulationConfig.enabled)refreshSimulation()
    timer=simulationConfig.enabled?setInterval(refreshSimulation,simulationConfig.intervalSeconds*1000):null
    timer?.unref?.() // SSR/unit tests should not be kept alive by the browser simulator.
  },{immediate:true})
  onScopeDispose(()=>{if(timer)clearInterval(timer)})
  function getSimulationTrend(id,hours=24,start=null,end=null){
    const sensor=simulationSensors.find(s=>s.id===id)
    if(!sensor)return []
    const cutoff=Math.min(end??sampledAt.value,sampledAt.value)
    const from=start??cutoff-hours*3600000
    const data=from>cutoff?[]:simulationTrend(sensor,from,cutoff,{...simulationConfig,enabled:true})
    const latest=allSensors.value.find(s=>s.id===id)
    if(data.length&&cutoff===sampledAt.value&&latest)data[data.length-1].value=latest.value
    return data
  }
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
    if(deviceId==='aux-system'||deviceId?.startsWith('aux-engine-'))return ['全部','发电系统','转速监测','排温系统','冷却系统','滑油系统']
    if(deviceId==='main-engine-1')return ['全部',...new Set([...subsystemTagsByDevice[deviceId],...allSensors.value.filter(sensor=>sensor.deviceId===deviceId).map(sensor=>sensor.subsystem).filter(Boolean)])]
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
      list = list.filter(s => currentDeviceId.value==='aux-system'?String(s.deviceId).startsWith('aux-engine-'):s.deviceId === currentDeviceId.value)
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
    return getSimulationTrend(sensor.id,trendHours.value)
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
    simulationConfig, sampledAt, configureSimulation, getSimulationTrend, setSimulationBaselines,
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
