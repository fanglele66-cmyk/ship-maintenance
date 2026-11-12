<template>
  <nav class="app-nav">
    <!-- Logo -->
    <div class="nav-logo">
      <img class="logo-icon" src="/nav-icons/wenyao-white.png" alt="众数文鳐" width="36" height="28" />
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
        <Document v-if="item.path==='/reports'" class="nav-icon nav-report-icon" aria-hidden="true"/>
        <span v-else class="nav-icon" :style="{ '--nav-icon-url': `url(${appStyleUrl(item.icon)})` }"></span>
        <span class="nav-label">{{ item.label }}</span>
        <!-- Unread badge -->
        <span
          v-if="item.path === '/event' && totalUnread > 0"
          class="nav-badge"
          :class="{ 'nav-badge-pulse': recentlyBumpedTotal }"
          :title="`${totalUnread} 项任务待处理`"
          :aria-label="`${totalUnread} 项任务待处理`"
        ></span>
      </router-link>
    </div>
    <el-popover trigger="click" placement="right-end" :width="210" v-model:visible="roleMenuOpen">
      <template #reference><button class="nav-role-avatar" type="button" :aria-label="'当前账号，'+roleLabel" :title="roleLabel" :aria-expanded="roleMenuOpen">{{roleLabel.slice(0,1)}}</button></template>
      <div class="nav-role-menu" aria-label="当前账号"><strong>{{auth.user?.name}} · {{roleLabel}}</strong><span>{{auth.user?.username}}</span><button type="button" @click="signOut">退出登录</button><span v-if="logoutError" role="alert">{{logoutError}}</span></div>
    </el-popover>
  </nav>
</template>

<script setup>
import {appStyleUrl} from '../services/appUrl.js'
import {ElPopover} from 'element-plus'
import 'element-plus/es/components/popover/style/css'
import {auth,logout} from '../services/auth'
import {Document} from '@element-plus/icons-vue'
import { ref, computed, watch, onUnmounted } from 'vue'
import { useRoute } from 'vue-router'
import { useEventStore } from '@/stores/eventStore'
import { usePhase2DemoStore } from '@/stores/phase2DemoStore'
import {useEventLifecycleStore} from '../stores/eventLifecycleStore'

const route = useRoute()
const eventStore = useEventStore()
const demoStore = usePhase2DemoStore()
const lifecycle=useEventLifecycleStore(),roleMenuOpen=ref(false)
const roleLabel=computed(()=>auth.user?.roleLabel||''),logoutError=ref('')
async function signOut(){try{await logout()}catch(e){logoutError.value=e.message}}
function navigate(path){if(path==='/event')demoStore.closeTodo();if(path==='/situation')demoStore.showCaptainWorkbench()}
const totalUnread = computed(() => route.path==='/phase1-event'?eventStore.totalUnread:lifecycle.workItems.pending.filter(item=>item.kind==='task').length)

// 精确匹配 + 子路由匹配
function isActive(path) {
  if(route.path.startsWith('/tasks/'))return path==='/event'
  const detail=route.path.startsWith('/situation/issue/')
  if(detail){if(route.query.from==='tasks')return path==='/event';if(route.query.from==='workbench')return path==='/situation';return path==='/issues'}
  if(route.path.startsWith('/reports'))return path==='/reports'
  const issueDetail = false
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
  { path: '/event', label: '任务', icon: '/nav-icons/inspection.svg' },
  { path: '/reports', label: '报告' },
  { path: '/knowledge', label: '知识库', icon: '/nav-icons/knowledge.svg' }
]
</script>

<style scoped>
.nav-role-avatar{width:42px;height:42px;border-radius:50%;margin:12px 0 16px;border:1px solid #b79b66;background:#34332d;color:#ead9b8;cursor:pointer;font-family:inherit;font-size:15px;font-weight:600;flex-shrink:0}.nav-role-avatar:focus-visible{outline:2px solid #d8bc87;outline-offset:3px}.nav-role-menu{display:grid;gap:8px;color:#37434a}.nav-role-menu>strong{font-size:12px;color:#86908b;padding:5px}.nav-role-menu button{text-align:left;background:transparent;border:0;border-radius:6px;padding:10px;cursor:pointer;color:inherit}.nav-role-menu button:hover,.nav-role-menu button[aria-pressed=true]{background:#f4efe4;color:#8b6937}

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
  width: 36px;
  height: 28px;
  display: block;
  object-fit: contain;
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

.nav-icon.nav-report-icon { background:none; mask:none; -webkit-mask:none; }

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
