<template>
  <Teleport to="body">
    <Transition name="modal-fade">
      <div class="report-overlay" v-if="visible" @click.self="close">
        <div class="report-modal">
          <!-- 头部：标题 + 关闭 -->
          <div class="modal-header">
            <span class="modal-title">异常上报</span>
            <button class="modal-close" @click="close">&times;</button>
          </div>

          <!-- 表单主体 -->
          <div class="form-body">
            <!-- 第一行：设备 | 系统 -->
            <div class="form-row">
              <div class="form-col">
                <label class="field-label">设备</label>
                <el-select v-model="form.deviceId" filterable placeholder="请选择设备" @change="onDeviceChange" style="width:100%">
                  <el-option v-for="d in deviceStore.devices" :key="d.id" :label="d.name" :value="d.id" />
                </el-select>
              </div>
              <div class="form-col">
                <label class="field-label">系统</label>
                <el-select
                  v-model="form.systemParts"
                  multiple
                  collapse-tags
                  collapse-tags-tooltip
                  filterable
                  placeholder="请选择系统（可多选）"
                  style="width:100%"
                >
                  <el-option v-for="s in systemOptions" :key="s" :label="s" :value="s" />
                </el-select>
              </div>
            </div>

            <!-- 第二行：关联传感器 | 异常时间 -->
            <div class="form-row">
              <div class="form-col">
                <label class="field-label">关联传感器</label>
                <el-select
                  v-model="form.sensorIds"
                  multiple
                  collapse-tags
                  collapse-tags-tooltip
                  filterable
                  placeholder="请选择（可多选）"
                  style="width:100%"
                >
                  <el-option v-for="s in deviceSensors" :key="s.id" :label="`${s.nameCn} / ${s.nameEn}`" :value="s.id" />
                </el-select>
              </div>
              <div class="form-col">
                <label class="field-label">异常时间段</label>
                <el-date-picker
                  v-model="form.abnormalTime"
                  type="datetimerange"
                  range-separator="至"
                  start-placeholder="开始时间"
                  end-placeholder="结束时间"
                  format="YYYY-MM-DD HH:mm"
                  value-format="YYYY-MM-DD HH:mm"
                  :default-time="defaultTimeRange"
                  style="width:100%"
                />
              </div>
            </div>

            <!-- 第三行：异常描述 -->
            <div class="form-row full">
              <label class="field-label">异常描述</label>
              <div class="desc-wrap">
                <textarea
                  v-model="form.description"
                  class="desc-textarea"
                  rows="4"
                  placeholder="请详细描述异常现象、持续时间、目前状态等"
                ></textarea>
                <button class="voice-btn" :class="{ active: recording }" @click="toggleVoice" type="button" title="语音转文字">
                  <Icon :icon="recording ? 'mdi:microphone' : 'mdi:microphone-outline'" />
                </button>
              </div>
            </div>

            <!-- 第四行：图片 -->
            <div class="form-row full">
              <label class="field-label">图片</label>
              <div class="img-actions">
                <button class="img-btn upload" @click="triggerUpload" type="button">
                  <span>+</span>
                </button>
              </div>
              <!-- 已选图片缩略图 -->
              <div class="img-preview-list" v-if="form.images.length">
                <div v-for="(img, i) in form.images" :key="i" class="img-thumb">
                  <Icon icon="mdi:image" class="thumb-icon" />
                  <button class="thumb-del" @click="form.images.splice(i,1)" type="button">&times;</button>
                </div>
              </div>
            </div>

            <!-- 提交按钮 -->
            <button class="submit-btn" :class="{ disabled: submitting }" @click="submit" :disabled="submitting">
              {{ submitting ? '提交中...' : '提交异常报告' }}
            </button>
          </div>
        </div>
      </div>
    </Transition>

    <!-- 成功后跳转 Toast -->
    <Transition name="toast-slide">
      <div class="result-toast" v-if="showResultToast" @click="jumpToEvent">
        <div class="rt-icon">✅</div>
        <div class="rt-body">
          <div class="rt-title">{{ isDedup ? '重复报警已归并' : '上报成功' }}</div>
          <div class="rt-msg">已创建「待确认」事件，点击跳转查看详情</div>
        </div>
        <div class="rt-action">立即查看 &rsaquo;</div>
        <button class="rt-close" @click.stop="showResultToast = false">&times;</button>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { useRouter } from 'vue-router'
