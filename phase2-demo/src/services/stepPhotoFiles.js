import {appUrl} from './appUrl.js'
import {sessionHeaders} from './session.js'
import {checkStepPhotoFile, referencedStepPhotos, STEP_PHOTO_GRACE_MS} from '../workflow/stepPhotoFile.js'
import {lifecycleStorageKey} from '../workflow/demoTimeline.js'

// Demo events stay in this browser. Keep their binary evidence outside the JSON workspace.
async function browserPhoto(mode, operation) {
  const db = await new Promise((resolve, reject) => {
    const request = indexedDB.open('ship-task-step-photos', 2)
    request.onupgradeneeded = () => {
      for (const name of ['originals', 'retention']) {
        if (!request.result.objectStoreNames.contains(name)) request.result.createObjectStore(name)
      }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(['originals', 'retention'], mode)
      const request = operation(tx.objectStore('originals'), tx.objectStore('retention'))
      tx.oncomplete = () => resolve(request?.result)
      tx.onabort = () => reject(tx.error || Error('照片保存未完成。'))
      tx.onerror = () => reject(tx.error || request?.error)
    })
  } finally {
    db.close()
  }
}

let lastSweep = -Infinity
export async function collectBrowserStepPhotos() {
  const now = Date.now()
  if (now - lastSweep < 3600000) return
  try {
    const snapshot = localStorage.getItem(lifecycleStorageKey)
    const saved = JSON.parse(snapshot)
    if (!saved?.events) return
    const referenced = referencedStepPhotos(saved.events, 'browser')
    await browserPhoto('readwrite', (originals, retention) => {
      // A key cursor visits metadata only, even when the originals are several MB each.
      const cursor = originals.openKeyCursor()
      cursor.onsuccess = () => {
        const current = cursor.result
        if (!current) return
        const id = current.primaryKey, lease = retention.get(id)
        lease.onsuccess = () => {
          if (referenced.has(id)) retention.delete(id)
          else if (lease.result === undefined) retention.put(now, id)
          else if (now - lease.result >= STEP_PHOTO_GRACE_MS && localStorage.getItem(lifecycleStorageKey) === snapshot) {
            originals.delete(id)
            retention.delete(id)
          }
          current.continue()
        }
      }
    })
    lastSweep = now
  } catch { /* Leave all originals in place when the workspace cannot be read. */ }
}

async function photoRequest(params, options) {
  const response = await fetch(appUrl('api/workflow/step-photos') + '?' + new URLSearchParams(params), options)
  if (!response.ok) {
    const error = await response.json().catch(() => ({}))
    throw Error(error.error || '无法读写船端照片，请重试。')
  }
  return response
}

export async function saveStepPhoto(file, {backendManaged, eventId, taskId, stepIndex}) {
  checkStepPhotoFile(file.type, file.size)
  checkStepPhotoFile(file.type, file.size, new Uint8Array(await file.slice(0, 12).arrayBuffer()))
  if (backendManaged) {
    const response = await photoRequest({eventId, taskId, stepIndex}, {
      method: 'POST', headers: {...sessionHeaders(), 'Content-Type': file.type}, body: file
    })
    return {...await response.json(), name: file.name, addedAt: new Date().toISOString()}
  }
  const digest = await crypto.subtle.digest('SHA-256', await file.arrayBuffer())
  const contentHash = Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2,'0')).join('')
  const id = JSON.stringify([eventId,taskId,stepIndex,contentHash])
  try {
    await browserPhoto('readwrite', (store, retention) => {
      retention.put(Date.now(), id)
      return store.put(file, id)
    })
  } catch {
    throw Error('浏览器无法保存这张现场照片，请检查本地存储空间后重试。')
  }
  return {id, contentHash, name: file.name, mimeType: file.type, size: file.size, storage: 'browser', addedAt:new Date().toISOString()}
}

export async function readStepPhoto(photo) {
  if (photo.storage === 'ship') {
    const response = await photoRequest({id: photo.id}, {headers: sessionHeaders()})
    return response.blob()
  }
  if (photo.storage === 'browser') {
    const original = await browserPhoto('readonly', store => store.get(photo.id))
    if (original) return original
  }
  throw Error('未找到这张现场照片。')
}
