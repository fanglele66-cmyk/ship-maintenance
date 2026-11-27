import test from 'node:test'
import assert from 'node:assert/strict'
import {mkdtemp, readFile, readdir, rm, writeFile} from 'node:fs/promises'
import {join} from 'node:path'
import {tmpdir} from 'node:os'
import {createEventRepository} from '../server/event-repository.mjs'
import {parseReportPatch} from '../server/model.mjs'
import {createLifecycleState, currentTask, decide, people, submitTask, makeReport} from '../src/workflow/eventLifecycle.js'
import {formalEventReports} from '../src/workflow/reportArtifacts.js'
import {normalizeTaskPlan} from '../src/workflow/taskPlanning.js'
import {taskEditContract, applyTaskEditOperations} from '../src/workflow/taskEdits.js'

const example = (skill, file) => readFile(new URL(`../.claude/skills/${skill}/template/${file}.example.json`, import.meta.url), 'utf8')

test('skill examples pass the production plan, edit and report contracts and reproduce the standalone report', async () => {
  const plan = normalizeTaskPlan(JSON.parse(await example('ship-event-workflow', 'plan')), 'investigate')
  const {operations} = JSON.parse(await example('ship-event-workflow', 'edit'))
  const edit = applyTaskEditOperations(plan, taskEditContract(plan, '修改第1项回交要求'), operations, 'investigate')
  assert.equal(edit.plan.steps[0].recordHint, operations[0].changes.recordHint)
  const patch = parseReportPatch(await example('ship-report-generation', 'patch'))
  const report = JSON.parse(await example('ship-report-generation', 'report'))
  assert.deepEqual(report.submissionSnapshot.steps, plan.steps)
  const event = {id:report.eventId, number:report.eventNumber, title:'控制空气压力核对', type:'预警事件', reports:[]}
  const generatedReport = {patch, model:report.generatedBy, at:report.generatedAt, sources:[]}
  const actual = makeReport(event, {...report.submissionSnapshot, generatedReport}, report.id)
  assert.deepEqual(JSON.parse(JSON.stringify(actual)), report)
})

test('formal and frozen shore reports are individually exported and recovered, with original photo sources', async t => {
  const directory = await mkdtemp(join(tmpdir(), 'ship-report-artifacts-'))
  let repository = await createEventRepository(directory)
  t.after(async () => { await repository.close(); await rm(directory, {recursive:true, force:true}) })
  const state = createLifecycleState(), event = state.events['real-alarm-0430']
  decide(state, event.id, {action:'investigate', owner:people.engineer, deadline:new Date(Date.now()+86400000).toISOString()})
  state.role = 'engineer'
  const task = currentTask(event)
  const photo = {id:'photo-1', name:'核对记录.jpg', contentHash:'test', storage:'server'}
  for (const row of task.draft.records) row.result = '未见异常'
  task.draft.records[0].photos = [photo]
  task.conversations ||= {captain:[], engineer:[]}
  task.conversations.engineer.push({kind:'user', stepIndex:0, originalPhotos:[photo], at:new Date().toISOString()})
  const report = submitTask(state, event.id, task.id)
  const at = report.at
  event.shore.push({id:'outbound-1', at, owner:people.captain, syncedReport:{...structuredClone(report), markdown:'冻结的上报正文'}})
  event.reports.push({...structuredClone(report), id:'linked-copy', linkedSource:true})
  const first = await repository.save(event)
  const path = name => join(repository.folder(event.id), 'reports', 'r-' + name + '.json')
  const read = async name => JSON.parse(await readFile(path(name), 'utf8'))
  assert.deepEqual(await read(report.id), report)
  assert.deepEqual((await read(report.id)).submissionSnapshot.records[0].photos[0].sources, ['form','chat'])
  assert.equal((await read('outbound-1')).markdown, '冻结的上报正文')
  assert.equal((await read('outbound-1')).id, 'outbound-1')
  await assert.rejects(read('linked-copy'), {code:'ENOENT'})
  const changed = repository.get(event.id)
  changed.reports[0].summary = '已由提交人确认补充'
  const saved = await repository.save(changed, {expected:first.serverRevision})
  assert.equal((await read(report.id)).summary, changed.reports[0].summary)
  await assert.rejects(repository.save(first, {expected:first.serverRevision}), {status:409})
  assert.equal((await read('outbound-1')).markdown, '冻结的上报正文')
  await repository.close()
  await rm(path(report.id))
  await writeFile(path('outbound-1'), '旧文件', 'utf8')
  repository = await createEventRepository(directory)
  assert.equal(repository.get(event.id).serverRevision, saved.serverRevision)
  for (const expected of formalEventReports(saved)) assert.deepEqual(await read(expected.id), expected)
  const files = await readdir(join(repository.folder(event.id), 'reports'))
  assert.equal(files.length, 2)
  assert.deepEqual(JSON.parse(await readFile(join(repository.folder(event.id),'reports.json'),'utf8')), saved.reports)
})

test('archive I/O failure preserves a completed submission and a later open rebuilds it', async t => {
  const directory = await mkdtemp(join(tmpdir(), 'ship-report-recovery-'))
  let repository = await createEventRepository(directory)
  t.after(async () => { await repository.close(); await rm(directory, {recursive:true, force:true}) })
  const {events} = createLifecycleState(), event = events['real-alarm-0430']
  const saved = await repository.save(event)
  const reportsDir = join(repository.folder(event.id),'reports')
  await writeFile(reportsDir, 'simulated file conflict')
  const warn = t.mock.method(console, 'warn', () => {})
  event.reports.push({id:'recovery', eventId:event.id, kind:'排查报告', markdown:'已回交记录'})
  const updated = await repository.save(event, {expected:saved.serverRevision})
  assert.equal(updated.serverRevision, saved.serverRevision + 1)
  assert.equal(warn.mock.callCount(), 1)
  await repository.close()
  await rm(reportsDir)
  repository = await createEventRepository(directory)
  assert.deepEqual(JSON.parse(await readFile(join(reportsDir,'r-recovery.json'),'utf8')), event.reports[0])
  assert.equal(repository.get(event.id).serverRevision, updated.serverRevision)
})
