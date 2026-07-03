<template>
  <div class="app-container">
    <AppNav />
    <div class="app-main">
      <AppHeader />
      <div class="app-content">
        <router-view v-slot="{ Component }">
          <transition name="fade-slide" mode="out-in">
            <component :is="Component" />
          </transition>
        </router-view>
      </div>
    </div>
  </div>
</template>

<script setup>
import AppNav from '@/components/AppNav.vue'
import AppHeader from '@/components/AppHeader.vue'
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
