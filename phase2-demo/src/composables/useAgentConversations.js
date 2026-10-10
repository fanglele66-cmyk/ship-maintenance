import { computed, reactive } from 'vue'

// Prototype session registry: isolated by agent, retained across page mounts in this runtime.
const agents = reactive({})
let sequence = 0
export function createConversation(title = '新对话', messages = [], updatedAt = Date.now()) {
  return { id: `conversation-${++sequence}`, title, messages, draft: '', updatedAt }
}
export function useAgentConversations(agentId, seeds = () => []) {
  const agent = computed(() => {
    const id = agentId.value
    if (!agents[id]) {
      const initial = createConversation()
      agents[id] = { activeId: initial.id, primaryId: initial.id, conversations: [initial, ...seeds(id)] }
    }
    return agents[id]
  })
  const active = computed(() => agent.value.conversations.find(item => item.id === agent.value.activeId))
  const draft = computed({ get: () => active.value.draft, set: value => { active.value.draft = value } })
  const conversations = computed(() => [...agent.value.conversations].sort((a,b) => b.updatedAt-a.updatedAt))
  function select(id) { if (agent.value.conversations.some(item => item.id === id)) agent.value.activeId = id }
  function newConversation() { const item = createConversation(); agent.value.conversations.push(item); agent.value.activeId = item.id }
  function touch(item = active.value) {
    const first = item.messages.find(message => message.role === 'user' && (message.text || message.content))
    if (item.title === '新对话' && first) item.title = (first.text || first.content).slice(0,28)
    item.updatedAt = Date.now()
  }
  return { agent, active, draft, conversations, select, newConversation, touch }
}
export function demoConversations(agentId) {
  const subject = agentId === 'knowledge' ? '知识资料' : agentId.includes('device') ? '主机设备' : agentId.includes('ship') ? '船舶运行' : '当前事项'
  return [
    createConversation(`${subject}近期情况`, [
      {role:'user',text:`帮我回顾一下${subject}的近期情况。`,at:'昨天 08:00'},
      {role:'assistant',text:'已整理近期信息。建议结合当前页面的监测记录与现场反馈，继续核对需要关注的事项。',at:'昨天 08:01'}
    ], Date.now()-86400000),
    createConversation(`${subject}后续关注建议`, [
      {role:'user',text:'后续需要关注哪些信息？',at:'前天 16:20'},
      {role:'assistant',text:'持续比较相近工况下的变化，保留现场检查结果；出现新的异常证据后，再核对处理安排。',at:'前天 16:21'}
    ], Date.now()-172800000)
  ]
}

// Untitled conversations with content must remain reachable after switching away.
export function historyConversations(conversations) {
  return conversations.filter(item => item.messages.length || item.draft?.trim()).map(item => {
    if (item.title !== '新对话') return item
    const user = item.messages.find(message => message.role === 'user' && (message.text || message.content))
    const first = user || item.messages[0]
    const text = first?.title || first?.text || first?.content || first?.raw || ''
    const title = text.replace(/<[^>]*>/g, ' ').replace(/&[^;]+;/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 28)
    return { ...item, title: title || (item.draft?.trim() ? '未发送的对话' : '当前对话') }
  })
}
