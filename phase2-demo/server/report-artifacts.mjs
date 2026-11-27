import {createHash, randomUUID} from 'node:crypto'
import {mkdir, readFile, readdir, rename, rm, writeFile} from 'node:fs/promises'
import {join} from 'node:path'
import {formalEventReports} from '../src/workflow/reportArtifacts.js'

function reportFileName(id) {
  // Lowercase generated IDs are legible on both Windows and Linux. Older or
  // nonstandard IDs retain their exact value in the JSON and cannot form paths.
  if (/^[a-z0-9][a-z0-9_-]{0,139}$/.test(id)) return 'r-' + id + '.json'
  return 'x-' + createHash('sha256').update(id).digest('hex') + '.json'
}

export async function exportReportFiles(eventDirectory, event) {
  const directory = join(eventDirectory, 'reports')
  const reports = formalEventReports(event).filter(report => typeof report.id === 'string' && report.id)
  let existing
  try {
    existing = await readdir(directory)
  } catch (error) {
    if (error.code !== 'ENOENT') throw error
    if (!reports.length) return
    await mkdir(directory, {recursive: true})
    existing = []
  }
  const stale = new Set(existing.filter(name => /^(?:r-[a-z0-9][a-z0-9_-]{0,139}|x-[a-f0-9]{64})\.json$/.test(name)))
  for (const report of reports) {
    const name = reportFileName(report.id)
    const path = join(directory, name)
    const json = JSON.stringify(report, null, 2)
    if (stale.delete(name) && await readFile(path, 'utf8') === json) continue
    const temporary = join(directory, randomUUID() + '.tmp')
    try {
      await writeFile(temporary, json, 'utf8')
      await rename(temporary, path)
    } finally {
      await rm(temporary, {force: true})
    }
  }
  for (const name of stale) await rm(join(directory, name), {force: true})
}
