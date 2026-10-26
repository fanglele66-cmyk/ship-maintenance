import fixtures from './fourStoryFixtures.json' with {type: 'json'}
import {realWorkflowCases, realHealthTracks, realCaseFor} from './realCaseAdapter.js'
import {eventBriefingFor} from './eventBriefings.js'

const maintenance = realWorkflowCases.find(item => item.id === 'real-maintenance-c4-baseline')
const source = realCaseFor(maintenance.id)
const first = source.steps?.[0]
export const healthTrackingSources = [
  ...fixtures.tracking.map(track => track.id === 'bearing-health'
    ? {...track, requestId: 'bearing-health'} : track),
  ...realHealthTracks,
  {
    id: 'real-health-c4-baseline-track', requestId: 'real-health-c4-baseline',
    recommendationId: maintenance.id, sourceCaseId: maintenance.id,
    realCaseId: maintenance.realCaseId, sourceEventId: source.sourceEventId,
    relatedIssueIds: [], deviceId: maintenance.deviceId, device: maintenance.device,
    title: '四缸排温相对基线下移跟踪', status: '已形成专项检查评估建议',
    conclusion: maintenance.report.conclusion,
    next: '结合月度相对偏差、运行分布与现场核验，评估测温或燃烧专项检查必要性及实施窗口。',
    nodes: first ? [{
      label: first.title, at: first.time || source.timeRange?.start,
      values: first.summary, context: '1—8 月六缸同刻配对样本；四缸相对基线在 6 月下移。',
      judgement: '相对降温不等于已确认燃烧故障；本次建议先核对必要性与作业条件。',
    }] : [],
  },
]

export const trackingContainerCases = ['bearing-health', 'real-health-c4-baseline'].map(id => {
  const track = healthTrackingSources.find(item => item.requestId === id)
  const child = id === 'bearing-health' ? fixtures.cases.find(item => item.id === 'maintenance') : maintenance
  const brief=eventBriefingFor(id)
  return {
    ...child, id, eventId: id, cardType: '异动跟踪', workflowKind: 'health-tracking',
    isTrackingContainer: true, trackingOnly: true,
    legacyScenario: id === 'bearing-health', latent: id === 'bearing-health',
    sourceCaseId: child.id, sourceEventId: track.sourceEventId,
    relatedIssueIds: track.relatedIssueIds || [],
    initialTitle: track.title, eventTitle: track.title,
    discovery:brief?.discovery||child.discovery, source:brief?.discovery.label||child.source,
    decisionLimit:brief?.boundary||child.decisionLimit,
    report: {...child.report, conclusion: brief?.conclusion||track.conclusion, human: brief?brief.captainDecision+' '+brief.dispatchReason:track.next},
    stages: [{id: 'intro', kind: 'intro', label: '健康趋势观测', title: track.title,
      summary: track.conclusion, evidence: track.nodes.map(node => node.values), tasks: []}],
    pageContent: {
      overview: `### 健康趋势观测\n\n${track.conclusion}\n\n### 后续安排\n\n${track.next}`,
      analysis: brief?child.pageContent.analysis:track.nodes.map(node => `### ${node.label}\n\n${node.values}\n\n${node.context}\n\n${node.judgement}`).join('\n\n'),
      evidence: child.pageContent?.evidence || '原趋势、周期计划与现场反馈分别保留；建议不等于实际执行。',
    },
  }
})
