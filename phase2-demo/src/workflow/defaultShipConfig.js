function buildDefaultPoints(deviceType) {
  return deviceType.points.map((point) => ({
    pointCode: point.pointCode,
    enabled: true,
    instanceName: point.defaultName,
    normalMin: point.normalRange?.min ?? null,
    normalMax: point.normalRange?.max ?? null,
    note: ''
  }))
}

export function createDefaultShipConfig(template, nowIso = new Date().toISOString()) {
  const rtFlex = template.deviceTypes[0]
  if (!rtFlex) throw new Error('设备类型模板为空。')
  return {
    schemaVersion: '1.0.0',
    shipName: '长航碧玉',
    updatedAt: nowIso,
    updatedBy: 'system',
    devices: [
      {
        id: 'main-engine-1',
        name: '主机',
        code: 'ME-01',
        deviceTypeId: rtFlex.deviceTypeId,
        enabled: true,
        isBuiltin: true,
        alarms: {
          oem: {
            enabled: true,
            updatedAt: nowIso,
            updatedBy: 'system',
            note: 'OEM 硬件报警触发后进入大模型分析研判并决定是否生成事件会话'
          },
          aiPeriodic: {
            enabled: true,
            intervalMinutes: 60,
            updatedAt: nowIso,
            updatedBy: 'system',
            note: '按周期运行 AI 异常检测并生成预警事件'
          },
          anomalyTracking: {
            enabled: true,
            windowMonths: 3,
            granularity: 'weekly',
            updatedAt: nowIso,
            updatedBy: 'system',
            note: '对多月运行数据开展长期偏移跟踪与异动跟踪报警'
          }
        },
        points: buildDefaultPoints(rtFlex)
      },
      {
        id: 'aux-system',
        name: '辅机',
        code: 'AE-01',
        deviceTypeId: rtFlex.deviceTypeId,
        enabled: true,
        isBuiltin: true,
        alarms: {
          oem: {
            enabled: false,
            updatedAt: nowIso,
            updatedBy: 'system',
            note: '当前关闭大模型研判接入，仅保留底层原始记录'
          },
          aiPeriodic: {
            enabled: true,
            intervalMinutes: 60,
            updatedAt: nowIso,
            updatedBy: 'system',
            note: '按周期运行 AI 异常检测并生成预警事件'
          },
          anomalyTracking: {
            enabled: false,
            windowMonths: 3,
            granularity: 'weekly',
            updatedAt: nowIso,
            updatedBy: 'system',
            note: '暂未开启长期异动跟踪报警'
          }
        },
        points: buildDefaultPoints(rtFlex)
      }
    ]
  }
}
