<template>
  <nav class="app-nav">
    <!-- Logo -->
    <div class="nav-logo">
      <span class="logo-icon" aria-hidden="true"></span>
    </div>

    <!-- Nav Items -->
    <div class="nav-items">
      <router-link
        v-for="(item, idx) in navItems"
        :key="item.path"
        :to="item.path"
        @click="navigate(item.path)"
        class="nav-item"
        :class="{ active: isActive(item.path) }"
      >
        <!-- Icon -->
        <span class="nav-icon" :style="{ '--nav-icon-url': `url(${item.icon})` }"></span>
        <span class="nav-label">{{ item.label }}</span>
        <!-- Unread badge -->
        <span
          v-if="item.path === '/event' && totalUnread > 0"
          class="nav-badge"
          :class="{ 'nav-badge-pulse': recentlyBumpedTotal }"
          :title="`${totalUnread} 条未读`"
        ></span>
      </router-link>
    </div>
  </nav>
</template>

<script setup>
import { ref, computed, watch, onUnmounted } from 'vue'
import { useRoute } from 'vue-router'
import { useEventStore } from '@/stores/eventStore'
import { usePhase2DemoStore } from '@/stores/phase2DemoStore'

const route = useRoute()
const eventStore = useEventStore()
const demoStore = usePhase2DemoStore()
function navigate(path){if(path==='/event')demoStore.closeTodo();if(path==='/situation')demoStore.showCaptainWorkbench()}
const totalUnread = computed(() => route.path==='/phase1-event'?eventStore.totalUnread:demoStore.visibleTodos.filter(todo=>demoStore.progress[todo.id]===0).length)

// 精确匹配 + 子路由匹配
function isActive(path) {
  const issueDetail = route.path.startsWith('/situation/issue/') && route.query.from === 'issues'
  if (path === '/issues') return route.path === '/issues' || issueDetail
  if (path === '/situation' && issueDetail) return false
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
  { path: '/situation', label: '态势', icon: '/nav-icons/situation.svg' },
  { path: '/issues', label: '事件', icon: '/nav-icons/event.svg' },
  { path: '/event', label: '待办', icon: '/nav-icons/inspection.svg' },
  { path: '/knowledge', label: '知识', icon: '/nav-icons/knowledge.svg' }
]
</script>

<style scoped>
.app-nav {
  width: var(--nav-width);
  height: 100%;
  background: #1B2033;
  display: flex;
  flex-direction: column;
  align-items: center;
  flex-shrink: 0;
  z-index: 100;
  border-right: 0;
}

.nav-logo {
  width: 100%;
  height: 48px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.logo-icon {
  width: 24px;
  height: 24px;
  display: block;
  background: #FFFFFF;
  mask: url('/nav-icons/logo.svg') center / contain no-repeat;
  -webkit-mask: url('/nav-icons/logo.svg') center / contain no-repeat;
}

.nav-items {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 12px 0;
  gap: 8px;
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
  border-radius: 12px;
  text-decoration: none;
  cursor: pointer;
  transition: all 0.18s ease;
}

.nav-item:hover {
  background: #252B40;
}

.nav-item.active {
  background: #106BFF;
}

.nav-item.active .nav-icon,
.nav-item.active .nav-label {
  color: #FFFFFF;
}

.nav-icon {
  width: 24px;
  height: 24px;
  color: #9195A2;
  background: currentColor;
  mask: var(--nav-icon-url) center / contain no-repeat;
  -webkit-mask: var(--nav-icon-url) center / contain no-repeat;
  transition: color 0.18s;
  display: block;
}

.nav-label {
  font-size: 12px;
  color: #9195A2;
  line-height: 1;
  transition: color 0.18s;
}

/* Unread badge */
.nav-badge {
  position: absolute;
  top: 5px;
  right: 4px;
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--danger);
  box-shadow: 0 0 0 2px #1B2033;
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
