import content from '../page-content/maintenance.json' with { type: 'json' }
import { maintenancePlans } from './phase2Scenarios.js'
import { maintenanceFollowup } from './phase2Followup.js'

export function maintenanceStatus(store) {
  if (store.isTaskHandled('maintenance')) return '已处理 · ' + (store.getObservationResult('maintenance').type === 'archive' ? '观察已结束' : '态势观察中')
  if (store.todoCreated.maintenance) {
    const stage = store.cases.maintenance.stages[store.progress.maintenance].label
    return stage === '完整闭环' ? '已闭环' : '已关联待办 · ' + stage
  }
  return '待确认建议'
}

// Read-only presentation adapter. Configuration cannot invoke store actions.
export function maintenanceDossier(store, planned = false) {
  const plan = maintenancePlans[0], linked = Boolean(store.todoCreated.maintenance)
  const conditions = { planned, linked: !planned && linked, handled: !planned && store.isTaskHandled('maintenance') }
  const report = maintenanceFollowup(store, planned)
  return {
    id: planned ? 'planned' : 'maintenance',
    report: {
      ...report,
      title: planned ? plan.title : store.attention.find(item => item.id === 'maintenance').title,
      status: planned ? '常规计划' : maintenanceStatus(store),
      tone: planned ? 'ai' : linked ? 'transferred' : 'human',
      meta: `${plan.device} · 周期计划 ${plan.currentHours.toLocaleString()} / ${plan.dueHours.toLocaleString()} h`,
      detailTabs: content.tabs
    },
    actions: content.actions.filter(action => conditions[action.when]).map(action => ({
      id: action.id,
      label: action.id === 'todo' ? `${action.label} · ${store.cases.maintenance.stages[store.progress.maintenance].label}` : action.label
    }))
  }
}
