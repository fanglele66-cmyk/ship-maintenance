import {lifecycleStorageKey} from '../workflow/demoTimeline.js'
import {formalEventReports} from '../workflow/reportArtifacts.js'
import {restoreHistoricalPhotoSources} from '../workflow/reportSubmissions.js'

// Browser-only demo cases retain their original storage boundary. Each archive
// entry is a JSON File keyed by event and report, including frozen shore reports.
export async function syncDemoReportFiles(storage) {
  if (!storage || !globalThis.indexedDB) return
  const db = await new Promise((resolve, reject) => {
    const request = indexedDB.open('ship-demo-report-files', 1)
    request.onupgradeneeded = () => request.result.createObjectStore('reports')
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
  try {
    await new Promise((resolve, reject) => {
      const transaction = db.transaction('reports', 'readwrite')
      const files = transaction.objectStore('reports')
      const keys = files.getAllKeys()
      keys.onsuccess = () => {
        // Read the authoritative snapshot inside the write transaction so a
        // delayed archive pass in another tab cannot publish an older version.
        const workspace = JSON.parse(storage.getItem(lifecycleStorageKey))
        if (workspace?.version !== 1 || !workspace.events) return
        const saved = new Set()
        for (const event of Object.values(workspace.events)) {
          if (event.backendManaged) continue
          for (const report of formalEventReports(event)) {
            if (!report.id) continue
            if (report.taskId) restoreHistoricalPhotoSources(event.tasks?.find(task => task.id === report.taskId), report)
            const key = JSON.stringify([event.id, report.id])
            const file = new File([JSON.stringify(report, null, 2)], report.id + '.json', {type: 'application/json'})
            files.put(file, key)
            saved.add(key)
          }
        }
        for (const key of keys.result) if (!saved.has(key)) files.delete(key)
      }
      transaction.oncomplete = resolve
      transaction.onabort = () => reject(transaction.error || Error('演示报告文件未保存。'))
    })
  } finally {
    db.close()
  }
}
