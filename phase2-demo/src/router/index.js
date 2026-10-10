import { createRouter, createWebHashHistory } from 'vue-router'

const routes = [
  { path: '/', redirect: '/situation' },
  {
    path: '/event',
    name: 'EventCenter',
    component: () => import('@/views/TodoCenterView.vue'),
    meta: { title: '待办中心', icon: '📌' }
  },
  {
    path: '/situation/:section(attention)?/:attentionId?',
    name: 'Situation',
    component: () => import('@/views/SituationView.vue'),
    meta: { title: '态势监测', icon: '📡' }
  },
  {
    path: '/phase1-event',
    name: 'Phase1EventCenter',
    component: () => import('@/views/EventCenterView.vue'),
    meta: { title: '一期事件原稿', icon: '📌' }
  },
  {
    path: '/inspection',
    name: 'Inspection',
    component: () => import('@/views/InspectionReportView.vue'),
    meta: { title: '日志中心', icon: '' }
  },
  {
    path: '/knowledge',
    name: 'Knowledge',
    component: () => import('@/views/KnowledgeView.vue'),
    meta: { title: '知识库', icon: '📖' }
  }
]

const router = createRouter({
  history: createWebHashHistory(),
  routes
})

export default router
