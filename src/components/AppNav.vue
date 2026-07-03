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
      </router-link>
    </div>
  </nav>
</template>

<script setup>
const navItems = [
  { path: '/event', icon: '📌', label: '事件' },
  { path: '/situation', icon: '📡', label: '态势' },
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
</style>
