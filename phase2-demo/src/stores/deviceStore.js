import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { shipInfo, mockDevices } from '@/mock/devices'
import {useSensorStore} from '@/stores/sensorStore'

export const useDeviceStore = defineStore('device', () => {
  const ship = ref({ ...shipInfo })
  const sensorStore=useSensorStore()
  const devices = computed(()=>[...mockDevices,...(mockDevices.some(device=>device.id==='aux-engine-3')?[]:[{...mockDevices.find(device=>device.id==='aux-engine-2'),id:'aux-engine-3',name:'3号辅机',status:'normal'}])].map(device=>{
    const points=sensorStore.allSensors.filter(s=>s.deviceId===device.id)
    return {...device,metrics:device.metrics.map(metric=>{
      const point=metric.label==='转速'?points.find(s=>s.unit==='rpm'):metric.label.includes('水温')?points.find(s=>s.nameCn.includes('水出口温度')):null
      return point?{...metric,value:point.value,status:point.status}:metric
    })}
  }))
  const selectedDeviceId = ref(null)

  const selectedDevice = computed(() => {
    if (!selectedDeviceId.value) return null
    return devices.value.find(d => d.id === selectedDeviceId.value) || null
  })

  const dangerDevices = computed(() =>
    devices.value.filter(d => d.status === 'danger')
  )

  const warningDevices = computed(() =>
    devices.value.filter(d => d.status === 'warning')
  )

  function selectDevice(deviceId) {
    selectedDeviceId.value = deviceId
  }

  function getDeviceById(id) {
    return devices.value.find(d => d.id === id) || null
  }

  // 获取某个系统下的所有设备
  function getDevicesBySystem(system) {
    if (system === '全部' || !system) return devices.value
    return devices.value.filter(d => d.system === system)
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
