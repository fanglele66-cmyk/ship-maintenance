import { createRouter, createWebHashHistory } from 'vue-router'

const routes = [
  { path: '/', redirect: '/event' },
  {
    path: '/event',
    name: 'EventCenter',
    component: () => import('@/views/EventCenterView.vue'),
    meta: { title: '事件中心', icon: '📌' }
  },
  {
    path: '/situation',
    name: 'Situation',
    component: () => import('@/views/SituationView.vue'),
    meta: { title: '态势感知', icon: '📡' }
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
