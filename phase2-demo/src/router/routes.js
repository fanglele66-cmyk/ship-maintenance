export const routes = [
  { path: '/', redirect: '/situation' },
  {path:'/real-cases',redirect:'/situation'},
  {path:'/reports/:reportId?',name:'LifecycleReport',component:()=>import('@/views/LifecycleReportView.vue'),meta:{title:'报告'}},
  {path:'/situation/todos',name:'SituationTodos',component:()=>import('@/views/LifecycleTodoView.vue'),meta:{title:'态势 · 个人待办',crossBusiness:true}},
  {path:'/issues',name:'SituationIssues',component:()=>import('@/views/LifecycleListView.vue'),meta:{title:'事件中心'}},
  {path:'/tasks/:taskId',name:'LifecycleTask',component:()=>import('@/views/LifecycleTaskView.vue'),meta:{title:'任务详情'}},
  {path:'/situation/issue/warning-history',redirect:'/issues'},
  {path:'/situation/issue/:attentionId(real-alarm-0430|real-warning-0523|real-tracking-exhaust-baseline|real-health-c4-baseline|manual-.*|detected-.*|real-.*-observation-.*)',name:'EventLifecycle',component:()=>import('@/views/EventLifecycleView.vue'),meta:{title:'事件中心'}},
  {path:'/situation/issues',redirect:to=>({path:'/issues',query:to.query,hash:to.hash})},
  {
    path: '/event',
    name: 'EventCenter',
    component: () => import('@/views/LifecycleTodoView.vue'),
    meta: { title: '我的任务', icon: '📌' }
  },
  {
    path: '/situation/:section(attention|maintenance|issue)?/:attentionId?',
    name: 'Situation',
    component: () => import('@/views/SituationView.vue'),
    meta: { title: '态势', icon: '📡' }
  },
  {
    path: '/knowledge',
    name: 'Knowledge',
    component: () => import('@/views/KnowledgeView.vue'),
    meta: { title: '知识库', icon: '📖' }
  },
  {
    path: '/ship-config',
    name: 'ShipConfig',
    component: () => import('@/components/config/ShipConfigConsole.vue'),
    meta: { title: '本船配置', requiresAdmin: true }
  }
]
