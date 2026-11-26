export const photoSourceLabels = {form: '步骤备注', chat: '助手对话'}
const identity = photo => photo.contentHash || photo.dataUrl || photo.id

// Take the actual sent messages at the time of this submission. Unsent composer
// selections and model responses cannot become report evidence.
export function submittedStepRecords(task, records, submittedAt) {
  const cutoff = Date.parse(submittedAt)
  const messages = Object.values(task.conversations || {}).flat()
    .filter(m => m.kind === 'user' && Number.isInteger(m.stepIndex) &&
      (m.originalPhotos?.length || m.images?.length) && (!Number.isFinite(cutoff) || Date.parse(m.at) <= cutoff))
    .sort((a, b) => Date.parse(a.at) - Date.parse(b.at))
  return records.map((record, index) => {
    const photos = new Map()
    function add(photo, source, at) {
      const key = identity(photo)
      if (!key) return
      let entry = photos.get(key)
      if (!entry) { entry = {...photo, sources: [], sourceTimes: {}}; photos.set(key, entry) }
      if (!entry.sources.includes(source)) entry.sources.push(source)
      if (at && !entry.sourceTimes[source]) entry.sourceTimes[source] = at
    }
    for (const photo of record.photos || []) {
      for (const source of photo.sources || ['form']) add(photo, source, photo.sourceTimes?.[source] || photo.addedAt)
    }
    for (const message of messages) {
      if (message.stepIndex !== index || (message.stepLabel && message.stepLabel !== record.label)) continue
      for (const photo of message.originalPhotos || message.images || []) add(photo, 'chat', message.at)
    }
    return photos.size ? {...record, photos: [...photos.values()]} : record
  })
}

// On resumption only the operator's form attachments are editable in the left
// panel. Sent conversation evidence remains in its original thread.
export function editableStepRecords(records) {
  return records.map(record => !record.photos ? record : {...record,
    photos: record.photos.filter(photo => !photo.sources || photo.sources.includes('form')).map(photo => {
      const {sources, sourceTimes, ...original} = photo
      return original
    })
  })
}

export function reportPhotoEntries(records) {
  const entries = new Map()
  records.forEach((record, index) => {
    for (const photo of record.photos || []) {
      const key = identity(photo)
      if (!key) continue
      if (!entries.has(key)) entries.set(key, {...photo, uses: []})
      entries.get(key).uses.push({index, label: record.label, sources: photo.sources || ['form'], sourceTimes: photo.sourceTimes})
    }
  })
  return [...entries.values()]
}

export function stepPhotoIndex(records) {
  return reportPhotoEntries(records).map(photo=>{
    const [first,...others]=photo.uses
    const step=use=>`第 ${use.index+1} 步「${use.label}」`
    const sources=use=>use.sources.map(source=>photoSourceLabels[source]).join('、')
    return `- ${step(first)}现场照片：${photo.name}（${sources(first)}）`+
      others.map(use=>` · ${step(use)}（${sources(use)}）`).join('')
  })
}
