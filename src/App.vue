<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import { useShipStore } from '@/stores/shipStore'
import { useDeviceStore } from '@/stores/deviceStore'
import AppHeader from '@/components/AppHeader.vue'
import ReportModal from '@/components/ReportModal.vue'
import AssistantPanel from '@/components/AssistantPanel.vue'

const shipStore = useShipStore()
const deviceStore = useDeviceStore()

const reportVisible = ref(false)
const reportPrefill = ref({})
const assistantVisible = ref(false)
const assistantEventId = ref(null)   // null = 通用助手模式；有值 = 事件内助手

function openReport(prefill = {}) {
  reportPrefill.value = prefill
  reportVisible.value = true
}

// 通用助手：不带事件
function openGeneralAssistant() {
  assistantEventId.value = null
  assistantVisible.value = true
}

// 事件内助手：带事件ID自动关联
function openEventAssistant(eventId) {
  assistantEventId.value = eventId || null
  assistantVisible.value = true
}

let timeTimer = null
let metricsTimer = null

onMounted(() => {
  timeTimer = setInterval(() => shipStore.tickTime(), 1000)
  metricsTimer = setInterval(() => {
    if (shipStore.isOnline) deviceStore.refreshMetrics()
  }, 5000)
})
onUnmounted(() => {
  clearInterval(timeTimer)
  clearInterval(metricsTimer)
})
</script>

<template>
  <div class="app-layout">
    <AppHeader
      @report="openReport()"
      @knowledge="$router.push('/knowledge')"
      @assistant="openGeneralAssistant"
    />

    <main class="app-main">
      <router-view v-slot="{ Component }">
        <transition name="fade" mode="out-in">
          <component :is="Component" @report="openReport" @assistant="openEventAssistant" />
        </transition>
      </router-view>
    </main>

    <ReportModal v-model="reportVisible" :prefill="reportPrefill" />
    <AssistantPanel v-model:visible="assistantVisible" :event-id="assistantEventId" />
  </div>
</template>

<style scoped>
.app-layout {
  display: flex; flex-direction: column;
  height: 100vh; width: 100vw;
  background: var(--bg-primary);
}
.app-main {
  flex: 1; overflow-y: auto; overflow-x: hidden;
  background: var(--bg-primary);
}
</style>
