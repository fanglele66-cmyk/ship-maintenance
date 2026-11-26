import {reportMarkdown} from './reportPresentation.js'
import {photoSourceLabels, reportPhotoEntries} from './stepPhotoEvidence.js'
import {readStepPhoto} from '../services/stepPhotoFiles.js'
import {reportZip} from './reportZip.js'

const markdownType = 'text/markdown;charset=utf-8'
const filename = value => value.replace(/[\\/:*?"<>|\u0000-\u001f]/g, '-').replace(/[. ]+$/g, '')

function download(blob, name) {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = name
  anchor.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export async function buildPhotoReportZip(report, reportName, readOriginal = readStepPhoto) {
  const files = [], links = []
  for (const photo of reportPhotoEntries(report.submissionSnapshot?.records || [])) {
    const number = String(files.length + 1).padStart(2, '0')
    const name = filename(photo.name || '现场照片') || '现场照片'
    let blob
    try {
      if (photo.dataUrl && /^data:image\/(?:jpeg|png|webp);base64,/i.test(photo.dataUrl)) {
        blob = await (await fetch(photo.dataUrl)).blob()
      } else {
        blob = await readOriginal(photo)
      }
      if (!blob?.size) throw Error('文件为空。')
    } catch (error) {
      throw Error('无法读取「' + name + '」：' + error.message)
    }
    const path = '现场照片/' + number + '-' + name
    files.push({path, blob})
    const uses = photo.uses.map(use => '第 ' + (use.index + 1) + ' 步「' + use.label + '」 · ' +
      use.sources.map(source => photoSourceLabels[source]).join('、')).join('；')
    const alt = name.replace(/[[\]\\]/g, '\\$&')
    const href = path.split('/').map(encodeURIComponent).join('/')
    links.push(uses + '\n\n![' + alt + '](<' + href + '>)')
  }
  const text = reportMarkdown(report).trimEnd() + '\n\n## 现场照片原件\n\n' + links.join('\n\n') + '\n'
  files.unshift({path: reportName + '.md', blob: new Blob([text], {type: markdownType})})
  return reportZip(files)
}

export async function downloadReportMarkdown(report) {
  if (!report) return
  const name = filename(report.number || report.title || '任务报告') || '任务报告'
  if (!reportPhotoEntries(report.submissionSnapshot?.records || []).length) {
    download(new Blob([reportMarkdown(report)], {type: markdownType}), name + '.md')
    return
  }
  download(await buildPhotoReportZip(report, name), name + '.zip')
}
