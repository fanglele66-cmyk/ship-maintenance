import content from '../page-content/maintenance.json' with { type: 'json' }
import { maintenancePlans } from './phase2Scenarios.js'
import { maintenanceFollowup } from './phase2Followup.js'

export function maintenanceStatus(store) {
  if (store.isTaskHandled('drift')) return '已处理 · ' + (store.getObservationResult('drift').type === 'archive' ? '观察已结束' : '态势观察中')
  if (store.todoCreated.drift) {
    const stage = store.cases.drift.stages[store.progress.drift].label
    return stage === '完整闭环' ? '已闭环' : '已关联待办 · ' + stage
  }
  return '待确认建议'
}

// Read-only presentation adapter. Configuration cannot invoke store actions.
export function maintenanceDossier(store, planned = false) {
  const plan = maintenancePlans[0], linked = Boolean(store.todoCreated.drift)
  const conditions = { planned, linked: !planned && linked, handled: !planned && store.isTaskHandled('drift') }
  const report = maintenanceFollowup(store, planned)
  return {
    id: planned ? 'planned' : 'drift',
    report: {
      ...report,
      title: planned ? plan.title : store.attention.find(item => item.id === 'maintenance').title,
      status: planned ? '常规计划' : maintenanceStatus(store),
      tone: planned ? 'ai' : linked ? 'transferred' : 'human',
      meta: `${plan.device} · 正式周期 ${(plan.currentHours??'未取得')} / ${(plan.dueHours??'未取得')}`,
      detailTabs: content.tabs
    },
    actions: content.actions.filter(action => conditions[action.when]).map(action => ({
      id: action.id,
      label: action.id === 'todo' ? `${action.label} · ${store.cases.drift.stages[store.progress.drift].label}` : action.label
    }))
  }
}
