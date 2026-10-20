import fixtures from './fourStoryFixtures.json' with {type: 'json'}
import {realWorkflowCases, realHealthTracks, realCaseFor} from './realCaseAdapter.js'

const maintenance = realWorkflowCases.find(item => item.id === 'real-maintenance-0523')
const source = realCaseFor(maintenance.id)
const first = source.steps?.[0]
export const healthTrackingSources = [
  ...fixtures.tracking.map(track => track.id === 'bearing-health'
    ? {...track, requestId: 'bearing-health'} : track),
  ...realHealthTracks,
  {
    id: 'real-health-0523-track', requestId: 'real-health-0523',
    recommendationId: maintenance.id, sourceCaseId: maintenance.id,
    realCaseId: maintenance.realCaseId, sourceEventId: source.sourceEventId,
    relatedIssueIds: ['real-warning-0523'], deviceId: maintenance.deviceId, device: maintenance.device,
    title: '0523｜控制空气临修后健康跟踪', status: '已形成后续检查建议',
    conclusion: maintenance.report.conclusion,
    next: '保留临时恢复与永久措施的区别，结合后续观测评估检查必要性、备件与窗口。',
    nodes: first ? [{
      label: first.title, at: first.time || source.timeRange?.start,
      values: first.summary, context: '0523 同一设备问题的后续资料，不另计一起故障。',
      judgement: '临时恢复不证明永久修复；本次建议仍需核对必要性与作业条件。',
    }] : [],
  },
]

export const trackingContainerCases = ['bearing-health', 'real-health-0523'].map(id => {
  const track = healthTrackingSources.find(item => item.requestId === id)
  const child = id === 'bearing-health' ? fixtures.cases.find(item => item.id === 'maintenance') : maintenance
  return {
    ...child, id, eventId: id, cardType: '异动跟踪', workflowKind: 'health-tracking',
    isTrackingContainer: true, trackingOnly: true,
    legacyScenario: id === 'bearing-health', latent: id === 'bearing-health',
    sourceCaseId: child.id, sourceEventId: track.sourceEventId,
    relatedIssueIds: track.relatedIssueIds || [],
    initialTitle: track.title, eventTitle: track.title,
    report: {...child.report, conclusion: track.conclusion, human: track.next},
    stages: [{id: 'intro', kind: 'intro', label: '健康趋势观测', title: track.title,
      summary: track.conclusion, evidence: track.nodes.map(node => node.values), tasks: []}],
    pageContent: {
      overview: `### 健康趋势观测\n\n${track.conclusion}\n\n### 后续安排\n\n${track.next}`,
      analysis: track.nodes.map(node => `### ${node.label}\n\n${node.values}\n\n${node.context}\n\n${node.judgement}`).join('\n\n'),
      evidence: child.pageContent?.evidence || '原趋势、周期计划与现场反馈分别保留；建议不等于实际执行。',
    },
  }
})
