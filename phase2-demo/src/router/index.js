import { createRouter, createWebHashHistory } from 'vue-router'
import {canonicalIssueRoute} from '@/mock/issueRelationships'

import {routes} from './routes.js'

const router = createRouter({
  history: createWebHashHistory(),
  routes
})
router.beforeEach(to => canonicalIssueRoute(to) || true)

export default router
