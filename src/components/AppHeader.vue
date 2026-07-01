<template>
  <header class="app-header">
    <!-- 左侧：船名 + 导航Tab -->
    <div class="header-left">
      <div class="ship-brand">
        <Icon icon="mdi:ferry" class="brand-icon" />
        <div class="brand-text">
          <span class="ship-name">{{ shipStore.shipDisplayName }}</span>
          <span class="ship-sub">{{ shipStore.info.shipType }}</span>
        </div>
      </div>
      <nav class="nav-tabs">
        <router-link
          v-for="item in navItems"
          :key="item.path"
          :to="item.path"
          class="nav-tab"
          :class="{ active: isNavActive(item.path) }"
        >
          <Icon :icon="item.icon" />
          <span>{{ item.label }}</span>
        </router-link>
      </nav>
    </div>

    <!-- 中间：时钟 -->
    <div class="header-center">
      <div class="clock font-mono-num">{{ timeStr }}</div>
      <div class="date">{{ dateStr }}</div>
    </div>

    <!-- 右侧：快速入口 + 异常上报 -->
    <div class="header-right">
      <NetworkIndicator />

      <button class="quick-entry" @click="emit('knowledge')" title="知识库">
        <Icon icon="mdi:bookshelf" />
        <span class="qe-label">知识库</span>
      </button>

      <button class="quick-entry" @click="emit('assistant')" title="助手">
        <Icon icon="mdi:robot" />
        <span class="qe-label">助手</span>
      </button>

      <button class="quick-entry notif" @click="toggleNotif" title="通知">
        <Icon icon="mdi:bell-outline" />
        <span v-if="shipStore.unreadCount" class="badge">{{ shipStore.unreadCount }}</span>
      </button>

      <!-- 通知下拉 -->
      <transition name="fade">
        <div v-if="notifOpen" class="notif-panel industrial-card">
          <div class="notif-head">
            <span>通知中心</span>
            <button class="link-btn" @click="shipStore.markAllRead">全部已读</button>
          </div>
          <div class="notif-list">
            <div
              v-for="n in shipStore.notificationList"
              :key="n.id"
              class="notif-item"
              :class="{ unread: !n.read }"
              @click="onNotifClick(n)"
            >
              <span class="notif-dot" :style="{ background: notifColor(n.type) }"></span>
              <div class="notif-body">
                <div class="notif-title">{{ n.title }}</div>
                <div class="notif-time">{{ n.time }}</div>
              </div>
              <span class="notif-kind">{{ n.kind === 'new' ? '新事件' : '状态变更' }}</span>
            </div>
          </div>
        </div>
      </transition>

      <button class="btn-control btn-danger report-btn" @click="emit('report')">
        <Icon icon="mdi:alert-plus" />
        异常上报
      </button>
    </div>
  </header>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Icon } from '@iconify/vue'
import { useShipStore } from '@/stores/shipStore'
import { useRepairStore } from '@/stores/repairStore'
import NetworkIndicator from './NetworkIndicator.vue'

const emit = defineEmits(['report', 'knowledge', 'assistant'])
const shipStore = useShipStore()
const repairStore = useRepairStore()
const route = useRoute()
const router = useRouter()

const navItems = [
  { path: '/',        label: '首页',     icon: 'mdi:view-dashboard' },
  { path: '/monitor', label: '监控中心', icon: 'mdi:gauge' },
  { path: '/repair',  label: '检修中心', icon: 'mdi:wrench' }
]

function isNavActive(path) {
  if (path === '/repair') return route.path.startsWith('/repair')
  return route.path === path
}

const notifOpen = ref(false)
function toggleNotif() { notifOpen.value = !notifOpen.value }

function notifColor(type) {
  return { danger: '#FF4D4F', warning: '#FAAD14', info: '#1890FF', success: '#52C41A' }[type] || '#1890FF'
}

function onNotifClick(n) {
  notifOpen.value = false
  // 根据通知类型决定跳转目标
  if (n.eventId) {
    // 新事件 / 状态变更 → 跳转到检修中心并选中对应事件
    repairStore.selectEvent(n.eventId)
    router.push({ path: '/repair', query: { eventId: n.eventId } })
  } else {
    // 无关联事件的通知（如系统公告），暂不处理
    console.log('通知无关联事件:', n)
  }
}

