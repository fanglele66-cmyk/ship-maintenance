import {createHash} from 'node:crypto'
import {ownsTask} from '../src/workflow/lifecyclePermissions.js'
import {checkStepPhotoFile, MAX_STEP_PHOTO_BYTES, referencedStepPhotos, STEP_PHOTO_GRACE_MS} from '../src/workflow/stepPhotoFile.js'
import {canSeeEvent} from './event-repository.mjs'

const unavailable = () => Object.assign(Error('照片不存在或当前账号无法查看。'), {status: 404})

export function createStepPhotoFiles(db, findEvent, clock = Date.now) {
  db.exec('CREATE TABLE IF NOT EXISTS step_photos(id TEXT PRIMARY KEY, event_id TEXT NOT NULL, task_id TEXT NOT NULL, mime_type TEXT NOT NULL, bytes BLOB NOT NULL)')
  db.exec('CREATE TABLE IF NOT EXISTS step_photo_retention(id TEXT PRIMARY KEY, orphaned_at INTEGER NOT NULL)')
  const insert = db.prepare('INSERT OR IGNORE INTO step_photos VALUES(?,?,?,?,?)')
  const find = db.prepare('SELECT event_id,task_id,mime_type FROM step_photos WHERE id=?')
  const read = db.prepare('SELECT bytes FROM step_photos WHERE id=?')
  const pending = db.prepare('INSERT OR REPLACE INTO step_photo_retention VALUES(?,?)')
  const clear = db.prepare('DELETE FROM step_photo_retention WHERE id=?')
  const remove = db.prepare('DELETE FROM step_photos WHERE id=?')
  let lastSweep = -Infinity
  function collect() {
    const now = clock()
    if (now - lastSweep < 3600000) return
    db.exec('BEGIN IMMEDIATE')
    try {
      const rows = db.prepare('SELECT id,event_id,orphaned_at FROM step_photos LEFT JOIN step_photo_retention USING(id) ORDER BY event_id').all()
      let eventId, references
      for (const row of rows) {
        if (eventId !== row.event_id) {
          eventId = row.event_id
          references = referencedStepPhotos(findEvent(eventId), 'ship')
        }
        if (references.has(row.id)) {
          if (row.orphaned_at !== null) clear.run(row.id)
        } else if (row.orphaned_at === null) pending.run(row.id, now)
        else if (now - row.orphaned_at >= STEP_PHOTO_GRACE_MS) { remove.run(row.id); clear.run(row.id) }
      }
      db.exec('COMMIT')
      lastSweep = now
    } catch (error) { db.exec('ROLLBACK'); throw error }
  }
  function assignedTask(eventId, taskId, stepIndex, user) {
    const event = findEvent(eventId)
    const task = event?.tasks.find(task => task.id === taskId)
    if (!task || !canSeeEvent(event, user) || !ownsTask(user.workflowRole, task) ||
        event.currentTask !== taskId || task.status !== 'assigned' || !Number.isInteger(stepIndex) || !task.steps[stepIndex]) {
      throw Object.assign(Error('仅当前任务执行人可上传本步骤现场照片。'), {status: 403})
    }
  }
  async function upload(req, user, params) {
    const eventId = params.get('eventId'), taskId = params.get('taskId'), rawIndex = params.get('stepIndex')
    const index = rawIndex && /^\d+$/.test(rawIndex) ? Number(rawIndex) : NaN
    assignedTask(eventId, taskId, index, user)
    const mimeType = req.headers['content-type']
    checkStepPhotoFile(mimeType, Number(req.headers['content-length'] || 1))
    const chunks = []
    let size = 0
    for await (const chunk of req) {
      size += chunk.length
      if (size > MAX_STEP_PHOTO_BYTES) throw Object.assign(Error('单张现场照片不能超过 12 MB。'), {status: 413})
      chunks.push(chunk)
    }
    const bytes = Buffer.concat(chunks)
    checkStepPhotoFile(mimeType, size, bytes)
    assignedTask(eventId, taskId, index, user)
    const id = createHash('sha256').update(JSON.stringify([eventId, taskId, index])).update(bytes).digest('hex')
    collect()
    insert.run(id, eventId, taskId, mimeType, bytes)
    pending.run(id, clock())
    return {id, contentHash:createHash('sha256').update(bytes).digest('hex'), mimeType, size, storage: 'ship'}
  }
  function download(id, user) {
    const row = find.get(id)
    if (!row) throw unavailable()
    const event = findEvent(row.event_id)
    const task = event?.tasks.find(task => task.id === row.task_id)
    if (!task || !canSeeEvent(event, user)) throw unavailable()
    const submitted = records => records?.some(record => record.photos?.some(photo => photo.id === id))
    if (!ownsTask(user.workflowRole, task) && !submitted(task.records) &&
        !event.reports.some(report => report.taskId === task.id && submitted(report.submissionSnapshot?.records))) throw unavailable()
    return {mimeType: row.mime_type, bytes: Buffer.from(read.get(id).bytes)}
  }
  return {upload, download, collect}
}
