<template>
 <ElConfigProvider size="small">
  <div class="app-container">
    <AppNav />
    <div class="app-main">
      <AppHeader />
      <div class="app-content">
        <router-view v-slot="{ Component, route }">
          <transition name="fade-slide" mode="out-in">
            <KeepAlive :key="viewRevision">
              <component :is="Component" :key="route.name" />
            </KeepAlive>
          </transition>
        </router-view>
      </div>
    </div>
  </div>
 </ElConfigProvider>
</template>

<script setup>
import { ref, onBeforeUnmount } from 'vue'
import {ElConfigProvider} from 'element-plus'
import AppNav from '@/components/AppNav.vue'
import AppHeader from '@/components/AppHeader.vue'
import { installDevViewRecovery } from '@/utils/devViewRecovery'

const viewRevision=ref(0)
if(import.meta.hot){
  const stopRecovery=installDevViewRecovery(import.meta.hot,()=>{viewRevision.value++})
  onBeforeUnmount(stopRecovery)
}
</script>

<style scoped>
.app-container {
  width: 100%;
  height: 100%;
  display: flex;
  overflow: hidden;
}

.app-main {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.app-content {
  flex: 1;
  display: flex;
  overflow: hidden;
  min-height: 0;
}

/* Page transition */
.fade-slide-enter-active,
.fade-slide-leave-active {
  transition: all 0.25s ease;
}
.fade-slide-enter-from {
  opacity: 0;
  transform: translateX(16px);
}
.fade-slide-leave-to {
  opacity: 0;
  transform: translateX(-16px);
}
</style>
