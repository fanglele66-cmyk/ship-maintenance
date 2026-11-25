import { createRouter, createWebHashHistory } from 'vue-router'
import {canonicalIssueRoute} from '@/mock/issueRelationships'
import {auth, loadAccount} from '@/services/auth'

import {routes} from './routes.js'

const router = createRouter({
  history: createWebHashHistory(),
  routes
})
router.beforeEach(async to => {
  if (to.meta.requiresAdmin) {
    if (!auth.ready) await loadAccount()
    if (auth.user?.role !== 'admin') return {path: '/situation', replace: true}
  }
  return canonicalIssueRoute(to) || true
})

export default router
