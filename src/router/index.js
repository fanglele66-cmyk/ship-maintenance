import { createRouter, createWebHashHistory } from 'vue-router'

// 路由 - 对齐文档导航架构
// 导航栏模块：首页 | 监控中心 | 检修中心
// 快速入口：通知 | 知识库 | 助手（助手为悬浮面板，非路由）
const routes = [
  {
    path: '/',
    name: 'home',
    component: () => import('@/views/HomeView.vue'),
    meta: { title: '首页总览', icon: 'mdi:view-dashboard' }
  },
  {
    path: '/monitor',
    name: 'monitor',
    component: () => import('@/views/MonitorView.vue'),
    meta: { title: '监控中心', icon: 'mdi:gauge' }
  },
  {
    path: '/repair',
    name: 'repair',
    component: () => import('@/views/RepairView.vue'),
    meta: { title: '检修中心', icon: 'mdi:wrench' }
  },
  {
    path: '/knowledge',
    name: 'knowledge',
    component: () => import('@/views/KnowledgeView.vue'),
    meta: { title: '知识库', icon: 'mdi:bookshelf' }
  },
  {
    path: '/report/:id',
    name: 'report-detail',
    component: () => import('@/views/InspectionReportDetail.vue'),
    meta: { title: '机舱巡检日检报告', icon: 'mdi:clipboard-text' }
  }
]

const router = createRouter({
  history: createWebHashHistory(),
  routes
})

router.afterEach((to) => {
  document.title = to.meta.title ? `${to.meta.title} · 船舶设备检修助手` : '船舶设备检修助手'
})

export default router
