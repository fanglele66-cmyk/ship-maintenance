import { createRouter, createWebHashHistory } from 'vue-router'

// V2.0 路由 - 事件驱动架构
// 导航栏：事件中心 | 态势感知 | 知识库
const routes = [
  {
    path: '/',
    redirect: '/event'
  },
  {
    path: '/event',
    name: 'event',
    component: () => import('@/views/EventCenterView.vue'),
    meta: { title: '事件中心', icon: 'mdi:bell-ring' }
  },
  {
    path: '/situation',
    name: 'situation',
    component: () => import('@/views/SituationView.vue'),
    meta: { title: '态势感知', icon: 'mdi:radar' }
  },
  {
    path: '/knowledge',
    name: 'knowledge',
    component: () => import('@/views/KnowledgeView.vue'),
    meta: { title: '知识库', icon: 'mdi:bookshelf' }
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
