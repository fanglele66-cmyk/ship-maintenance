import {shoreReportEntry} from './shoreReports.js'

// Observation events retain a copy of their source report for context. The
// standalone file for that report belongs to the event that received it.
export function formalEventReports(event) {
  return [
    ...(event.reports || []).filter(report => !report.linkedSource),
    ...(event.shore || []).map(record => shoreReportEntry(event, record))
  ]
}
