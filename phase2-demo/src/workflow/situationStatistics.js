import {occurrenceTime} from './navigationStages.js'
import {eventState} from './lifecyclePresentation.js'
import {ownsTask} from './lifecyclePermissions.js'
import {canRetryTaskReport} from './reportGenerationState.js'

const DAY = 86400000
const SHANGHAI = 8 * 3600000
const dayStart = at => Math.floor((at + SHANGHAI) / DAY) * DAY - SHANGHAI
const timestamp = value => occurrenceTime({createdAt: value})
const dateFormat = new Intl.DateTimeFormat('zh-CN', {timeZone:'Asia/Shanghai', month:'2-digit', day:'2-digit'})
export const shortDate = at => dateFormat.format(at)
export const statisticEventTypes = ['报警', '预警', '异动跟踪', '效果观察']

function pendingForEngineer(event, role) {
  if (event.phase === 'closed' || event.phase === 'transferred') return false
  const task = event.tasks?.find(item => item.id === event.currentTask)
  if (!ownsTask(role, task)) return false
  if (task.status === 'assigned') return true
  if (task.status === 'waiting') return !task.waiting?.reviewRequested
  return canRetryTaskReport(event, task)
}

function summarizeEvent(event, now, role) {
  const actionTimes = (event.decisions || []).map(decision => timestamp(decision.at))
  for (const task of event.tasks || []) {
    actionTimes.push(timestamp(task.assignedAt), timestamp(task.submittedAt))
    for (const revision of task.feedbackHistory || []) actionTimes.push(timestamp(revision.at))
  }
  const closed = event.phase === 'closed'
    ? timestamp(event.closedAt || event.phases?.findLast(phase => phase.kind === 'closed')?.at)
    : NaN
  actionTimes.push(closed)
  const actions = [...new Set(actionTimes.filter(at => at <= now))].sort((a,b) => a-b)
  const type = event.type?.replace(/^(报警|预警)事件$/, '$1') || '未记录'
  const state = eventState(event)
  return {
    id:event.id, title:event.title, number:event.number, device:event.device, deviceId:event.deviceId, type,
    state, pending:role === 'captain' ? state === '待决策' : pendingForEngineer(event, role),
    created:timestamp(event.createdAt || event.brief?.discovery?.at), closed, actions,
  }
}

function deviceStatistics(rows, events) {
  // Earlier event records may identify a device by display name only.
  const idsByName = new Map()
  for (const event of events) {
    if (!event.deviceId || !event.device) continue
    if (!idsByName.has(event.device)) idsByName.set(event.device, new Set())
    idsByName.get(event.device).add(event.deviceId)
  }
  const groups = new Map()
  for (const row of rows) {
    const ids = idsByName.get(row.device)
    const deviceId = row.deviceId || (ids?.size === 1 ? [...ids][0] : null)
    const key = deviceId ? 'id:' + deviceId : 'name:' + (row.device || '')
    if (!groups.has(key)) groups.set(key, {
      key, device:row.device || deviceId || '未登记', identifier:ids?.size > 1 ? deviceId : null,
      count:0, types:Object.fromEntries(statisticEventTypes.map(type => [type, 0])),
    })
    const group = groups.get(key)
    group.count++
    if (Object.hasOwn(group.types, row.type)) group.types[row.type]++
  }
  return [...groups.values()].sort((a,b) => b.count - a.count || a.device.localeCompare(b.device, 'zh-CN') || a.key.localeCompare(b.key))
}

export function situationStatistics(events, days = 30, now = Date.now(), role = 'captain') {
  // Each visible event has its own number, including a linked observation.
  const visible = new Map(events.map(event => [event.id, event]))
  const cases = [...visible.values()].map(event => summarizeEvent(event, now, role))
  const today = dayStart(now)
  let start = today - (days - 1) * DAY
  if (days === 0) {
    start = today
    for (const row of cases) for (const at of [row.created, row.actions[0]]) if (at < start) start = dayStart(at)
  }
  const inside = at => at >= start && at <= now
  const rows = []
  for (const row of cases) {
    const matching = row.actions.filter(inside)
    const isNew = inside(row.created), handled = matching.length > 0
    if (!isNew && !handled) continue
    rows.push({...row, isNew, handled, isClosed:inside(row.closed),
      latest:Math.max(isNew ? row.created : -Infinity, matching.at(-1) ?? -Infinity)})
  }
  rows.sort((a,b) => b.latest - a.latest || a.id.localeCompare(b.id))
  const span = Math.round((today - start)/DAY) + 1
  const bucketDays = Math.ceil(span / (span === 30 ? 6 : 9))
  const trend = []
  for (let from = start; from <= today; from += bucketDays * DAY) {
    const until = Math.min(today + DAY, from + bucketDays * DAY)
    const inBucket = at => at >= from && at < until
    trend.push({from, until, label:shortDate(from), added:rows.filter(r => r.isNew && inBucket(r.created)).length,
      handled:rows.filter(r => r.actions.some(inBucket)).length})
  }
  const count = key => rows.filter(row => row[key]).length
  return {
    start, now, rows, trend, added:count('isNew'), handled:count('handled'), closed:count('isClosed'), pending:count('pending'),
    pendingLabel:role === 'captain' ? '待决策事件' : '待处理事件',
    types:statisticEventTypes.map(label => ({label, count:rows.filter(row => row.type === label).length})),
    devices:deviceStatistics(rows, cases),
  }
}
