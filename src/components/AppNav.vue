<template>
  <nav class="app-nav">
    <router-link
      v-for="item in navItems"
      :key="item.path"
      :to="item.path"
      class="nav-item"
      :class="{ active: isActive(item.path) }"
    >
      <Icon :icon="item.icon" class="nav-icon" />
      <span class="nav-label">{{ item.label }}</span>
    </router-link>
  </nav>
</template>

<script setup>
import { useRoute } from 'vue-router'
import { Icon } from '@iconify/vue'

const route = useRoute()

const navItems = [
  { path: '/event', label: '事件', icon: 'mdi:bell-ring' },
  { path: '/situation', label: '态势', icon: 'mdi:radar' },
  { path: '/knowledge', label: '知识', icon: 'mdi:bookshelf' }
]

function isActive(path) {
  return route.path === path || route.path.startsWith(path + '/')
}
</script>

<style scoped>
.app-nav {
  width: 56px;
  background: #0C1A2E;
  border-right: 1px solid var(--border-color);
  display: flex;
  flex-direction: column;
  padding: 12px 0;
  gap: 4px;
}

.nav-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 10px 8px;
  text-decoration: none;
  color: var(--text-secondary);
  transition: all 0.15s ease;
  border-radius: 6px;
  margin: 0 4px;
}

.nav-icon {
  font-size: 18px;
}

.nav-label {
  font-size: 9px;
  font-weight: 600;
}

.nav-item:hover {
  background: rgba(24, 144, 255, 0.08);
  color: var(--text-secondary);
}

.nav-item.active {
  background: rgba(24, 144, 255, 0.15);
  color: var(--accent-primary);
}
</style>
