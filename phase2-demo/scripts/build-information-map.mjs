import assert from 'node:assert/strict'
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const sourceRoot = path.join(appRoot, 'docs', 'information-map')
const output = path.join(appRoot, 'public', 'information-map.html')
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
const nodes = new Map(data.nodes.map((node) => [node.id, node]))
const views = new Map(data.views.map((view) => [view.id, view]))
assert.equal(nodes.size, data.nodes.length, 'Duplicate map node IDs')
assert.deepEqual(data.branchFlows.map((flow) => flow.id), ['alarm', 'warning', 'tracking'])
assert(!views.has('maintenance'), 'Maintenance must remain inside tracking')
const layers = ['raw', 'processing', 'scenario', 'event', 'task', 'result']
assert.deepEqual(data.informationLayers.map((layer) => layer.id), layers)
const taskTypes = { 'task-alarm': 'alarm', 'task-warning': 'warning', 'task-tracking': 'tracking', 'task-maintenance': 'tracking' }
for (const [id, type] of Object.entries(taskTypes)) {
  assert.equal(nodes.get(id).sourceEventType, type, `Wrong source event for ${id}`)
  assert.equal(nodes.get(id).creationGate, 'triage-dispatch', `${id} needs confirmed dispatch`)
  assert.deepEqual(nodes.get(id).sources, ['triage-dispatch'], `${id} bypasses confirmed dispatch`)
}
assert.deepEqual(nodes.get('triage-dispatch').outputs, Object.keys(taskTypes))
assert(nodes.get('task-progress').fields.some((field) => field.name === '创建门槛'))
assert.deepEqual(nodes.get('state-issue-decision').fields.map((field) => field.name), ['待决策', '处置中', '已闭环'])
for (const [removed, merged] of Object.entries(data.nodeAliases)) {
  assert(!nodes.has(removed), `Merged node still exists: ${removed}`)
  assert(nodes.has(merged), `Missing canonical merged node: ${merged}`)
}
for (const id of ['step-alarm-find', 'step-warning-find']) {
  assert.equal(nodes.get(id).layer, 'event', `Pre-dispatch event formation cannot be a task: ${id}`)
}
// No measurement-backed scene can bypass the standardized mapped-point result.
function hasUnmappedSensorPath(id, seen = new Set()) {
  if (id === 'sample') return true
  if (id === 'mapped-samples' || seen.has(id)) return false
  seen.add(id)
  return (nodes.get(id)?.sources ?? []).some((source) => hasUnmappedSensorPath(source, seen))
}
const oldPageContainers = new Set(['ship-page', 'device-page', 'device-health', 'ship-assessment', 'todo-board', 'knowledge-view', 'health-track', 'plan-relation'])
for (const node of nodes.values()) {
  for (const id of [...node.sources, ...(node.related ?? []), ...(node.outputs ?? [])]) {
    assert(nodes.has(id), `Unknown node reference ${node.id} -> ${id}`)
  }
}
for (const view of views.values()) {
  assert.deepEqual(view.columns.map((column) => column.layer), layers, `Wrong layer order in ${view.id}`)
  for (const column of view.columns) {
    for (const group of column.groups) {
      for (const id of group.ids) {
        assert(nodes.has(id), `Unknown displayed node ${id}`)
        const node = nodes.get(id)
        assert.equal(node.layer, column.layer, `${view.id}: ${id} is in the wrong information layer`)
        if (column.layer === 'scenario') {
          assert(!node.sources.some((source) => nodes.get(source)?.layer === 'raw'), `${id} directly reads raw sources`)
          assert(!hasUnmappedSensorPath(id), `${id} bypasses mapped sensor data`)
        }
        if (column.layer === 'result') assert(!oldPageContainers.has(id), `Old page container in result layer: ${id}`)
      }
    }
  }
  const reaches = (from, target, seen = new Set()) => {
    if (from === target) return true
    if (seen.has(from)) return false
    seen.add(from)
    return (view.edges ?? []).filter((edge) => edge.from === from).some((edge) => reaches(edge.to, target, seen))
  }
  if (['overview', 'ship', 'device', 'states'].includes(view.id)) {
    for (const type of ['alarm', 'warning', 'tracking']) assert(reaches(type, 'triage'), `${view.id}: visible ${type} -> triage path is broken`)
  }
  if (['alarm', 'warning'].includes(view.id)) assert(reaches(view.id, `step-${view.id}-decision`), `${view.id}: visible decision path is broken`)
  assert(reaches('sample', 'mapped-samples'), `${view.id}: raw input bypasses preprocessing`)
  assert(reaches('mapped-samples', 'sample-quality'), `${view.id}: preprocessing to quality path is broken`)
  assert(reaches('sample-quality', 'time-features'), `${view.id}: quality to statistics path is broken`)
  const types = ['alarm', 'warning', 'tracking'].includes(view.id) ? [view.id] : ['alarm', 'warning', 'tracking']
  for (const type of types) {
    const gate = types.length === 1 ? `branch-${type}-dispatch` : 'triage-dispatch'
    assert(reaches(type, gate), `${view.id}: ${type} cannot reach a dispatch confirmation`)
    assert(reaches(gate, `task-${type}`), `${view.id}: confirmed dispatch cannot create ${type} task`)
    assert(reaches(`task-${type}`, 'task-progress'), `${view.id}: task cannot reach merged progress record`)
    assert(reaches(`task-${type}`, `result-${type}`), `${view.id}: task result is disconnected`)
  }
  if (view.id === 'tracking') {
    assert(reaches('tracking', 'branch-maintenance-dispatch'))
    assert(reaches('branch-maintenance-dispatch', 'task-maintenance'))
    assert(reaches('task-maintenance', 'result-maintenance'))
  }
}
for (const flow of data.branchFlows) {
  const view = views.get(flow.id)
  const displayed = new Set(view.columns.flatMap((column) => column.groups.flatMap((group) => group.ids)))
  for (const group of flow.groups) {
    assert(displayed.has(group.stageId), `Stage is not displayed: ${group.stageId}`)
    for (const branch of group.branches) {
      assert(displayed.has(branch.id), `Branch is not displayed: ${branch.id}`)
      for (const id of [...(branch.next ?? []), ...(branch.products ?? [])]) {
        assert(nodes.has(id), `Unknown branch target ${id}`)
      }
    }
  }
}
for (const item of cases) {
  assert(['alarm', 'warning', 'tracking'].includes(item.viewId), `Unsupported event type ${item.viewId}`)
  for (const step of item.steps) {
    assert(nodes.has(step.stageId), `Unknown case stage ${step.stageId}`)
    if (step.selectedBranchId) assert(nodes.has(step.selectedBranchId), `Unknown case branch ${step.selectedBranchId}`)
    for (const id of step.productIds ?? []) assert(nodes.has(id), `Unknown case product after node merge: ${id}`)
  }
}
assert.equal(template.split('__MAP_DATA__').length, 2, 'Template must contain one data placeholder')
const html = template.replace('__MAP_DATA__', JSON.stringify(data).replaceAll('</', '<\\/'))
assert(!/<(?:script|img|iframe|audio|video)\b[^>]*\bsrc\s*=/i.test(html), 'Map unexpectedly loads an external resource')
assert(!/<link\b[^>]*\bhref\s*=/i.test(html), 'Map unexpectedly loads external styles')
if (process.argv.includes('--check')) {
  assert.equal(await readFile(output, 'utf8'), html, 'Published map is stale: run node scripts/build-information-map.mjs')
  if (process.argv.includes('--sync-workspace-doc')) assert.equal(await readFile(workspaceDoc, 'utf8'), html, 'Workspace documentation map is stale')
} else {
  await mkdir(path.dirname(output), { recursive: true })
  await writeFile(output, html, 'utf8')
  if (process.argv.includes('--sync-workspace-doc')) await writeFile(workspaceDoc, html, 'utf8')
}
console.log(JSON.stringify({
  mode: process.argv.includes('--check') ? 'verified' : 'generated',
  file: output,
  nodes: nodes.size,
  views: views.size,
  cases: cases.length,
  sourceEvents: new Set(cases.map((item) => item.sourceEventId)).size,
  informationLayers: layers,
  confirmedTaskTypes: Object.keys(taskTypes).length,
  workspaceDocSynced: process.argv.includes('--sync-workspace-doc'),
  bytes: Buffer.byteLength(html),
}, null, 2))
