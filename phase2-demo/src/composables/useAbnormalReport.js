import { useDeviceStore } from '@/stores/deviceStore'
import { useSensorStore } from '@/stores/sensorStore'
import { useEventStore } from '@/stores/eventStore'

export function useAbnormalReport() {
  const deviceStore = useDeviceStore()
  const sensorStore = useSensorStore()
  const eventStore = useEventStore()

  function createAbnormalEvent(report, sourceAction = '异常报告提交') {
    const sensors = sensorStore.allSensors.filter(sensor => report.sensorIds.includes(sensor.id))
    const primarySensor = sensors[0]
    const device = deviceStore.getDeviceById(report.deviceId)
    const createdAt = report.timeRange?.[1] || new Date().toISOString()
    const eventId = `EVT-RPT-${Date.now()}`

    const event = {
      id: eventId,
      title: `${device?.name || '设备'}${primarySensor ? ` · ${primarySensor.nameCn}` : ''}异常上报`,
      deviceId: report.deviceId,
      system: report.systems.join('、'),
      priority: sensors.some(sensor => sensor.status === 'over') ? 'critical' : 'important',
      status: 'pending',
      createdAt,
      source: 'manual_report',
      description: report.description,
      attachments: report.images,
      abnormalTimeRange: report.timeRange,
      snapshot: {
        sensors: sensors.map(sensor => ({
          name: sensor.nameCn,
          value: sensor.value,
          unit: sensor.unit,
          threshold: sensor.threshold,
          status: sensor.status
        })),
        trendData: primarySensor?.id === sensorStore.selectedSensorId ? sensorStore.currentTrendData : [],
        snapshotTime: createdAt
      },
      aiAnalysis: {
        summary: report.description || `${device?.name || '设备'}的${report.systems.join('、')}出现人工上报异常。`,
        faultTable: [],
        suggestions: '建议结合上报时间段内的趋势数据进行核查，并安排相关设备检查。'
      },
      relatedCases: [],
      timeline: [{ time: new Date().toISOString(), action: sourceAction }]
    }

    eventStore.events.unshift(event)
    return event
  }

  return { createAbnormalEvent }
}
