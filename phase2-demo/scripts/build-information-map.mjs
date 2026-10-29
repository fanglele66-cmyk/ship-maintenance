import assert from 'node:assert/strict'
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const sourceRoot = path.join(appRoot, 'docs', 'information-map')
const output = path.join(appRoot, 'public', 'information-map.html')
const repositoryDoc = path.join(appRoot, 'docs', '智能机舱-态势与事项信息地图.html')
const workspaceDoc = path.resolve(appRoot, '..', '..', 'doc', '智能机舱-态势与事项信息地图.html')
const readJson = async (file) => JSON.parse((await readFile(file, 'utf8')).replace(/^\uFEFF/, ''))
const [model, sharedCases, template] = await Promise.all([
  readJson(path.join(sourceRoot, 'model.json')),
  readJson(path.join(appRoot, 'src', 'mock', 'realCases.json')),
  readFile(path.join(sourceRoot, 'template.html'), 'utf8'),
])

// The map owns presentation only. Historical measurements stay in the shared
// source already used by the application; no local database is needed to build.
const sourceCases = new Map(sharedCases.cases.map((item) => [item.id, item]))
const evidenceFields = [
  'series', 'timeline', 'sources', 'evidence', 'facts', 'coverage', 'aggregates',
  'statisticsHighlights', 'sourceConflicts', 'limits', 'sourceEventId', 'timeRange',
]
function present(value, key = '') {
  if (evidenceFields.includes(key) || key === 'path') return structuredClone(value)
  if (typeof value === 'string') return model.graph.nodeAliases?.[value] ?? value.replaceAll('事项', '事件')
  if (Array.isArray(value)) return value.map((entry) => present(entry))
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([name, entry]) => [name, present(entry, name)]))
  return value
}
const cases = model.casePresentation.entries.map(({ sourceId, overrides = {} }) => {
  const source = sourceCases.get(sourceId)
  assert(source, `Unknown shared case: ${sourceId}`)
  for (const key of evidenceFields) {
    assert(!Object.hasOwn(overrides, key), `Presentation cannot override historical evidence: ${sourceId}.${key}`)
  }
  const item = present({ ...structuredClone(source), ...structuredClone(overrides) })
  // This resolves beside information-map.html both locally and under a hosted
  // path prefix. A published map must never send users to the author's localhost.
  item.shipUrl = `./#/situation/issue/${encodeURIComponent(item.id)}`
  for (const key of evidenceFields) assert.deepEqual(item[key], source[key], `${sourceId}.${key}`)
  return item
})
const data = {
  ...model.graph,
  realCases: { ...sharedCases, ...model.casePresentation.metadata, cases },
}
const nodes = new Map(data.nodes.map(node => [node.id, node]))
const views = new Map(data.views.map(view => [view.id, view]))
const layers = ['raw', 'processing', 'scenario', 'event', 'task', 'result']
const taskTypes = { 'task-investigation': 'investigation', 'task-repair': 'repair', 'task-recheck': 'recheck' }
assert.equal(nodes.size, data.nodes.length, 'Duplicate map node IDs')
assert.deepEqual([...views.keys()], ['overview', 'alarm', 'warning', 'tracking', 'states', 'pages'])
assert.deepEqual(data.informationLayers.map(layer => layer.id), layers)
assert.deepEqual(data.branchFlows.map(flow => flow.id), ['alarm', 'warning', 'tracking'])
const expectedTitles = {
  crew: '角色与权限', 'risk-brief': '事件信息与排查建议',
  'report-analysis': '处置报告', 'investigation-report': '排查/复查反馈',
  'repair-report': '维修反馈', 'effect-observation': '效果观察', 'task-feedback': '步骤反馈',
}
for (const [id, title] of Object.entries(expectedTitles)) assert.equal(nodes.get(id)?.title, title)
for (const id of ['alarm', 'warning', 'tracking', 'report-analysis']) assert.equal(nodes.get(id)?.kind, 'ai')
for (const id of ['investigation-report', 'repair-report']) assert.equal(nodes.get(id)?.kind, 'human')
assert.equal(nodes.get('notification')?.kind, 'stage')
for (const id of ['report-revision', 'role-conversation', 'page-logs', 'decision-review']) assert(!nodes.has(id), 'Removed node returned: ' + id)
assert.equal(views.get('pages').title, '用户动线')
assert(nodes.get('effect-observation').sources.includes('mapped-samples'))
assert(nodes.get('effect-observation').related.includes('sample'))
for (const node of nodes.values()) {
  for (const id of [...node.sources, ...node.outputs, ...node.related, ...(node.artifacts ?? [])]) assert(nodes.has(id), 'Unknown reference: ' + node.id + ' -> ' + id)
  for (const source of node.evidence ?? []) {
    assert(source.path.startsWith('ship-maintenance/phase2-demo/'), 'Unexpected evidence path')
    const local = path.join(appRoot, source.path.slice('ship-maintenance/phase2-demo/'.length))
    const content = await readFile(local, 'utf8')
    assert(source.line > 0 && source.line <= content.split('\n').length, 'Invalid evidence line: ' + source.path)
  }
}
const taskGates = { 'task-investigation': ['triage-dispatch', 'notification'], 'task-repair': ['notification'], 'task-recheck': ['notification'] }
for (const [id, gates] of Object.entries(taskGates)) assert.deepEqual(nodes.get(id).sources, gates, 'Task bypasses initial or follow-up confirmation: ' + id)
assert.deepEqual(nodes.get('plan-draft').sources, ['triage'], 'Initial task draft must not receive follow-up decisions')
assert.equal(nodes.get('notification').layer, 'task')
for (const id of ['branch-continue', 'branch-repair', 'state-event']) assert.equal(nodes.get(id).layer, 'task')
// A report can return to decision; repair never starts merely by submitting it.
assert(!nodes.get('investigation-report').outputs.includes('task-repair'))
assert(!nodes.get('plan-draft').outputs.some(id => Object.hasOwn(taskTypes, id)))
function hasUnmappedSensorPath(id, seen = new Set()) {
  if (id === 'sample') return true
  if (id === 'mapped-samples' || seen.has(id)) return false
  seen.add(id)
  return nodes.get(id).sources.some(source => hasUnmappedSensorPath(source, seen))
}
for (const view of views.values()) {
  const displayed = new Set(view.columns.flatMap(column => column.groups.flatMap(group => group.ids)))
  if (view.id !== 'pages') assert.deepEqual(view.columns.map(column => column.layer), layers)
  for (const column of view.columns) for (const group of column.groups) for (const id of group.ids) {
    assert(nodes.has(id), 'Unknown displayed node: ' + id)
    assert.equal(nodes.get(id).layer, view.id === 'pages' ? 'page' : column.layer)
    if (column.layer === 'scenario') assert(!hasUnmappedSensorPath(id), 'Scenario bypasses mapped samples: ' + id)
  }
  for (const edge of view.edges) assert(displayed.has(edge.from) && displayed.has(edge.to), 'Invisible edge endpoint in ' + view.id)
  if (displayed.has('effect-observation')) {
    assert(view.edges.some(edge => edge.from === 'sample' && edge.to === 'effect-observation'), view.id + ': missing sensor relationship')
    assert(view.edges.some(edge => edge.from === 'mapped-samples' && edge.to === 'effect-observation'), view.id + ': missing standardized sensor input')
  }
  const reaches = (from, to, seen = new Set()) => {
    if (from === to) return true
    if (seen.has(from)) return false
    seen.add(from)
    return view.edges.filter(edge => edge.from === from).some(edge => reaches(edge.to, to, seen))
  }
  const paths = view.id === 'pages' ? [['page-home', 'page-event'], ['page-todo', 'page-event'], ['page-issues', 'page-event'], ['page-event', 'page-reports']] : [
    ['sample', 'mapped-samples'], ['mapped-samples', 'sample-quality'], ['sample-quality', 'time-features'],
    ['triage', 'triage-dispatch'], ['triage-dispatch', 'task-investigation'], ['task-investigation', 'investigation-report'],
    ['investigation-report', 'notification'], ['notification', 'task-investigation'], ['notification', 'task-repair'],
    ['task-repair', 'repair-report'], ['repair-report', 'effect-observation'], ['effect-observation', 'result-review'],
    ['result-review', 'task-recheck'], ['task-recheck', 'investigation-report'], ['result-review', 'closure-report'],
  ]
  // The status view intentionally condenses observation into its task/result ownership cards.
  for (const [from, to] of paths) if (displayed.has(from) && displayed.has(to)) assert(reaches(from, to), view.id + ': broken path ' + from + ' -> ' + to)
  if (view.id !== 'pages') {
    for (const initial of ['triage', 'plan-draft', 'triage-dispatch']) assert(!reaches('notification', initial), view.id + ': lifecycle incorrectly returns to the initial event column')
  }
  if (['alarm', 'warning', 'tracking'].includes(view.id)) assert(reaches(view.id, 'triage-dispatch'))
}
for (const flow of data.branchFlows) {
  const displayed = new Set(views.get(flow.id).columns.flatMap(column => column.groups.flatMap(group => group.ids)))
  for (const group of flow.groups) {
    assert(displayed.has(group.stageId), 'Missing stage: ' + group.stageId)
    for (const branch of group.branches) {
      assert(displayed.has(branch.id), 'Missing branch: ' + branch.id)
      for (const id of [...branch.products, ...branch.next]) assert(nodes.has(id), 'Unknown branch target: ' + id)
    }
  }
}
const currentCaseIds = ['real-alarm-0430', 'real-warning-0523', 'real-tracking-exhaust-baseline', 'real-health-c4-baseline']
assert.deepEqual(cases.map(item => item.id), currentCaseIds)
for (const item of cases) {
  assert(['alarm', 'warning', 'tracking'].includes(item.viewId))
  for (const step of item.steps) {
    assert(nodes.has(step.stageId), 'Unknown case stage: ' + step.stageId)
    if (step.selectedBranchId) assert(nodes.has(step.selectedBranchId))
    for (const id of step.productIds ?? []) assert(nodes.has(id), 'Unknown case product: ' + id)
  }
}
assert.equal(template.split('__MAP_DATA__').length, 2, 'Template must contain one data placeholder')
const html = template.replace('__MAP_DATA__', JSON.stringify(data).replaceAll('</', '<\\/'))
assert(!/<(?:script|img|iframe|audio|video)\b[^>]*\bsrc\s*=/i.test(html), 'Map unexpectedly loads an external resource')
assert(!/<link\b[^>]*\bhref\s*=/i.test(html), 'Map unexpectedly loads external styles')
if (process.argv.includes('--check')) {
  assert.equal(await readFile(output, 'utf8'), html, 'Published map is stale: run node scripts/build-information-map.mjs')
  assert.equal(await readFile(repositoryDoc, 'utf8'), html, 'Repository documentation map is stale')
  if (process.argv.includes('--sync-workspace-doc')) assert.equal(await readFile(workspaceDoc, 'utf8'), html, 'Workspace documentation map is stale')
} else {
  await mkdir(path.dirname(output), { recursive: true })
  await writeFile(output, html, 'utf8')
  await writeFile(repositoryDoc, html, 'utf8')
  if (process.argv.includes('--sync-workspace-doc')) await writeFile(workspaceDoc, html, 'utf8')
}
console.log(JSON.stringify({
  mode: process.argv.includes('--check') ? 'verified' : 'generated',
  file: output,
  repositoryDoc,
  nodes: nodes.size,
  views: views.size,
  cases: cases.length,
  sourceEvents: new Set(cases.map((item) => item.sourceEventId)).size,
  informationLayers: layers,
  confirmedTaskTypes: Object.keys(taskTypes).length,
  workspaceDocSynced: process.argv.includes('--sync-workspace-doc'),
  bytes: Buffer.byteLength(html),
}, null, 2))
