import {workbenchIssues} from './captainWorkbench.js'
import {realCaseFor} from './realCaseAdapter.js'
import {healthTracks} from './fourStoryWorkflow.js'

// Describe the evidence used by the overview, not the time a browser or task was updated.
export function overviewAnalysisWindow(store, deviceIds) {
  const rows = workbenchIssues(store).filter(row => !row.history && (!deviceIds || deviceIds.includes(row.deviceId)))
  const times = []
  function add(value) {
    if (!value) return
    const normalized = String(value).trim().replaceAll('/', '-').replace(' ', 'T')
    const local = normalized.length === 10 ? normalized + 'T00:00:00' : normalized
    const time = Date.parse(/(?:Z|[+-]\d{2}:?\d{2})$/.test(local) ? local : local + '+08:00')
    if (Number.isFinite(time)) times.push(time)
  }
  for (const row of rows) {
    const item = store.cases?.[row.id]
    const source = realCaseFor(item?.realCaseId || row.sourceCaseId || row.id)
    if (source?.timeRange) {
      add(source.timeRange.start)
      add(source.timeRange.end)
      continue
    }
    const track = healthTracks.find(track => track.requestId === row.id)
    for (const node of [...(track?.nodes || []), ...(store.healthUpdates?.[track?.id]?.laterNodes || [])]) add(node.at)
  }
  if (!times.length) return null
  const format = time => new Intl.DateTimeFormat('zh-CN', {timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false}).format(time)
  const start = Math.min(...times), end = Math.max(...times)
  return {start: new Date(start).toISOString(), end: new Date(end).toISOString(), label: `${format(start)} — ${format(end)}`}
}
