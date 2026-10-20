// Event identity is separate from an executable maintenance assessment. Keep
// old task IDs so in-progress forms, records and links can still be resumed.
export const maintenanceParents = Object.freeze({
  maintenance: 'bearing-health',
  'aux-maintenance': 'aux-health',
  'real-maintenance-0523': 'real-health-0523',
})
export const trackingContainerIds = Object.freeze(['bearing-health', 'real-health-0523'])
export const historicalIssueParents = Object.freeze({'maintenance-history': 'bearing-health'})
export const issueTypeNames = Object.freeze(['报警事件', '预警事件', '异动跟踪'])
export function parentIssueId(id) { return maintenanceParents[id] || historicalIssueParents[id] || id }
export function maintenanceChildIds(id) {
  const parent = parentIssueId(id)
  return Object.keys(maintenanceParents).filter(child => maintenanceParents[child] === parent)
}
export function isMaintenanceWorkflow(item) {
  return typeof item === 'string' ? Boolean(maintenanceParents[item])
    : Boolean(item && (item.workflowKind === 'maintenance' || maintenanceParents[item.id]))
}
export function isTrackingContainer(item) {
  return trackingContainerIds.includes(typeof item === 'string' ? item : item?.id)
}
export function resolveIssueNavigation(id) {
  const parent = parentIssueId(id)
  return {id: parent, ...(parent !== id ? {tab: '健康趋势观测',
    ...(historicalIssueParents[id] ? {recordId: id} : {recommendationId: id})} : {})}
}
export function recommendationAvailable(store, id) {
  const item = store?.cases?.[id]
  return isMaintenanceWorkflow(id) && Boolean(
    item && !item.latent || store?.unlockedRecommendations?.[id]
    || store?.todoCreated?.[id] || store?.ignoredSuggestions?.[id]
    || store?.completedTasks?.[id] || store?.executionRecords?.[id]?.length
  )
}
export function maintenanceRecommendations(store, id) {
  return maintenanceChildIds(id).filter(child => recommendationAvailable(store, child)).map(child => ({
    ...(store.cases?.[child] || {id:child}), parentIssueId: parentIssueId(child),
    state: store.eventStatus?.[child] === 'closed' ? '已闭环'
      : store.todoCreated?.[child] ? '已派发'
      : store.ignoredSuggestions?.[child] ? '已记录决定' : '待决策',
    decision: store.completedTasks?.[child] || store.ignoredSuggestions?.[child] || null,
    assessment: store.checkAssessments?.[child] || null,
    execution: store.executionRecords?.[child]?.at(-1) || null,
  }))
}
export function canonicalIssueRoute(to) {
  const id = to.params?.attentionId
  if (!id || !(maintenanceParents[id] || historicalIssueParents[id])) return null
  const navigation = resolveIssueNavigation(id)
  return {
    path: `/situation/issue/${navigation.id}`,
    query: {...to.query, tab: navigation.tab, ...(navigation.recordId ? {record:id} : {recommendation:id})},
    hash: to.hash, replace: true,
  }
}