import { Icon } from '@iconify/vue'
import { ElMessage } from 'element-plus'
import { useDeviceStore } from '@/stores/deviceStore'
import { useRepairStore } from '@/stores/repairStore'

const props = defineProps({
  modelValue: Boolean,
  prefill: { type: Object, default: () => ({}) }
})
const emit = defineEmits(['update:modelValue', 'submitted'])

const router = useRouter()
const deviceStore = useDeviceStore()
const repairStore = useRepairStore()

// ---- 弹窗显隐 ----
const visible = computed({
  get: () => props.modelValue,
  set: v => emit('update:modelValue', v)
})

function close() { visible.value = false }

// ---- 表单数据 ----
const defaultForm = () => ({
  deviceId: '', systemParts: [], sensorIds: [], abnormalTime: [],
  description: '', images: []
})
const form = ref(defaultForm())
const recording = ref(false)
const submitting = ref(false)

// 时间段默认：开始 10:00，结束 11:00
const defaultTimeRange = [
  new Date(2000, 0, 1, 10, 0, 0),
  new Date(2000, 0, 1, 11, 0, 0),
]

// 系统选项（去重）
const systemOptions = computed(() =>
  [...new Set(deviceStore.devices.map(d => d.systemLabel))]
)

// 传感器列表（按设备筛选）
const deviceSensors = computed(() => {
  if (!form.value.deviceId) return deviceStore.sensors
  return deviceStore.sensors.filter(s => s.deviceId === form.value.deviceId)
})

// 当前时间字符串
function nowStr() {
  const d = new Date(), p = n => String(n).padStart(2,'0')
  return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`
}
function fmtDT(d) {
  const p = n => String(n).padStart(2,'0')
  return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`
}

// 设备联动
function onDeviceChange(id) {
  const d = deviceStore.devices.find(x => x.id === id)
  if (d && !form.value.systemParts.length) {
    form.value.systemParts = [d.systemLabel]
  }
  // 切换设备时，清空传感器多选并默认选中该设备第一个传感器
  form.value.sensorIds = []
  const firstSensor = deviceStore.sensors.find(s => s.deviceId === id)
  if (firstSensor) form.value.sensorIds = [firstSensor.id]
}

// 预填
watch(() => props.modelValue, (v) => {
  if (v) {
    const base = { ...defaultForm(), ...props.prefill }
    // 异常时间段：默认 [当前时间-1h, 当前时间]
    if (!base.abnormalTime || !Array.isArray(base.abnormalTime) || !base.abnormalTime.length) {
      const now = new Date()
      const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000)
      base.abnormalTime = [
        fmtDT(oneHourAgo),
        fmtDT(now)
      ]
    }
    // 兼容外部传 systemPart(单值) / sensorId(单值) 的预填
    if (Array.isArray(base.systemPart) && !base.systemParts?.length) base.systemParts = base.systemPart
    else if (typeof base.systemPart === 'string' && base.systemPart && !base.systemParts?.length) base.systemParts = [base.systemPart]
    if (typeof base.sensorId === 'string' && base.sensorId && !base.sensorIds?.length) base.sensorIds = [base.sensorId]
    form.value = base
    if (props.prefill?.deviceId) onDeviceChange(props.prefill.deviceId)
    showResultToast.value = false
  }
})

// ---- 图片操作 ----
function mockCapture() {
  if (form.value.images.length >= 5) { ElMessage.warning('最多上传5张图片'); return }
  form.value.images.push({ type: 'capture' })
}

function triggerUpload() {
  // 实际项目用 input[type=file] 触发，此处模拟添加
  if (form.value.images.length >= 5) { ElMessage.warning('最多上传5张图片'); return }
  form.value.images.push({ type: 'upload' })
}

// ---- 语音 ----
function toggleVoice() {
  recording.value = !recording.value
  if (recording.value) {
    setTimeout(() => {
      recording.value = false
      if (!form.value.description) {
        form.value.description = '现场听到异常声响，温度读数偏高，持续约3分钟'
      }
      ElMessage.success('语音识别完成')
    }, 1800)
  }
}

// ---- 提交 & 结果 Toast ----
const showResultToast = ref(false)
const isDedup = ref(false)
let lastCreatedEventId = ''

