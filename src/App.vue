<script setup>
import { onMounted, onUnmounted, computed } from 'vue'
import { useRoute } from 'vue-router'
import { useShipStore } from '@/stores/shipStore'
import { useDeviceStore } from '@/stores/deviceStore'
import AppHeader from '@/components/AppHeader.vue'
import AppNav from '@/components/AppNav.vue'
import AssistantPanel from '@/components/AssistantPanel.vue'

const route = useRoute()
const shipStore = useShipStore()
const deviceStore = useDeviceStore()

const showAssistant = computed(() => route.path !== '/knowledge')

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
    <AppHeader />
    <div class="app-body">
      <AppNav />
      <main class="app-main">
        <router-view v-slot="{ Component }">
          <transition name="fade" mode="out-in">
            <component :is="Component" />
          </transition>
        </router-view>
      </main>
      <AssistantPanel v-if="showAssistant" />
    </div>
  </div>
</template>

<style scoped>
.app-layout {
  display: flex;
  flex-direction: column;
  height: 100vh;
  width: 100vw;
  background: var(--bg-primary);
  overflow: hidden;
}
.app-body {
  flex: 1;
  display: flex;
  overflow: hidden;
}
.app-main {
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
  background: var(--bg-primary);
}
</style>
