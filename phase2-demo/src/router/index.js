import { createRouter, createWebHashHistory } from 'vue-router'
import {canonicalIssueRoute} from '@/mock/issueRelationships'

const routes = [
  { path: '/', redirect: '/situation' },
  {path:'/real-cases',redirect:'/situation'},
  {path:'/reports/:reportId?',name:'LifecycleReport',component:()=>import('@/views/LifecycleReportView.vue'),meta:{title:'报告'}},
  {path:'/issues',name:'SituationIssues',component:()=>import('@/views/LifecycleListView.vue'),meta:{title:'事件中心'}},
  {path:'/tasks/:taskId',name:'LifecycleTask',component:()=>import('@/views/LifecycleTaskView.vue'),meta:{title:'任务详情'}},
  {path:'/situation/issue/warning-history',redirect:'/issues'},
  {path:'/situation/issue/:attentionId(real-alarm-0430|real-warning-0523|real-tracking-exhaust-baseline|real-health-c4-baseline)',name:'EventLifecycle',component:()=>import('@/views/EventLifecycleView.vue'),meta:{title:'事件中心'}},
  {path:'/situation/issues',redirect:to=>({path:'/issues',query:to.query,hash:to.hash})},
  {
    path: '/event',
    name: 'EventCenter',
    component: () => import('@/views/LifecycleTodoView.vue'),
    meta: { title: '待办中心', icon: '📌' }
  },
  {
    path: '/situation/:section(attention|maintenance|issue)?/:attentionId?',
    name: 'Situation',
    component: () => import('@/views/SituationView.vue'),
    meta: { title: '首页', icon: '📡' }
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
router.beforeEach(to => canonicalIssueRoute(to) || true)

export default router
