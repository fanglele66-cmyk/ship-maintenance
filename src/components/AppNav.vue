<template>
  <nav class="app-nav">
    <!-- Logo -->
    <div class="nav-logo">
      <svg class="logo-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="12" cy="5" r="3"/>
        <path d="M12 8v4"/>
        <line x1="8" y1="8" x2="16" y2="8"/>
        <line x1="8" y1="21" x2="16" y2="21"/>
        <line x1="12" y1="16" x2="12" y2="21"/>
        <path d="M5 21c0-3.87 3.13-7 7-7s7 3.13 7 7"/>
      </svg>
    </div>

    <!-- Nav Items -->
    <div class="nav-items">
      <router-link
        v-for="(item, idx) in navItems"
        :key="item.path"
        :to="item.path"
        class="nav-item"
        :class="{ active: isActive(item.path) }"
      >
        <!-- Icon -->
        <span class="nav-icon">
          <!-- 事件：对话气泡 -->
          <svg v-if="idx === 0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
            <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/>
          </svg>
          <!-- 态势：雷达 -->
          <svg v-else-if="idx === 1" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="10"/>
            <circle cx="12" cy="12" r="6"/>
            <circle cx="12" cy="12" r="2"/>
            <line x1="12" y1="12" x2="12" y2="2"/>
            <line x1="16.95" y1="7.05" x2="12" y2="12"/>
          </svg>
          <!-- 巡检：剪贴板 -->
          <svg v-else-if="idx === 2" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
            <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/>
            <rect x="8" y="2" width="8" height="4" rx="1"/>
            <line x1="9" y1="12" x2="15" y2="12"/>
            <line x1="9" y1="16" x2="13" y2="16"/>
          </svg>
          <!-- 知识：书 -->
          <svg v-else-if="idx === 3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
            <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/>
            <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
            <line x1="10" y1="8" x2="17" y2="8"/>
            <line x1="10" y1="12" x2="15" y2="12"/>
          </svg>
        </span>
        <span class="nav-label">{{ item.label }}</span>
        <!-- Unread badge -->
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
import { ref, computed, watch, onUnmounted } from 'vue'
import { useRoute } from 'vue-router'
import { useEventStore } from '@/stores/eventStore'

const route = useRoute()
const eventStore = useEventStore()
const totalUnread = computed(() => eventStore.totalUnread)

// 精确匹配 + 子路由匹配
function isActive(path) {
  return route.path === path || route.path.startsWith(path + '/')
}

// 未读脉冲动画
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
  { path: '/event', label: '事件' },
  { path: '/situation', label: '态势' },
  { path: '/inspection', label: '日志' },
  { path: '/knowledge', label: '知识' }
]
</script>

<style scoped>
.app-nav {
  width: var(--nav-width);
  height: 100%;
  background: var(--bg-panel);
  display: flex;
  flex-direction: column;
  align-items: center;
  flex-shrink: 0;
  z-index: 100;
  border-right: 1px solid var(--border-primary);
}

.nav-logo {
  width: 100%;
  height: 48px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-bottom: 1px solid var(--border-primary);
}

.logo-svg {
  width: 24px;
  height: 24px;
  color: var(--accent);
}

.nav-items {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 10px 0;
  gap: 2px;
}

.nav-item {
  position: relative;
  width: 56px;
  height: 54px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 3px;
  border-radius: 10px;
  text-decoration: none;
  cursor: pointer;
  transition: all 0.18s ease;
}

.nav-item:hover {
  background: var(--bg-hover);
}

.nav-item:hover .nav-label {
  color: var(--text-secondary);
}

.nav-item.active {
  background: var(--bg-selected);
}

.nav-item.active .nav-icon,
.nav-item.active .nav-label {
  color: var(--accent);
}

.nav-icon {
  width: 22px;
  height: 22px;
  color: var(--text-muted);
  transition: color 0.18s;
  display: flex;
  align-items: center;
  justify-content: center;
}

.nav-icon svg {
  width: 22px;
  height: 22px;
}

.nav-label {
  font-size: var(--font-xs);
  color: var(--text-muted);
  line-height: 1;
  transition: color 0.18s;
}

/* Unread badge */
.nav-badge {
  position: absolute;
  top: 8px;
  right: 8px;
  min-width: 16px;
  height: 16px;
  padding: 0 4px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 8px;
  background: var(--danger);
  color: #fff;
  font-size: var(--font-xs);
  font-weight: 600;
  line-height: 1;
  box-shadow: 0 0 0 2px var(--bg-panel);
  pointer-events: none;
}

.nav-badge-pulse {
  animation: nav-badge-pulse 1.2s ease-out;
}

@keyframes nav-badge-pulse {
  0%   { transform: scale(1); box-shadow: 0 0 0 0 rgba(245,63,63,0.6); }
  40%  { transform: scale(1.35); box-shadow: 0 0 0 6px rgba(245,63,63,0); }
  100% { transform: scale(1); }
}
</style>
