const timestamp = label => /^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}/.test(String(label))
  ? Date.parse(String(label).replace(' ', 'T')) : NaN

const reading = value => value === null || value === undefined || value === '' || !Number.isFinite(Number(value))
  ? null : Number(value)

export function observationData(series) {
  const labels = series.labels || [], values = series.values || []
  const timed = values.length > 0 && labels.length === values.length && labels.every(label => Number.isFinite(timestamp(label)))
  const points = values.map((value, index) => ({label: String(labels[index] ?? `节点 ${index + 1}`), value: reading(value), time: timed ? timestamp(labels[index]) : index}))
  if (timed) points.sort((a, b) => a.time - b.time)
  return {timed, points, count: points.filter(point => point.value !== null).length}
}

export function observationOption(series, width = 640) {
  const {timed, points, count} = observationData(series)
  const dense = points.length > 12, narrow = width < 560
  const sameDay = timed && points[0].label.slice(0, 10) === points.at(-1).label.slice(0, 10)
  const formatTime = value => {
    const date = new Date(value), pad = n => String(n).padStart(2, '0')
    const time = `${pad(date.getHours())}:${pad(date.getMinutes())}`
    return sameDay ? time : `${pad(date.getMonth() + 1)}-${pad(date.getDate())}\n${time}`
  }
  return {
    animation: false,
    color: ['#936821'],
    grid: {left: 14, right: 22, top: 30, bottom: dense ? 62 : 16, containLabel: true},
    tooltip: {
      trigger: 'axis', triggerOn: 'mousemove|click', confine: true, renderMode: 'richText',
      axisPointer: {type: 'line', snap: true, lineStyle: {color: '#a99068', type: 'dashed'}},
      formatter: params => {
        const item = params[0]?.data
        if (!item) return ''
        const value = timed ? item.value[1] : item.value
        return `${item.originalLabel}\n${value === null ? '无有效采样' : value + (series.unit ? ' ' + series.unit : '')}`
      }
    },
    xAxis: {
      type: timed ? 'time' : 'category',
      ...(timed ? {min: 'dataMin', max: 'dataMax', splitNumber: narrow ? 3 : 6} : {data: points.map(point => point.label), boundaryGap: false}),
      axisLine: {lineStyle: {color: '#dbe3ec'}}, axisTick: {show: false},
      axisLabel: {color: '#748298', fontSize: 11, hideOverlap: true, margin: 12, ...(timed ? {formatter: formatTime} : {width: narrow ? 72 : 110, overflow: 'truncate', interval: 'auto'})},
      splitLine: {show: timed, lineStyle: {color: '#f0f3f7', type: 'dashed'}}
    },
    yAxis: {
      type: 'value', scale: true, splitNumber: 4, name: series.unit || '', nameGap: 14,
      nameTextStyle: {color: '#748298', fontSize: 11, align: 'left'},
      axisLabel: {color: '#748298', fontSize: 11, hideOverlap: true},
      axisLine: {show: false}, axisTick: {show: false},
      splitLine: {lineStyle: {color: '#e8edf3', type: 'dashed'}}
    },
    dataZoom: dense ? [
      {type: 'inside', xAxisIndex: 0, filterMode: 'none', zoomOnMouseWheel: false, moveOnMouseWheel: false},
      {type: 'slider', xAxisIndex: 0, filterMode: 'none', bottom: 6, height: 22, left: 64, right: 22, showDetail: false, brushSelect: false, borderColor: '#e1e7ef', fillerColor: 'rgba(147,104,33,.10)', dataBackground: {lineStyle: {color: '#bba57e'}, areaStyle: {color: '#eee7db'}}}
    ] : [],
    series: [{
      name: series.name, type: 'line', smooth: false, connectNulls: false,
      showSymbol: count <= 12, symbol: 'circle', symbolSize: 5,
      label: {show: false}, lineStyle: {width: 2}, emphasis: {scale: false},
      data: points.map(point => ({value: timed ? [point.time, point.value] : point.value, originalLabel: point.label}))
    }]
  }
}
