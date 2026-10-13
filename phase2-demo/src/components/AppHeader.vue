<template>
  <header class="app-header">
    <div class="header-left">
      <template v-if="detailTitle">
        <BackButton :label="`返回${sectionTitle}`" @click="closeDetail" />
        <span class="header-section-title header-section-title-muted">{{ sectionTitle }}</span>
        <span class="header-chevron" aria-hidden="true">›</span>
        <strong :key="detailTitle" class="header-page-title">{{ detailTitle }}</strong>
      </template>
      <strong v-else class="header-section-title">{{ route.meta.title || '船舶设备检修助手' }}</strong>
    </div>

    <div class="header-right">
      <div class="vessel-status-group">
        <el-popover trigger="click" placement="bottom-end" :width="220" :content="shipInfo.name">
          <template #reference>
            <button class="header-ship-name" type="button" :title="shipInfo.name">{{ shipInfo.name }}</button>
          </template>
        </el-popover>
        <span class="ship-status" :class="'status-' + statusTone">
          <span class="status-dot"></span>
          {{ statusLabel }}
        </span>
      </div>
      <GlobalNotifications />
      <span class="header-time">{{ currentTime }}</span>
    </div>
  </header>
</template>

<script setup>
import {ElPopover} from 'element-plus'
import 'element-plus/es/components/popover/style/css'

import { ref, computed, onMounted, onUnmounted } from 'vue'
import BackButton from './BackButton.vue'
import GlobalNotifications from './GlobalNotifications.vue'
import { shipInfo, statusLabels } from '@/mock/devices'
import { knowledgeDocs } from '@/mock/knowledge'
import { useEventStore } from '@/stores/eventStore'
import { knowledgeViewCache, inspectionViewCache } from '@/stores/viewCache'
import { useRoute, useRouter } from 'vue-router'

const eventStore = useEventStore()
const route = useRoute()
const router = useRouter()
const selectedEvent = computed(() => route.path.startsWith('/phase1-event') && eventStore.isDrawerOpen ? eventStore.selectedEvent : null)
const sectionTitle = computed(() => route.meta.title || '船舶设备检修助手')
const detailTitle = computed(() => {
  if (selectedEvent.value) return selectedEvent.value.title
  if (route.path.startsWith('/inspection')) {
    const reportId = route.query.report || inspectionViewCache.selectedReportId
    if (reportId) return '报告详情'
  }
  if (route.path.startsWith('/knowledge')) {
    const docId = route.query.doc || knowledgeViewCache.selectedDocId
    if (docId) {
      return knowledgeDocs.find(doc => doc.id === docId)?.title || ''
    }
  }
  return ''
})

function closeDetail() {
  if (selectedEvent.value) {
    eventStore.closeDrawer()
    return
  }
  if (route.path.startsWith('/inspection')) {
    inspectionViewCache.selectedReportId = null
    router.replace({ path: route.path })
  }
  if (route.path.startsWith('/knowledge')) {
    knowledgeViewCache.selectedDocId = null
    router.replace({ path: route.path })
  }
}

const currentTime = ref('')

const statusLabel = computed(() => statusLabels[shipInfo.status] || '未知')
const statusTone = computed(() => {
  const status = shipInfo.status
  if (status === 'offline') return 'offline'
  if (status === 'danger') return 'danger'
  if (status === 'warning' || status === 'anchoring' || status === 'docking') return 'warning'
  return 'online'
})

let timer = null

function updateTime() {
  const now = new Date()
  currentTime.value = now.toLocaleTimeString('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  })
}

onMounted(() => {
  updateTime()
  timer = setInterval(updateTime, 1000)
})

onUnmounted(() => {
  if (timer) clearInterval(timer)
})
</script>

<style scoped>
.app-header {
  height: var(--header-height);
  background: #FFFFFF;
  border-bottom: 1px solid #E4E7ED;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 16px;
  flex-shrink: 0;
  box-shadow: none;
  z-index: 10;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  flex: 1;
}

.header-section-title {
  font-size: 16px;
  line-height: 28px;
  font-weight: 700;
  color: #19213D;
}
.header-section-title-muted { color: #9195A2; font-size: 14px; line-height: 24px; font-weight: 400; }

.header-back {
  width: 28px;
  height: 28px;
  flex: 0 0 28px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  border: 1px solid #E4E7ED;
  border-radius: 8px;
  background: #FFFFFF;
  color: #6C7183;
  cursor: pointer;
  transition: border-color 0.16s, color 0.16s, background 0.16s;
}
.header-back svg {
  width: 18px;
  height: 18px;
  fill: none;
  stroke: currentColor;
  stroke-width: 1.8;
  stroke-linecap: round;
  stroke-linejoin: round;
}
.header-back:hover {
  border-color: #BFD4FF;
  background: #F3F7FF;
  color: #106BFF;
}

.header-chevron {
  color: #B5B8C1;
  font-size: 20px;
  line-height: 1;
}

.header-page-title {
  min-width: 0;
  overflow: hidden;
  color: #19213D;
  font-size: 14px;
  line-height: 24px;
  font-weight: 700;
  text-overflow: ellipsis;
  white-space: nowrap;
  animation: header-title-enter 180ms cubic-bezier(0.22, 1, 0.36, 1) both;
}

@keyframes header-title-enter {
  from { opacity: 0; transform: translateX(8px); }
  to { opacity: 1; transform: translateX(0); }
}

@media (prefers-reduced-motion: reduce) {
  .header-page-title { animation: none; }
}

.header-right {
  display: flex;
  align-items: center;
  gap: 16px;
}

.ship-status {
  --status-color: #00A34C;
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 14px;
  line-height: 24px;
  color: var(--status-color);
  white-space: nowrap;
}

.vessel-status-group {
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px 8px;
  border: 0;
  border-radius: 8px;
  background: #F2FAF6;
}

.header-ship-name {
  max-width: 160px;
  min-width: 0;
  padding: 0;
  overflow: hidden;
  border: 0;
  background: transparent;
  color: #19213D;
  font: inherit;
  font-size: 14px;
  line-height: 24px;
  text-overflow: ellipsis;
  white-space: nowrap;
  cursor: pointer;
}
.header-ship-name:hover { color: #106BFF; }
.status-warning { --status-color: #FF8000; }
.status-danger { --status-color: #E52E2E; }
.status-offline { --status-color: #9195A2; }

.status-dot {
  width: 14px;
  height: 14px;
  position: relative;
  border-radius: 50%;
  background: transparent;
}
.status-dot::before {
  content: '';
  position: absolute;
  left: 4px;
  top: 4px;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--status-color);
  opacity: 0;
}
.status-online .status-dot::before { animation: status-breathe 2.2s ease-out infinite; }
.status-dot::after {
  content: '';
  position: absolute;
  left: 4px;
  top: 4px;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--status-color);
}
@keyframes status-breathe {
  0% { opacity: .38; transform: scale(1); }
  70%, 100% { opacity: 0; transform: scale(2.35); }
}

.header-time {
  width: 72px;
  flex: 0 0 72px;
  font-size: 14px;
  line-height: 24px;
  color: #9195A2;
  font-family: "SFMono-Regular", "Roboto Mono", Menlo, Monaco, Consolas, monospace;
  font-variant-numeric: tabular-nums;
  letter-spacing: .15px;
  text-align: right;
}

@media (prefers-reduced-motion: reduce) {
  .status-online .status-dot::before { animation: none; opacity: .25; transform: scale(1.7); }
}

@media (max-width: 760px) {
  .header-right { gap: 8px; }
  .header-ship-name { max-width: 96px; }
  .header-time { display: none; }
}
</style>
