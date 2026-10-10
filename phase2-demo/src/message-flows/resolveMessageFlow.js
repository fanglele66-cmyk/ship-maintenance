import { assertInquiry } from './inquiryFields.js'
export const messageTypes = ['text', 'dailyBrief', 'notice', 'report', 'feedbackRecord', 'inquiry']

// Explicit source lookup only: configuration never executes code or modifies the store.
export function resolveMessageFlow(config, sources) {
  if (config.version !== 1 || !Array.isArray(config.messages)) throw new Error('Unsupported message flow configuration')
  const ids = new Set()
  return config.messages.map(entry => {
    if (!entry.id || ids.has(entry.id)) throw new Error(`Duplicate or missing message id: ${entry.id}`)
    ids.add(entry.id)
    if (!messageTypes.includes(entry.type)) throw new Error(`Unknown message type: ${entry.type}`)
    if (entry.expanded !== undefined && typeof entry.expanded !== 'boolean') throw new Error(`Invalid expanded state: ${entry.id}`)
    const source = entry.source ? Object.hasOwn(sources, entry.source) && sources[entry.source] : entry.content
    if (!source || typeof source !== 'object' || Array.isArray(source)) throw new Error(`Missing message source: ${entry.source || entry.id}`)
    const message = { ...source, id: entry.id, type: entry.type, ...(entry.expanded === undefined ? {} : { expanded: entry.expanded }) }
    if (entry.type === 'inquiry') assertInquiry(message)
    return message
  })
}

// Temporary adapter for pages still emitting the original kind-based messages.
export function messageType(message) {
  if (messageTypes.includes(message.type)) return message.type
  if (['feedbackRecord', 'recordDraft'].includes(message.kind)) return 'feedbackRecord'
  if (message.kind === 'scene') return /每日/.test(message.demoLabel || '') ? 'dailyBrief' : 'report'
  return 'text'
}