async function submit() {
  // 必填校验
  const timeArr = form.value.abnormalTime
  if (!form.value.deviceId || !form.value.systemParts.length || !form.value.sensorIds.length || !Array.isArray(timeArr) || !timeArr.length || !timeArr[0]) {
    ElMessage.warning('请填写所有必填项')
    return
  }

  submitting.value = true

  // 模拟异步处理
  await new Promise(r => setTimeout(r, 600))

  const device = deviceStore.devices.find(d => d.id === form.value.deviceId)
  const primarySensor = deviceStore.sensors.find(s => s.id === form.value.sensorIds[0])
  // 时间段格式化：有结束时间则 "开始 ~ 结束"，否则只显示开始
  const timeLabel = timeArr[1]
    ? `${timeArr[0]} ~ ${timeArr[1]}`
    : timeArr[0]
  const title = form.value.description
    ? form.value.description.slice(0, 20)
    : `${device?.name || ''}${primarySensor?.nameCn || ''}异常`

  const ev = repairStore.createEvent({
    deviceId: form.value.deviceId,
    deviceName: device?.name || '',
    systemPart: form.value.systemParts.join('/'),
    title,
    description: form.value.description
      ? `${form.value.description}\n\n[异常时间段] ${timeLabel}`
      : `${device?.name}${primarySensor?.nameCn}异常（${timeLabel}），待排查`,
    priority: 'medium',
    source: 'crew',
    sensorId: form.value.sensorIds[0]
  })

  // 判断是否被归并（createEvent 返回的是已有事件则说明归并了）
  isDedup.value = ev.createdAt !== undefined && ev.createdAt <= (new Date(Date.now() - 2000).toISOString().slice(0,16).replace('T',' '))
  lastCreatedEventId = ev.id

  submitting.value = false
  visible.value = false
  showResultToast.value = true
  emit('submitted', ev)

  // 结果 toast 10秒后自动消失
  setTimeout(() => { showResultToast.value = false }, 10000)
}

function jumpToEvent() {
  showResultToast.value = false
  if (lastCreatedEventId) router.push({ path: '/repair', query: { eventId: lastCreatedEventId } })
}
</script>

<style scoped>
/* ====== 遮罩 + 弹窗 ====== */
.report-overlay {
  position: fixed; inset: 0;
  z-index: 2000;
  background: rgba(0,0,0,0.55);
  display: flex; align-items: center; justify-content: center;
}
.report-modal {
  width: 520px;
  max-height: 88vh;
  border-radius: 12px;
  background: #0D1B2E;
  box-shadow: 0 20px 60px rgba(0,0,0,0.4);
  overflow-y: auto;
  display: flex; flex-direction: column;
}

/* 头部 */
.modal-header {
  display: flex; align-items: center; justify-content: space-between;
  padding: 18px 22px 14px;
  flex-shrink: 0;
}
.modal-title {
  font-size: 17px; font-weight: 700; color: #E0ECF8;
}
.modal-close {
  background: none; border: none; color: #5A7A92; font-size: 24px;
  cursor: pointer; line-height: 1; padding: 0 4px;
  transition: color 0.15s;
}
.modal-close:hover { color: #E0ECF8; }

/* 表单 */
.form-body { padding: 6px 22px 24px; }

.form-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 14px;
  margin-bottom: 16px;
}
.form-row.full { grid-template-columns: 1fr; }

.form-col { display: flex; flex-direction: column; gap: 6px; }

.field-label {
  font-size: 12px; color: #7A9AB8; font-weight: 500;
}

