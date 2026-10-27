import {trackingDispositionSummary} from './trackingDisposition.js'
import {workbenchIssues, issueDevices} from './captainWorkbench.js'
import {isTrackingContainer, taskChildIds} from './issueRelationships.js'
import {matchesSituationDevice} from './situationScope.js'
import {closedEventReference} from './closedEventReferences.js'

export const eventStatusOptions = [
  {value:'', label:'全部事件状态'},
  ...['待决策','处置中','已闭环'].map(value => ({value, label:value})),
]

function taskProgress(store, id) {
  const item = store.cases?.[id], progress = store.progress?.[id] ?? 0
  const observeIndex = item?.stages?.findIndex(stage => stage.kind === 'observe') ?? -1
  const handled = typeof store.isTaskHandled === 'function' ? store.isTaskHandled(id)
    : Boolean(store.completedTasks?.[id]) || observeIndex >= 0 && progress >= observeIndex
  if (handled) return '已完成'
  // Execution evidence also identifies resumed older tasks without an assignment log.
  if (progress > 0 || store.checkAssessments?.[id] || store.executionRecords?.[id]?.length) return '进行中'
  // Default owner/scope values are form suggestions, not a confirmed dispatch.
  return store.assignmentRecords?.[id]?.length || store.assignments?.[id]?.at ? '已派发' : '待派发'
}

export function eventDirectoryRows(store) {
  return workbenchIssues(store).map(row => {
    const taskIds = [row.id, ...taskChildIds(row.id)].filter(id =>
      !isTrackingContainer(id) && store.todoCreated?.[id])
    const tasks = taskIds.map(id => ({id, progress:taskProgress(store, id)}))
    const activeTasks = tasks.filter(task => task.progress !== '已完成')
    const completedTaskCount = tasks.length - activeTasks.length
    const pendingDecision = row.state === '待决策' && !store.todoCreated?.[row.decisionId || row.id]
    const executionProgress = pendingDecision ? '待决策'
      : activeTasks.some(task => task.progress === '进行中') ? '进行中'
      : activeTasks.some(task => task.progress === '待派发') ? '待派发'
      : activeTasks.length ? '已派发' : tasks.length ? '已完成' : '无人工任务'
    const taskId = activeTasks.find(task => task.id === row.taskId)?.id || activeTasks[0]?.id || tasks.at(-1)?.id || null
    const tracking = store.cases?.[row.id]?.trackingOnly || row.state === '跟踪中'
    const disposition=store.trackingDispositions?.[row.id]
    const processingState = row.state === '已闭环' ? '已闭环'
      : disposition ? disposition.status==='observing'?'专项观察中':'待轮机长确认' : pendingDecision ? '待决策' : activeTasks.length ? '处置中'
      : tracking ? '持续跟踪' : completedTaskCount ? '效果观察'
      : row.state === '已记录决定' ? '已记录决定' : row.state
    const taskCase = taskId && store.cases?.[taskId]
    const stage = taskId ? store.completedTasks?.[taskId]?.title
      || taskCase?.stages?.[store.progress?.[taskId] ?? 0]?.label || '' : ''
    const taskOwner = taskId && (store.assignmentRecords?.[taskId]?.length || store.assignments?.[taskId]?.at)
      ? store.assignments?.[taskId]?.owner || taskCase?.owner : ''
    const progressNote = pendingDecision && completedTaskCount
      ? `${completedTaskCount} 项任务已完成，新增建议等待决定`
      : tasks.length ? `${tasks.length} 项关联任务 · ${completedTaskCount} 项已完成`
      : disposition?.priorProcessId ? disposition.status==='review'?'首轮核实已回交，待轮机长再次决策':'首轮核实过程已保留，后续安排沿原事件接续'
      : row.history ? '历史决定已保留，无关联执行任务' : '尚未建立人工执行任务'
    return {...row, taskId, taskIds, tasks, completedTaskCount, executionProgress,eventState:row.eventState,processingState,
      actionTaskId:row.eventState==='已闭环'?null:activeTasks.find(task=>task.id===taskId)?.id||activeTasks[0]?.id||null,
      reference:closedEventReference(row.id),
      taskOwner, stage, progressNote,
      firstObserved:store.cases?.[row.id]?.firstObserved || row.at || '',
      continuation:trackingDispositionSummary(disposition)|| (processingState === '持续跟踪' && completedTaskCount
        ? '本次人工任务已结束，健康趋势观测继续。'
        : processingState === '效果观察' ? '人工任务已完成，持续效果与事件闭环仍待确认。' : ''),
    }
  })
}

export function eventDirectoryDeviceOptions(rows) {
  const devices = new Map(issueDevices.map(item => [item.value, item.label]))
  for (const row of rows) if (row.deviceId && !devices.has(row.deviceId)) devices.set(row.deviceId, row.device || row.deviceId)
  return [{value:'',label:'全部设备'}, {value:'aux-system',label:'全部辅机'},
    ...[...devices].map(([value,label]) => ({value,label}))]
}

export function filterEventDirectory(rows, {device='', type='', status=''} = {}) {
  return rows.filter(row => matchesSituationDevice(row, device)
    && (!type || row.type === type)
    && (!status || row.eventState === status))
}
