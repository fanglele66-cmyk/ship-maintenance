<template>
  <nav class="app-nav">
    <!-- Logo -->
    <div class="nav-logo">
      <span class="logo-icon">⚙️</span>
    </div>

    <!-- Nav Items -->
    <div class="nav-items">
      <router-link
        v-for="item in navItems"
        :key="item.path"
        :to="item.path"
        class="nav-item"
        :class="{ active: $route.path === item.path }"
      >
        <span class="nav-icon">{{ item.icon }}</span>
        <span class="nav-label">{{ item.label }}</span>
        <span
          v-if="item.path === '/event' && totalUnread > 0"
          class="nav-badge"
          :class="{ 'nav-badge-pulse': recentlyBumpedTotal }"
          :title="`${totalUnread} 条未读`"
        >
          {{ totalUnread > 99 ? '99+' : totalUnread }}
        </span>
      </router-link>
    </div>
  </nav>
</template>

<script setup>
import { inject, ref, watch, onUnmounted } from 'vue'

const totalUnread = inject('totalUnread', ref(0))

// 触发一次红圈缩放动画
const recentlyBumpedTotal = ref(false)
let bumpTimer = null
let lastTotal = 0
watch(totalUnread, (v) => {
  if (v > lastTotal) {
    recentlyBumpedTotal.value = true
    if (bumpTimer) clearTimeout(bumpTimer)
    bumpTimer = setTimeout(() => { recentlyBumpedTotal.value = false }, 1200)
  }
  lastTotal = v
})
onUnmounted(() => { if (bumpTimer) clearTimeout(bumpTimer) })

const navItems = [
  { path: '/event', icon: '📌', label: '事件' },
  { path: '/situation', icon: '📡', label: '态势' },
  { path: '/inspection', icon: '📋', label: '巡检' },
  { path: '/knowledge', icon: '📖', label: '知识' }
]
</script>

<style scoped>
.app-nav {
  width: var(--nav-width);
  height: 100%;
  background: #0C1A2E;
  display: flex;
  flex-direction: column;
  align-items: center;
  flex-shrink: 0;
  z-index: 100;
  border-right: 1px solid var(--border-color);
}

.nav-logo {
  width: 100%;
  height: 44px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-bottom: 1px solid var(--border-color);
}

.logo-icon {
  font-size: 20px;
  line-height: 1;
}

.nav-items {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 8px 0;
  gap: 4px;
}

.nav-item {
  position: relative;
  width: 48px;
  height: 48px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2px;
  border-radius: 8px;
  text-decoration: none;
  cursor: pointer;
  transition: all 0.2s ease;
}

.nav-item:hover {
  background: rgba(24,144,255,0.08);
}

.nav-item:hover .nav-label {
  color: #8BAAC0;
}

.nav-item.active {
  background: rgba(24,144,255,0.15);
}

.nav-item.active .nav-icon,
.nav-item.active .nav-label {
  color: var(--accent);
}

.nav-icon {
  font-size: 18px;
  line-height: 1;
  color: #5A7A92;
  transition: color 0.2s;
}

.nav-label {
  font-size: 9px;
  color: #5A7A92;
  line-height: 1;
  transition: color 0.2s;
}

/* Unread total badge — floating top-right corner of the nav item */
.nav-badge {
  position: absolute;
  top: 4px;
  right: 4px;
  min-width: 14px;
  height: 14px;
  padding: 0 4px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 7px;
  background: var(--danger);
  color: #fff;
  font-size: 9px;
  font-weight: 600;
  line-height: 1;
  box-shadow: 0 0 0 1.5px #0C1A2E;
}
.nav-badge-pulse {
  animation: nav-badge-pulse 1.2s ease-out;
}
@keyframes nav-badge-pulse {
  0%   { transform: scale(1); box-shadow: 0 0 0 0 rgba(255,77,79,0.6); }
  40%  { transform: scale(1.35); box-shadow: 0 0 0 6px rgba(255,77,79,0); }
  100% { transform: scale(1); }
}
</style>
