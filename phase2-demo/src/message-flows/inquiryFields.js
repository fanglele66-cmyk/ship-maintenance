export const inquiryFieldTypes = ['text', 'textarea', 'number', 'select', 'multiselect', 'date', 'datetime-local', 'boolean']

export function assertInquiry(message) {
  if (!message.id || !Array.isArray(message.fields) || !message.fields.length) throw new Error('Inquiry requires id and fields')
  if (message.status && !['pending', 'submitted', 'inactive'].includes(message.status)) throw new Error('Invalid inquiry status')
  const keys = new Set()
  for (const field of message.fields) {
    if (!field.key || !field.label || keys.has(field.key) || !inquiryFieldTypes.includes(field.type)) throw new Error('Invalid inquiry field')
    keys.add(field.key)
    if (['__proto__', 'constructor', 'prototype'].includes(field.key)) throw new Error('Reserved inquiry field key')
    if (field.required !== undefined && typeof field.required !== 'boolean') throw new Error('Invalid required flag')
    for (const bound of ['min', 'max']) if (field[bound] !== undefined && !Number.isFinite(field[bound])) throw new Error('Invalid numeric bound')
    if (field.min > field.max) throw new Error('Invalid numeric range')
    if (['select', 'multiselect'].includes(field.type)) {
      if (!Array.isArray(field.options) || !field.options.length) throw new Error('Inquiry enum requires options')
      const options = new Set()
      for (const option of field.options) {
        if (!option.label || !['string', 'number', 'boolean'].includes(typeof option.value) || option.value === '' || options.has(option.value)) throw new Error('Invalid inquiry option')
        options.add(option.value)
      }
    }
  }
  return message
}

export function inquiryValues(message) {
  return Object.fromEntries(message.fields.map(field => [field.key, message.values?.[field.key] ?? field.value ?? (field.type === 'multiselect' ? [] : field.type === 'boolean' ? false : '')]))
}

export function validateInquiry(message, values) {
  assertInquiry(message)
  const errors = {}
  for (const field of message.fields) {
    const value = values[field.key]
    const empty = value == null || (typeof value === 'string' && !value.trim()) || (Array.isArray(value) && !value.length)
    if (field.required && (empty || (field.type === 'boolean' && value !== true))) { errors[field.key] = '请完成此项'; continue }
    if (empty) continue
    if (field.type === 'number' && (!Number.isFinite(Number(value)) || typeof value === 'boolean' || Array.isArray(value))) errors[field.key] = '请输入有效数字'
    else if (field.type === 'number' && (Number(value) < field.min || Number(value) > field.max)) errors[field.key] = `请输入${field.min === undefined ? '' : `不小于 ${field.min}`}${field.min !== undefined && field.max !== undefined ? '、' : ''}${field.max === undefined ? '' : `不大于 ${field.max}`}的数值`
    else if (field.type === 'boolean' && typeof value !== 'boolean') errors[field.key] = '请选择有效值'
    else if (field.type === 'select' && !field.options.some(option => option.value === value)) errors[field.key] = '请选择列表中的选项'
    else if (field.type === 'multiselect' && (!Array.isArray(value) || value.some(item => !field.options.some(option => option.value === item)))) errors[field.key] = '请选择列表中的选项'
    else if (['text', 'textarea'].includes(field.type) && typeof value !== 'string') errors[field.key] = '请输入文本'
    else if (['date', 'datetime-local'].includes(field.type) && (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2})?$/.test(value) || !Number.isFinite(Date.parse(value)))) errors[field.key] = '请输入有效日期或时间'
  }
  return errors
}

export function displayInquiryValue(field, value) {
  if (value == null || value === '' || (Array.isArray(value) && !value.length)) return '未填写'
  if (field.type === 'boolean') return value ? '是' : '否'
  if (['select', 'multiselect'].includes(field.type)) return (Array.isArray(value) ? value : [value]).map(item => field.options.find(option => option.value === item)?.label ?? String(item)).join('、')
  return String(value)
}
