import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { shipInfo, mockDevices } from '@/mock/devices'

export const useDeviceStore = defineStore('device', () => {
  const ship = ref({ ...shipInfo })
  const devices = ref([...mockDevices])
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
