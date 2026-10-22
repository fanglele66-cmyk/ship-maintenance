const dateFormatter = new Intl.DateTimeFormat('zh-CN', {timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false})
export const formatAnalysisTime = value => dateFormatter.format(new Date(value))

// A rolling assessment window, independent of the original dates of open events.
export function overviewAnalysisWindow(referenceTime) {
  const requestedEnd = Number(referenceTime)
  if (!Number.isFinite(requestedEnd)) return null
  const durationHours = 12
  const end = Math.floor(requestedEnd / 60000) * 60000
  const start = end - durationHours * 3600000
  return {start, end, hours:durationHours, label:`${formatAnalysisTime(start)} — ${formatAnalysisTime(end)}`}
}