// 时钟
const timeStr = computed(() => {
  const d = shipStore.systemTime
  const p = n => String(n).padStart(2, '0')
  return `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`
})
const dateStr = computed(() => {
  const d = shipStore.systemTime
  const p = n => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}` + ' ' + shipStore.navStatusLabel
})

// 点击外部关闭通知
function onDocClick(e) {
  if (notifOpen.value && !e.target.closest('.notif') && !e.target.closest('.notif-panel')) {
    notifOpen.value = false
  }
}
onMounted(() => document.addEventListener('click', onDocClick))
onUnmounted(() => document.removeEventListener('click', onDocClick))
</script>

<style scoped>
.app-header {
  height: 56px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 20px;
  background: linear-gradient(180deg, #0F2238 0%, #0A1828 100%);
  border-bottom: 1px solid var(--border-color);
  position: relative;
  z-index: 50;
}
.header-left { display: flex; align-items: center; gap: 24px; }
.ship-brand { display: flex; align-items: center; gap: 10px; }
.brand-icon { font-size: 26px; color: var(--accent-primary); }
.brand-text { display: flex; flex-direction: column; line-height: 1.2; }
.ship-name { font-size: 15px; font-weight: 700; color: var(--text-primary); }
.ship-sub { font-size: 11px; color: var(--text-muted); }

.nav-tabs { display: flex; gap: 4px; }
.nav-tab {
  display: flex; align-items: center; gap: 6px;
  padding: 8px 16px; border-radius: 6px;
  color: var(--text-secondary); font-size: 14px; font-weight: 600;
  text-decoration: none; transition: all 0.15s; cursor: pointer;
}
.nav-tab svg { font-size: 18px; }
.nav-tab:hover { background: var(--bg-tertiary); color: var(--text-primary); }
.nav-tab.active {
  background: linear-gradient(180deg, rgba(24,144,255,0.18), rgba(24,144,255,0.08));
  color: var(--accent-primary);
  box-shadow: inset 0 -2px 0 var(--accent-primary);
}

.header-center { text-align: center; }
.clock { font-size: 20px; font-weight: 700; color: var(--accent-primary); letter-spacing: 1px; }
.date { font-size: 11px; color: var(--text-muted); }

.header-right { display: flex; align-items: center; gap: 8px; position: relative; }
.quick-entry {
  display: flex; align-items: center; gap: 5px;
  padding: 7px 12px; border-radius: 6px; border: 1px solid transparent;
  background: transparent; color: var(--text-secondary); cursor: pointer;
  font-size: 13px; font-weight: 600; transition: all 0.15s; position: relative;
}
.quick-entry svg { font-size: 18px; }
.quick-entry:hover { background: var(--bg-tertiary); color: var(--text-primary); border-color: var(--border-color); }
.qe-label { white-space: nowrap; }
.notif .badge {
  position: absolute; top: 2px; right: 2px;
  min-width: 16px; height: 16px; padding: 0 4px;
  background: var(--color-danger); color: #fff;
  border-radius: 8px; font-size: 10px; font-weight: 700;
  display: flex; align-items: center; justify-content: center;
  border: 1px solid #0A1828;
}
.report-btn { margin-left: 6px; }

.notif-panel {
  position: absolute; top: 50px; right: 0;
  width: 360px; max-height: 420px; display: flex; flex-direction: column;
  z-index: 60;
}
.notif-head {
  display: flex; justify-content: space-between; align-items: center;
  padding: 12px 16px; border-bottom: 1px solid var(--border-color);
  font-weight: 700; font-size: 14px;
}
.link-btn { background: none; border: none; color: var(--accent-primary); cursor: pointer; font-size: 12px; }
.notif-list { overflow-y: auto; flex: 1; }
.notif-item {
  display: flex; align-items: flex-start; gap: 10px;
  padding: 12px 16px; border-bottom: 1px solid var(--border-color); cursor: pointer;
}
.notif-item:hover { background: var(--bg-tertiary); }
.notif-item.unread { background: rgba(24,144,255,0.05); }
.notif-dot { width: 8px; height: 8px; border-radius: 50%; margin-top: 5px; flex-shrink: 0; }
.notif-body { flex: 1; min-width: 0; }
.notif-title { font-size: 13px; color: var(--text-primary); line-height: 1.4; }
.notif-time { font-size: 11px; color: var(--text-muted); margin-top: 3px; }
.notif-kind { font-size: 10px; color: var(--text-muted); white-space: nowrap; padding: 2px 6px; border: 1px solid var(--border-color); border-radius: 3px; }

/* ====== 事件详情模态框（截图对齐）====== */
.ed-fade-enter-active, .ed-fade-leave-active { transition: opacity 0.25s ease; }
.ed-fade-enter-from, .ed-fade-leave-to { opacity: 0; }

.ed-overlay {
  position: fixed; inset: 0; z-index: 9999;
  background: rgba(0,0,0,0.65);
  display: flex; align-items: center; justify-content: center;
  padding: 20px;
  backdrop-filter: blur(4px);
}
.ed-modal {
  width: 100%; max-width: 960px; max-height: 85vh;
  background: #0B1629;
  border: 1px solid #1E3A5F;
  border-radius: 12px;
  display: flex; flex-direction: column;
  overflow: hidden;
  box-shadow: 0 24px 80px rgba(0,0,0,0.5);
}

/* 标题栏 */
.ed-header {
  display: flex; align-items: flex-start; justify-content: space-between;
  padding: 16px 20px 12px;
  border-bottom: 1px solid #1E3A5F;
}
.ed-title-row { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
.ed-title { font-size: 16px; font-weight: 700; color: #E8F0FF; margin: 0; }
.ed-sub { font-size: 11px; color: #5A7A92; font-weight: 400; }
.ed-tags { display: flex; gap: 6px; }
.ed-tag {
  font-size: 10px; font-weight: 700; padding: 2px 10px; border-radius: 10px;
  white-space: nowrap;
}
.p-high { background: rgba(255,77,79,0.15); color: #FF4D4F; }
.p-medium { background: rgba(250,173,20,0.15); color: #FAAD14; }
.p-low { background: rgba(24,144,255,0.15); color: #1890FF; }
.ed-tag-status { background: rgba(82,196,26,0.12); color: #52C41A; }
.ed-close {
  background: none; border: none; color: #5A7A92; cursor: pointer;
  font-size: 20px; padding: 2px; border-radius: 4px; transition: all 0.15s;
  flex-shrink: 0; margin-top: 2px;
}
.ed-close:hover { color: #E8F0FF; background: rgba(255,255,255,0.06); }

/* 描述 */
.ed-desc { padding: 8px 20px 0; font-size: 12px; color: #7A95AC; line-height: 1.6; }

/* Tab 切换 */
.ed-tabs {
  display: flex; gap: 6px; padding: 12px 20px 0;
  border-bottom: 1px solid #1E3A5F;
}
.ed-tab {
  display: flex; align-items: center; gap: 5px;
  padding: 7px 16px; border-radius: 20px;
  background: transparent; border: 1px solid transparent;
  color: #5A7A92; font-size: 12px; font-weight: 600; cursor: pointer;
  transition: all 0.15s; white-space: nowrap;
}
.ed-tab svg { font-size: 15px; }
.ed-tab:hover { color: #B0C4DE; background: rgba(255,255,255,0.03); }
.ed-tab.active {
  background: linear-gradient(135deg, rgba(24,144,255,0.15), rgba(24,144,255,0.05));
  border-color: rgba(24,144,255,0.3);
  color: #69B1FF;
}

/* 内容区 */
.ed-body { flex: 1; overflow-y: auto; padding: 16px 20px 20px; }
.ed-body::-webkit-scrollbar { width: 5px; }
.ed-body::-webkit-scrollbar-thumb { background: #1E3A5F; border-radius: 4px; }

.ed-tab-content { animation: edIn 0.2s ease; }
@keyframes edIn { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: none; } }

/* ---- AI分析：判定结果框 ---- */
.ed-verdict-box {
  background: rgba(250,173,20,0.04);
  border-left: 3px solid #FAAD14;
  border-radius: 0 8px 8px 0;
  padding: 14px 16px; margin-bottom: 18px;
}
.evb-label { font-size: 13px; font-weight: 700; color: #FAAD14; margin-bottom: 8px; display: flex; align-items: center; gap: 6px; }
.evb-label::before { content: '🔍'; font-size: 14px; }
.evb-main { display: flex; align-items: center; gap: 12px; margin-bottom: 10px; }
.evb-verdict { font-size: 15px; font-weight: 700; color: #E8F0FF; }
.evb-confidence { font-size: 12px; color: #FAAD14; font-weight: 600; background: rgba(250,173,20,0.1); padding: 2px 10px; border-radius: 10px; }
.evb-detail { font-size: 12px; color: #94A3B8; line-height: 1.8; }
.evb-detail strong { color: #D0E0F0; }
.evb-detail :deep(strong) { color: #D0E0F0; }

/* ---- 排查建议 / 可疑特征 ---- */
.ed-section { margin-bottom: 18px; }
.es-title { font-size: 13px; font-weight: 700; color: #E0ECF8; margin-bottom: 8px; }
.es-list { margin: 0; padding-left: 20px; }
.es-list li { font-size: 12px; color: #B0C4DE; line-height: 1.85; padding: 1px 0; }
.es-plain-list { list-style: none; padding: 0; margin: 0; }
.es-plain-list li {
  font-size: 12px; color: #B0C4DE; line-height: 1.75;
  padding: 5px 0; border-bottom: 1px solid rgba(30,58,95,0.4);
  position: relative; padding-right: 60px;
}
.es-plain-list li b { color: #E0ECF8; }
.es-prob {
  position: absolute; right: 0; top: 5px;
  font-size: 10px; font-weight: 700; padding: 1px 8px; border-radius: 8px;
}
.prob-high { color: #FF4D4F; background: rgba(255,77,79,0.1); }
.prob-medium { color: #FAAD14; background: rgba(250,173,20,0.1); }
.prob-low { color: #52C41A; background: rgba(82,196,26,0.1); }

/* ---- 数据诊断卡片网格 ---- */
.ed-grid-cards { display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; }
.ed-data-card {
  background: #080F1A; border: 1px solid #162940; border-radius: 8px;
  padding: 12px 14px; display: flex; flex-direction: column; gap: 6px;
}
.edc-head { display: flex; justify-content: space-between; align-items: baseline; }
.edc-name { font-size: 12px; font-weight: 700; color: #E0ECF8; }
.edc-meta { font-size: 10px; color: #5A7A92; }
.edc-value { font-size: 11.5px; color: #94A3B8; line-height: 1.65; }
.edc-value :deep(strong) { color: #E0ECF8; }
.edc-verdict { font-size: 11px; font-weight: 600; margin-top: auto; padding-top: 6px; border-top: 1px solid #162940; }
.v-danger { color: #FF4D4F; }
.v-warning { color: #FAAD14; }
.v-normal { color: #52C41A; }

/* ---- 排查方案网格 ---- */
.ed-plan-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; }
.ep-card {
  background: #080F1A; border: 1px solid #162940; border-radius: 8px;
  padding: 14px 16px; display: flex; flex-direction: column; gap: 6px;
}
.ep-title { font-size: 12.5px; font-weight: 700; color: #69B1FF; }
.ep-text { font-size: 11.5px; color: #94A3B8; line-height: 1.7; }

/* ---- 事件日志时间线 ---- */
.ed-timeline { position: relative; padding-left: 24px; }
.ed-timeline::before {
  content: ''; position: absolute; left: 7px; top: 8px; bottom: 8px;
  width: 2px; background: #1E3A5F; border-radius: 1px;
}
.et-node { position: relative; padding-bottom: 18px; }
.et-node:last-child { padding-bottom: 0; }
.et-dot {
  position: absolute; left: -21px; top: 4px; z-index: 1;
  width: 12px; height: 12px; border-radius: 50%; border: 2px solid #0B1629;
}
.dot-确认 { background: #1890FF; }
.dot-排查 { background: #FAAD14; }
.dot-维修 { background: #FF7849; }
.dot-归档 { background: #52C41A; }
.et-head { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; margin-bottom: 4px; }
.et-stage { font-size: 10px; font-weight: 700; padding: 1px 8px; border-radius: 8px; background: rgba(24,144,255,0.1); color: #69B1FF; }
.et-time { font-size: 10px; color: #5A7A92; }
.et-title { font-size: 12px; font-weight: 600; color: #D0E0F0; }
.et-op { font-size: 10px; color: #69B1FF; background: rgba(24,144,255,0.06); padding: 1px 8px; border-radius: 8px; }
.et-desc { font-size: 11.5px; color: #8BAAC0; line-height: 1.7; padding-left: 4px; }

/* 空状态 */
.ed-empty { text-align: center; padding: 40px 0; color: #5A7A92; font-size: 13px; }
</style>
