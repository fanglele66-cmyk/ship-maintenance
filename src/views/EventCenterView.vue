<template>
  <div class="event-center">
    <!-- Left: Event List -->
    <div class="event-list-wrapper" :class="{ collapsed: eventStore.isDrawerOpen }">
      <EventList />
    </div>

    <!-- Center: Product Drawer (always in DOM for transition, width controlled by CSS) -->
    <div
      class="drawer-wrapper"
      :class="{ 'drawer-has-content': eventStore.isDrawerOpen && eventStore.selectedEvent }"
    >
      <transition name="drawer-slide" mode="out-in">
        <ProductDrawer
          v-if="eventStore.isDrawerOpen && eventStore.selectedEvent"
          :event="eventStore.selectedEvent"
          @back="eventStore.closeDrawer()"
        />
      </transition>
    </div>

    <!-- Right: AI Assistant（直接放 flex 容器，和态势页一致） -->
    <AssistantPanel
      :mode="assistantMode"
      :event-context="eventStore.selectedEvent"
      :fill-remaining="true"
      :class="{ 'panel-compact': eventStore.isDrawerOpen && eventStore.selectedEvent }"
      @chip-click="handleChipAction"
    />
  </div>
</template>

<script setup>
import { computed, reactive, provide } from 'vue'
import { useEventStore } from '@/stores/eventStore'
import EventList from './EventList.vue'
import ProductDrawer from './ProductDrawer.vue'
import AssistantPanel from '@/components/AssistantPanel.vue'

const eventStore = useEventStore()

// ============ 共享状态（兄弟组件 ProductDrawer & AssistantPanel 都从这里 inject）============
const eventUnread = eventStore.eventUnread
const eventStage = reactive({})
const eventAssistantAction = reactive({})
const totalUnread = computed(() => Object.values(eventUnread).reduce((a, b) => a + b, 0))

provide('eventUnread', eventUnread)
provide('totalUnread', totalUnread)
provide('eventStage', eventStage)
provide('eventAssistantAction', eventAssistantAction)

// 初始化未读计数：有 AI 分析的事件 = 2 条未读
eventStore.events.forEach(ev => {
  if (ev.aiAnalysis?.summary && ev.status !== 'resolved') {
    eventStore.eventUnread[ev.id] = 2
  }
})

const assistantMode = computed(() => eventStore.selectedEvent ? 'event' : 'general')

function handleChipAction(action) {
  const sessionKey = eventStore.selectedEvent?.id || 'general'
  let text = ''
  switch (action) {
    case 'view_causes': text = '查看可能的原因'; break
    case 'start_check': text = '开始排查'; break
    case 'create_order': text = '创建工单'; break
    default: text = action
  }
  eventStore.addMessage(sessionKey, { role: 'user', content: text })
  setTimeout(() => {
    let response = ''
    if (action === 'view_causes' && eventStore.selectedEvent?.aiAnalysis?.faultTable) {
      const table = eventStore.selectedEvent.aiAnalysis.faultTable
      let html = '<div style="font-size:var(--font-md);line-height:1.7">根据AI诊断，可能原因如下：<br><br>'
      table.forEach((f, i) => {
        const probColor = f.probability === 'high' ? 'var(--danger)' : f.probability === 'medium' ? 'var(--warning)' : 'var(--text-muted)'
        html += `<b>${i + 1}. ${f.name}</b> <span style="color:${probColor}">[${f.probability === 'high' ? '高概率' : f.probability === 'medium' ? '中概率' : '低概率'}]</span><br>`
        html += `<span style="color:var(--text-muted);font-size:var(--font-base)">${f.detail}</span><br><br>`
      })
      response = html + '</div>'
    } else if (action === 'start_check') {
      response = `<div class="action-card"><div class="action-title">排查步骤建议</div><div class="action-desc">根据AI分析，建议按以下顺序排查：</div>
        <div style="font-size:var(--font-base);line-height:1.7;color:var(--text-muted);margin:6px 0">1️⃣ 检查相关设备运行参数<br>2️⃣ 对比历史数据判断趋势<br>3️⃣ 按照SOP执行排查步骤<br>4️⃣ 记录排查结果</div>
        <div class="action-buttons"><button class="btn-primary">开始排查</button><button class="btn-ghost">查看SOP</button></div></div>`
    } else if (action === 'create_order') {
      response = `<div class="action-card"><div class="action-title">创建工单确认</div><div class="action-desc">系统将根据当前事件数据自动生成维修工单。</div>
        <div class="action-buttons"><button class="btn-primary">确认创建</button><button class="btn-danger">标记误报</button></div></div>`
    } else {
      response = '已收到请求，正在处理...'
    }
    eventStore.addMessage(sessionKey, { role: 'assistant', content: response })
  }, 500)
}
</script>

<style scoped>
.event-center { flex: 1; display: flex; height: 100%; overflow: hidden; }
.event-list-wrapper {
  width: var(--event-list-width);
  min-width: var(--event-list-width);
  transition: all 0.3s ease;
  overflow: hidden;
  flex-shrink: 0;
}
.event-list-wrapper.collapsed { width: 0; min-width: 0; opacity: 0; border-right: none; }

/* 中间产物区：有内容时 flex:1 占空间，无内容时收缩到 0（助手区 fill 填充剩余） */
.drawer-wrapper {
  width: 0;
  min-width: 0;
  flex-shrink: 0;
  overflow: hidden;
  transition: all 0.3s ease;
}
.drawer-wrapper.drawer-has-content {
  flex: 1 1 0;
  min-width: 0;
}

.drawer-slide-enter-active, .drawer-slide-leave-active { transition: all 0.3s ease; }
.drawer-slide-enter-from { opacity: 0; transform: translateX(-30px); }
.drawer-slide-leave-to { opacity: 0; transform: translateX(-30px); }

/* 助手区 compact 态（事件打开时固定宽度，给产物区更多空间） */
.panel-compact {
  flex: 0 0 500px !important;
  min-width: 500px !important;
  max-width: 500px !important;
}

/* iPad 横屏：助手区收紧到 420px */
@media (max-width: 1366px) {
  .panel-compact {
    flex: 0 0 420px !important;
    min-width: 420px !important;
    max-width: 420px !important;
  }
}

/* iPad 竖屏：助手区改为 flex 自适应，不再固定宽度 */
@media (max-width: 1024px) {
  .panel-compact {
    flex: 1 1 320px !important;
    min-width: 300px !important;
    max-width: none !important;
  }
}
</style>
