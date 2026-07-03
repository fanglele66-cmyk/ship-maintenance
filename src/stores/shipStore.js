import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { shipInfo, notifications } from '@/mock'

/**
 * 船舶信息状态
 * - 船舶基础信息（含航行状态、位置、航速航向）
 * - 网络状态（船端离线保障核心）
 * - 通知管理
 * - 系统时间
 */
export const useShipStore = defineStore('ship', () => {
  // ============ State ============
  const info = ref({
    ...shipInfo,
    shipName: '远洋6号',
    healthScore: 82
  })
  // 网络状态：online / offline
  const networkStatus = ref('online')
  // 上次同步时间
  const lastSyncAt = ref('2026-06-26 12:00:08')
  // 离线模式下待同步事件数
  const pendingSyncCount = ref(0)
  // 系统时间
  const systemTime = ref(new Date())
  // 通知列表
  const notificationList = ref(JSON.parse(JSON.stringify(notifications)))

  // ============ Getters ============
  const isOnline = computed(() => networkStatus.value === 'online')
  const shipDisplayName = computed(() => `${info.value.shipName}`)

  // 航行状态标签
  const navStatusLabel = computed(() => {
    const map = { sailing: '航行中', docking: '靠港停泊' }
    return map[info.value.navStatus] || '未知'
  })

  // 未读通知数
  const unreadCount = computed(() =>
    notificationList.value.filter(n => !n.read).length
  )

  // ============ Actions ============
  /** 切换网络状态（模拟船端网络波动） */
  function toggleNetwork() {
    networkStatus.value = networkStatus.value === 'online' ? 'offline' : 'online'
    if (networkStatus.value === 'online') {
      lastSyncAt.value = formatTime(new Date())
      pendingSyncCount.value = 0
    }
  }

  /** 模拟离线时产生待同步事件 */
  function addPendingSync() {
    if (!isOnline.value) {
      pendingSyncCount.value++
    }
  }

  /** 更新系统时间（定时调用） */
  function tickTime() {
    systemTime.value = new Date()
  }

  /** 标记所有通知已读 */
  function markAllRead() {
    notificationList.value.forEach(n => { n.read = true })
  }

  /** 添加通知 */
  function addNotification(notif) {
    notificationList.value.unshift({
      id: `N-${String(notificationList.value.length + 1).padStart(3, '0')}`,
      time: formatTime(new Date()),
      read: false,
      ...notif
    })
  }

  function formatTime(d) {
    const pad = n => String(n).padStart(2, '0')
    return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
  }

  return {
    info,
    networkStatus,
    lastSyncAt,
    pendingSyncCount,
    systemTime,
    notificationList,
    isOnline,
    shipDisplayName,
    navStatusLabel,
    unreadCount,
    toggleNetwork,
    addPendingSync,
    tickTime,
    markAllRead,
    addNotification,
    formatTime
  }
})
