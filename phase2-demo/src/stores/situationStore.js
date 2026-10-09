import { defineStore } from 'pinia'
import { ref } from 'vue'

// This store intentionally lives only in memory. It keeps the current
// situation drill-down while navigating between the top-level sections, but a
// full browser refresh still starts the situation page from its overview.
export const useSituationStore = defineStore('situation', () => {
  const currentLayer = ref(1)
  const selectedDeviceId = ref(null)
  const selectedDeviceName = ref('')
  const selectedSensorName = ref('')
  const sensorSearchQuery = ref('')
  const sensorView = ref('list')

  function reset() {
    currentLayer.value = 1
    selectedDeviceId.value = null
    selectedDeviceName.value = ''
    selectedSensorName.value = ''
    sensorSearchQuery.value = ''
    sensorView.value = 'list'
  }

  return {
    currentLayer,
    selectedDeviceId,
    selectedDeviceName,
    selectedSensorName,
    sensorSearchQuery,
    sensorView,
    reset
  }
})
