import { shipInfo, mockDevices } from './devices'
import { operationAssessment } from './phase2SituationContent'

const action = (id, label) => ({ id, label })
const mainEntry = action('device', '查看主机设备态势')
const now = () => new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })

function currentMatters(store) {
  const review = operationAssessment(store)
  const cooling = store.isTaskHandled('fault')
    ? `冷却系统人工处理已完成，${store.getObservationResult('fault').title}；最新出口温度${review.readings.fault[0]}°C、流量${review.readings.fault[1]} m³/h。`
    : `冷却系统出口温度92.4°C、流量68.2 m³/h，温升与流量下降同时出现；已有关联待办，当前为${store.cases.fault.stages[store.progress.fault].label}。`
  const cylinder = store.isTaskHandled('drift')
    ? `3#缸人工处理已完成，${store.getObservationResult('drift').title}。`
    : store.todoCreated.drift
      ? `3#缸已关联检查待办，${store.progress.drift < 2 ? '正在核实异动是否真实' : '异常已确立，按任务链排查与处置'}。`
      : store.monitorStep.drift
        ? '3#缸反复偏差在新增可比片段中扩大；需要核实现场读数和现象，尚未建立事件。'
        : '3#缸相对偏差反复出现，暂由系统比较。'
  const bearing = store.isTaskHandled('maintenance')
    ? `轴承人工保养已完成，${store.getObservationResult('maintenance').title}；持续效果在设备态势跟踪。`
    : store.todoCreated.maintenance
      ? `轴承提前维保建议已关联待办，当前为${store.cases.maintenance.stages[store.progress.maintenance].label}。`
      : '轴承近7日振动2.1→3.0 mm/s，距周期检修约140运行小时；约48小时后的靠港窗口可评估提前检查，尚未确认换件。'
  return { cooling, cylinder, bearing }
}

function otherDevices() {
  const metric = (id, label) => mockDevices.find(device => device.id === id)?.metrics.find(item => item.label === label)
  const oil = metric('steering-gear', '油温')
  const air = metric('air-compressor', '排气')
  const level = metric('boiler', '水位')
  const pressure = metric('boiler', '压力')
  return `舵机油温${oil.value}${oil.unit}，现有设备状态标为异常，需结合油路与负荷核实；空压机排气压力${air.value}${air.unit}，保持关注；锅炉水位${level.value}${level.unit}、压力${pressure.value}${pressure.unit}，当前状态正常。其余接入设备按各自监测状态持续跟踪。`
}

export function shipOverviewConversation(store) {
  const matters = currentMatters(store)
  const pending = store.visibleTodos.filter(todo => !store.isTaskHandled(todo.id)).length
  return {
    role: 'assistant', kind: 'scene', title: '船舶运行概况', demoLabel: '全船运行回顾', at: '当前运行窗口',
    paragraphs: [
      { label: '运行情况', text: `${shipInfo.name}当前航行中，航速${shipInfo.speed} kn、航向${shipInfo.heading}°，主机转速450 rpm。接入${shipInfo.onlineDevices}/${shipInfo.totalDevices}台设备，当前重点展示主机、舵机、空压机和锅炉。` },
      { label: '主机监测回顾', text: matters.cooling + matters.cylinder + '4#缸反复偏差由系统跟踪，2#缸原偏差收敛后已结束；压力与机体振动为普通数据，不计入关注。' },
      { label: '其他设备监测回顾', text: otherDevices() },
      { label: '建议与处理安排', text: `${pending ? `当前有${pending}项未处理待办，优先跟进已明确需要人工处理的事项。` : '当前已建待办的人工处理均已完成，持续效果由设备态势验证。'}${matters.bearing}` }
    ],
    question: '想先查看主机的具体变化，还是了解当前需要人工跟进的事项？',
    actions: [mainEntry, action('ask:当前哪些事项需要人工跟进？', '哪些需要人工跟进'), action('ask:为什么建议提前维保？', '提前维保依据')]
  }
}

export function shipSituationReply(store, text) {
  const matters = currentMatters(store)
  const base = { role: 'assistant', kind: 'scene', at: now() }
  if (/维保|轴承|1#缸/.test(text)) return {
    ...base, title: '提前维保建议的依据', paragraphs: [
      { label: '当前材料', text: matters.bearing },
      { label: '判断逻辑', text: '振动持续上行与周期临近共同支持提前核验，但趋势不能直接证明磨损。先核验可比工况、测点及润滑，再结合现场检查决定是否提前保养。' },
      { label: '下一步', text: '进入轴承建议查看完整材料和常规计划。是否建立检查待办、是否保养换件，在对应事项内由人员确认。' }
    ], actions: [action('item:maintenance', '查看轴承维保建议'), mainEntry]
  }
  if (/人工|处理|待办|优先/.test(text)) return {
    ...base, title: '当前需要人工跟进的事项', paragraphs: [
      { label: '已关联待办', text: matters.cooling },
      { label: '3#缸关注', text: matters.cylinder },
      { label: '维保安排', text: matters.bearing }
    ], question: '先进入对应事项核对证据与当前阶段，再确认检查或处理安排。',
    actions: [action(store.isTaskHandled('fault') ? 'item:fault' : 'todo:fault', store.isTaskHandled('fault') ? '查看冷却系统效果观察' : '跟进冷却系统待办'), action('item:drift', '查看3#缸异动跟踪材料')]
  }
  if (/舵机|空压|锅炉|设备|监测|回顾/.test(text)) return {
    ...base, title: '重点设备监测回顾', paragraphs: [
      { label: '主机', text: matters.cooling + matters.cylinder },
      { label: '舵机、空压机与锅炉', text: otherDevices() },
      { label: '跟踪方式', text: '设备状态提示与已确认的故障原因分别保留。主机的同工况比较、每日观察和现场反馈，可进入设备态势查看；本轮全船回顾不代替现场确认。' }
    ], actions: [mainEntry, action('ask:当前哪些事项需要人工跟进？', '查看人工跟进事项')]
  }
  return { ...shipOverviewConversation(store), at: now(), title: '船舶运行情况与建议' }
}
