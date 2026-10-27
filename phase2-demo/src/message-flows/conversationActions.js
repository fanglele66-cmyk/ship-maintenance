// Right-side assistants may ask follow-up questions, but cannot operate the workspace.
// Unknown actions are denied, including actions retained in older conversations.
const questions = Object.freeze({
  'issue:ask:evidence': { channel: 'issue', text: '还需核实哪些信息？' },
  'issue:ask:next': { channel: 'issue', text: '下一步如何安排？' },
  'maintenance:ask:basis': { channel: 'maintenance', text: '为什么建议提前检查？' },
  'maintenance:ask:evidence': { channel: 'maintenance', text: '需要补齐哪些检查证据？' },
  'maintenance:ask:arrangement': { channel: 'maintenance', text: '已有安排是否冲突？' },
  'ask:当前哪些事项需要人工跟进？': { channel: 'situation', text: '当前哪些事项需要人工跟进？' }
})

export function conversationAction(id) {
  return typeof id === 'string' && Object.hasOwn(questions, id) ? questions[id] : null
}

export function conversationActions(actions = []) {
  return Array.isArray(actions) ? actions.filter(action => conversationAction(action?.id)) : []
}

export function dispatchConversationAction(id, handlers) {
  const question = conversationAction(id)
  if (!question || typeof handlers[question.channel] !== 'function') return false
  handlers[question.channel](question.text)
  return true
}

const legacyQuestions = new Set([
  '今天有几件紧急事件？', '最近哪个系统问题最多？', '有没有重复出现的故障？',
  '哪些设备有异常？', '船舶健康状态如何？', '该设备历史维保记录',
  '查看同类传感器对比', '异常原因分析', '查看近24小时趋势', '对比历史同期数据'
])

export function isConversationQuestion(question) {
  return question?.action === 'send' && legacyQuestions.has(question.text)
}
