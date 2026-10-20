import assert from 'node:assert/strict'
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const sourceRoot = path.join(appRoot, 'docs', 'information-map')
const output = path.join(appRoot, 'public', 'information-map.html')
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
const cases = model.casePresentation.entries.map(({ sourceId, overrides = {} }) => {
  const source = sourceCases.get(sourceId)
  assert(source, `Unknown shared case: ${sourceId}`)
  for (const key of evidenceFields) {
    assert(!Object.hasOwn(overrides, key), `Presentation cannot override historical evidence: ${sourceId}.${key}`)
  }
  const item = { ...structuredClone(source), ...structuredClone(overrides) }
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
for (const node of nodes.values()) {
  for (const id of [...node.sources, ...(node.related ?? []), ...(node.outputs ?? [])]) {
    assert(nodes.has(id), `Unknown node reference ${node.id} -> ${id}`)
  }
}
for (const view of views.values()) {
  for (const column of view.columns) {
    for (const group of column.groups) {
      for (const id of group.ids) assert(nodes.has(id), `Unknown displayed node ${id}`)
    }
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
  }
}
assert.equal(template.split('__MAP_DATA__').length, 2, 'Template must contain one data placeholder')
const html = template.replace('__MAP_DATA__', JSON.stringify(data).replaceAll('</', '<\\/'))
assert(!/<(?:script|img|iframe|audio|video)\b[^>]*\bsrc\s*=/i.test(html), 'Map unexpectedly loads an external resource')
assert(!/<link\b[^>]*\bhref\s*=/i.test(html), 'Map unexpectedly loads external styles')
if (process.argv.includes('--check')) {
  assert.equal(await readFile(output, 'utf8'), html, 'Published map is stale: run node scripts/build-information-map.mjs')
} else {
  await mkdir(path.dirname(output), { recursive: true })
  await writeFile(output, html, 'utf8')
}
console.log(JSON.stringify({
  mode: process.argv.includes('--check') ? 'verified' : 'generated',
  file: output,
  nodes: nodes.size,
  views: views.size,
  cases: cases.length,
  sourceEvents: new Set(cases.map((item) => item.sourceEventId)).size,
  bytes: Buffer.byteLength(html),
}, null, 2))