/* Element Plus 暗色适配 */
.form-row :deep(.el-input__wrapper),
.form-row :deep(.el-textarea__inner),
.form-row :deep(.el-select .el-input__wrapper) {
  background: #08101a !important;
  box-shadow: 0 0 0 1px #1E3A5F inset !important;
  border-radius: 6px !important;
}
.form-row :deep(.el-input__inner),
.form-row :deep(.el-textarea__inner) {
  color: #E0ECF8 !important;
  &::placeholder { color: #3A5A78; }
}
.form-row :deep(.el-select__placeholder),
.form-row :deep(.el-input__placeholder) { color: #3A5A78 !important; }
.form-row :deep(.el-select__suffix) { color: #4A6A8A; }

/* 异常描述 textarea */
.desc-wrap {
  position: relative;
  display: flex; gap: 0;
}
.desc-textarea {
  flex: 1;
  background: #08101a;
  border: 1px solid #1E3A5F;
  border-radius: 6px;
  padding: 10px 36px 10px 12px;
  color: #E0ECF8;
  font-size: 13px;
  resize: vertical;
  min-height: 80px;
  outline: none;
  font-family: inherit;
  line-height: 1.6;
  &::placeholder { color: #3A5A78; }
  &:focus { border-color: #1890FF; box-shadow: 0 0 0 2px rgba(24,144,255,0.15); }
}
.voice-btn {
  position: absolute; right: 8px; bottom: 8px;
  width: 32px; height: 32px; border-radius: 50%;
  background: #152A47; border: 1px solid #243B58;
  color: #5A7A92; cursor: pointer; font-size: 16px;
  display: flex; align-items: center; justify-content: center;
  transition: all 0.2s;
}
.voice-btn:hover { background: #1A3555; color: #1890FF; }
.voice-btn.active { background: #FF4D4F; color: #fff; animation: vpulse 1s infinite; border-color: #FF4D4F; }
@keyframes vpulse { 0%,100%{opacity:1;} 50%{opacity:0.6;} }

/* 图片操作 */
.img-actions { display: flex; gap: 10px; margin-top: 4px; }
.img-btn {
  width: 72px; height: 72px; border-radius: 8px; cursor: pointer;
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  gap: 6px; font-size: 13px; transition: all 0.15s; border: none;
}
.img-btn.camera {
  background: #fff; color: #333; font-weight: 550;
}
.img-btn.camera:hover { background: #f5f5f5; }
.img-btn.upload {
  background: #e8e8e8; color: #666; font-size: 28px; font-weight: 300;
}
.img-btn.upload:hover { background: #ddd; }

.img-preview-list {
  display: flex; gap: 8px; margin-top: 10px; flex-wrap: wrap;
}
.img-thumb {
  width: 64px; height: 64px; border-radius: 6px; background: #08101a;
  border: 1px solid #1E3A5F; position: relative;
  display: flex; align-items: center; justify-content: center;
}
.thumb-icon { font-size: 24px; color: #3A5A78; }
.thumb-del {
  position: absolute; top: -5px; right: -5px; width: 18px; height: 18px;
  border-radius: 50%; background: #FF4D4F; color: #fff; border: none;
  cursor: pointer; font-size: 12px; display: flex; align-items: center; justify-content: center;
}

/* 提交按钮 */
.submit-btn {
  width: 100%;
  padding: 13px 0;
  border-radius: 8px; border: none;
  background: linear-gradient(135deg, #FF4D4F 0%, #E63F41 100%);
  color: #fff; font-size: 15px; font-weight: 700;
  cursor: pointer; margin-top: 6px;
  transition: opacity 0.2s, transform 0.1s;
}
.submit-btn:hover:not(.disabled) { opacity: 0.92; transform: translateY(-0.5px); box-shadow: 0 4px 16px rgba(255,77,79,0.3); }
.submit-btn.disabled { opacity: 0.5; cursor: not-allowed; }

/* ====== 结果跳转 Toast ====== */
.result-toast {
  position: fixed; bottom: 60px; left: 50%; transform: translateX(-50%);
  z-index: 2100;
  background: #fff; border-radius: 10px;
  padding: 14px 20px;
  display: flex; align-items: center; gap: 12px;
  box-shadow: 0 6px 24px rgba(0,0,0,0.15), 0 2px 8px rgba(0,0,0,0.08);
  cursor: pointer; min-width: 380px;
  max-width: 540px;
  transition: transform 0.25s ease, opacity 0.25s ease;
}
.result-toast:hover { box-shadow: 0 8px 30px rgba(0,0,0,0.18); }
.rt-icon { font-size: 20px; flex-shrink: 0; }
.rt-body { flex: 1; min-width: 0; }
.rt-title { font-size: 13px; color: #222; font-weight: 700; }
.rt-msg { font-size: 12px; color: #888; margin-top: 2px; }
.rt-action {
  font-size: 13px; color: #1890FF; font-weight: 700;
  white-space: nowrap; flex-shrink: 0;
}
.rt-close {
  background: none; border: none; font-size: 20px; color: #bbb;
  cursor: pointer; padding: 0 4px; line-height: 1; flex-shrink: 0;
}
.rt-close:hover { color: #666; }

/* ====== 过渡动画 ====== */
.modal-fade-enter-active { transition: opacity 0.25s ease; }
.modal-fade-leave-active { transition: opacity 0.2s ease; }
.modal-fade-enter-from, .modal-fade-leave-to { opacity: 0; }
.toast-slide-enter-active { transition: all 0.35s ease-out; }
.toast-slide-leave-active { transition: all 0.3s ease-in; }
.toast-slide-enter-from { transform: translateX(-50%) translateY(20px); opacity: 0; }
.toast-slide-leave-to { transform: translateX(-50%) translateY(20px); opacity: 0; }
</style>
