<template>
  <div class="event-center">
    <!-- Left: Event List (collapsible) -->
    <div
      class="event-list-wrapper"
      :class="{ collapsed: eventStore.isDrawerOpen }"
    >
      <EventList />
    </div>

    <!-- Center: Product Drawer (shows when event selected) -->
    <transition name="drawer-slide">
      <div v-if="eventStore.isDrawerOpen && eventStore.selectedEvent" class="drawer-wrapper">
        <ProductDrawer
          :event="eventStore.selectedEvent"
          @back="eventStore.closeDrawer()"
        />
      </div>
    </transition>

    <!-- Right: AI Assistant (always visible) -->
    <AssistantPanel
      :mode="assistantMode"
      :event-context="eventStore.selectedEvent"
      @chip-click="handleChipAction"
    />
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useEventStore } from '@/stores/eventStore'
import EventList from './EventList.vue'
import ProductDrawer from './ProductDrawer.vue'
import AssistantPanel from '@/components/AssistantPanel.vue'

const eventStore = useEventStore()

const assistantMode = computed(() => {
  if (eventStore.selectedEvent) return 'event'
  return 'general'
})

function handleChipAction(action) {
  // Forward chip actions to assistant
  const sessionKey = eventStore.selectedEvent?.id || 'general'
  let text = ''
  switch (action) {
    case 'view_causes': text = '查看可能的原因'; break
    case 'start_check': text = '开始排查'; break
    case 'create_order': text = '创建工单'; break
    default: text = action
  }

  eventStore.addMessage(sessionKey, {
    role: 'user',
    content: text
  })

  // Simulate AI response
  setTimeout(() => {
    let response = ''
    if (action === 'view_causes' && eventStore.selectedEvent?.aiAnalysis?.faultTable) {
      const table = eventStore.selectedEvent.aiAnalysis.faultTable
      let html = '<div style="font-size:var(--text-base);line-height:1.7">根据AI诊断，可能原因如下：<br><br>'
      table.forEach((f, i) => {
        const probColor = f.probability === 'high' ? '#FF4D4F' : f.probability === 'medium' ? '#FAAD14' : '#8BAAC0'
        html += `<b>${i + 1}. ${f.name}</b> <span style="color:${probColor}">[${f.probability === 'high' ? '高概率' : f.probability === 'medium' ? '中概率' : '低概率'}]</span><br>`
        html += `<span style="color:#8BAAC0;font-size:var(--text-sm)">${f.detail}</span><br><br>`
      })
      html += '</div>'
      response = html
    } else if (action === 'start_check') {
      response = `
        <div class="action-card">
          <div class="action-title">排查步骤建议</div>
          <div class="action-desc">根据AI分析，建议按以下顺序排查：</div>
          <div style="font-size:var(--text-sm);line-height:1.7;color:#8BAAC0;margin:6px 0">
            1️⃣ 检查相关设备运行参数<br>
            2️⃣ 对比历史数据判断趋势<br>
            3️⃣ 按照SOP执行排查步骤<br>
            4️⃣ 记录排查结果
          </div>
          <div class="action-buttons">
            <button class="btn-primary">开始排查</button>
            <button class="btn-ghost">查看SOP</button>
          </div>
        </div>
      `
    } else if (action === 'create_order') {
      response = `
        <div class="action-card">
          <div class="action-title">创建工单确认</div>
          <div class="action-desc">系统将根据当前事件数据自动生成维修工单。</div>
          <div class="action-buttons">
            <button class="btn-primary">确认创建</button>
            <button class="btn-danger">标记误报</button>
          </div>
        </div>
      `
    } else {
      response = '已收到请求，正在处理...'
    }

    eventStore.addMessage(sessionKey, {
      role: 'assistant',
      content: response
    })
  }, 500)
}
</script>

<style scoped>
.event-center {
  flex: 1;
  display: flex;
  height: 100%;
  overflow: hidden;
}

.event-list-wrapper {
  transition: all 0.3s ease;
  overflow: hidden;
  flex-shrink: 0;
}

.event-list-wrapper.collapsed {
  width: 0;
  min-width: 0;
  opacity: 0;
  border-right: none;
}

.drawer-wrapper {
  flex: 1;
  min-width: 0;
  overflow: hidden;
}

/* Drawer slide transition */
.drawer-slide-enter-active,
.drawer-slide-leave-active {
  transition: all 0.3s ease;
}
.drawer-slide-enter-from {
  opacity: 0;
  transform: translateX(-30px);
}
.drawer-slide-leave-to {
  opacity: 0;
  transform: translateX(-30px);
}
</style>
