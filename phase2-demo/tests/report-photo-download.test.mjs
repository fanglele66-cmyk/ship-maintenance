import test from 'node:test'
import assert from 'node:assert/strict'
import {crc32} from 'node:zlib'
import {buildPhotoReportZip} from '../src/workflow/downloadReport.js'

// Read entries from the central directory and independently validate both lengths and CRCs.
function readEntries(buffer) {
  const end = buffer.length - 22
  assert.equal(buffer.readUInt32LE(end), 0x06054b50)
  const entries = new Map()
  let position = buffer.readUInt32LE(end + 16)
  for (let i = 0; i < buffer.readUInt16LE(end + 10); i++) {
    assert.equal(buffer.readUInt32LE(position), 0x02014b50)
    assert.equal(buffer.readUInt16LE(position + 8), 0x800)
    const nameLen = buffer.readUInt16LE(position + 28)
    const name = buffer.toString('utf8', position + 46, position + 46 + nameLen)
    const local = buffer.readUInt32LE(position + 42)
    assert.equal(buffer.readUInt32LE(local), 0x04034b50)
    const start = local + 30 + buffer.readUInt16LE(local + 26)
    const bytes = buffer.subarray(start, start + buffer.readUInt32LE(position + 24))
    assert.equal(crc32(bytes), buffer.readUInt32LE(position + 16))
    entries.set(name, bytes)
    position += 46 + nameLen
  }
  return entries
}

test('photo ZIP contains offline links, exact originals and distinct files for duplicate names, and missing originals fail the entire export', async () => {
  const name = '燃油泵 (1)[现场].png'
  const first = {name, contentHash: 'raw1', sources: ['form', 'chat']}
  const second = {name, contentHash: 'raw2', sources: ['chat'], dataUrl: 'data:image/png;base64,AAECAw=='}
  const report = {markdown: '# 维修报告\n\n核对接头', submissionSnapshot: {records: [
    {label:'检查',photos:[first,second]}, {label:'复核',photos:[first]}
  ]}}
  const raw = Buffer.from([255, 216, 255, 98, 0, 172])
  let reads = 0
  const archive = await buildPhotoReportZip(report, '维修报告', async () => {reads++; return new Blob([raw])})
  const entries = readEntries(Buffer.from(await archive.arrayBuffer()))
  assert.equal(reads, 1)
  assert.equal(entries.size, 3)
  assert.deepEqual(entries.get('现场照片/01-' + name), raw)
  assert.deepEqual(entries.get('现场照片/02-' + name), Buffer.from([0, 1, 2, 3]))
  const md = entries.get('维修报告.md').toString()
  assert.match(md, /核对接头/)
  assert.match(md, /第 1 步「检查」 · 步骤备注、助手对话；第 2 步「复核」/)
  const links = [...md.matchAll(/!\[.*?\]\(<(.*?)>\)/g)].map(m => decodeURIComponent(m[1]))
  assert.deepEqual(links, ['现场照片/01-' + name, '现场照片/02-' + name])
  await assert.rejects(buildPhotoReportZip(report, '报告', async () => {throw Error('照片读取失败')}), /无法读取.*照片读取失败/)
})
