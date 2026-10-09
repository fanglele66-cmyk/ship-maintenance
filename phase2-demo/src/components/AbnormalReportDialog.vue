<template>
  <Teleport to="body">
    <Transition name="report-dialog">
      <div v-if="open" class="report-dialog-mask" @mousedown.self="$emit('close')">
        <section class="report-dialog" role="dialog" aria-modal="true" aria-labelledby="report-dialog-title">
          <header class="report-dialog-header">
            <h2 id="report-dialog-title">异常上报</h2>
            <button type="button" class="report-dialog-close" aria-label="关闭异常上报" @click="$emit('close')">×</button>
          </header>

          <div class="report-dialog-body">
            <div class="report-field" :class="{ 'is-filled': Boolean(form.deviceId), 'is-context-locked': contextLocked }">
              <label>设备</label>
              <el-select
                :model-value="form.deviceId"
                filterable
                :clearable="!contextLocked"
                :disabled="contextLocked"
                popper-class="report-select-popper"
                placeholder="请选择设备"
                @update:model-value="requestDeviceChange"
              >
                <el-option v-for="device in deviceStore.devices" :key="device.id" :label="device.name" :value="device.id">
                  <span class="report-option-main">{{ device.name }}</span>
                  <span class="report-option-meta">{{ device.system }}</span>
                </el-option>
              </el-select>
            </div>

            <div
              class="report-field"
              :class="{
                'is-filled': form.systems.length > 0,
                'is-locked': !form.deviceId,
                'is-context-locked': contextLocked
              }"
            >
              <label>系统</label>
              <el-select
                v-model="form.systems"
                multiple
                collapse-tags
                :max-collapse-tags="1"
                collapse-tags-tooltip
                filterable
                :clearable="!contextLocked"
                :disabled="!form.deviceId || contextLocked"
                popper-class="report-select-popper"
                :placeholder="form.deviceId ? '请选择系统（可多选）' : '请先选择设备'"
                @change="handleSystemChange"
              >
                <el-option v-for="system in systemOptions" :key="system" :label="system" :value="system" />
              </el-select>
            </div>

            <div
              class="report-field"
              :class="{
                'is-filled': form.sensorIds.length > 0,
                'is-locked': !form.deviceId || !form.systems.length,
                'is-context-locked': contextLocked
              }"
            >
              <label>关联传感器</label>
              <el-select
                v-model="form.sensorIds"
                multiple
                collapse-tags
                :max-collapse-tags="1"
                collapse-tags-tooltip
                filterable
                :clearable="!contextLocked"
                :disabled="!form.deviceId || !form.systems.length || contextLocked"
                popper-class="report-select-popper report-sensor-popper"
                :placeholder="sensorPlaceholder"
              >
                <el-option
                  v-for="sensor in sensorOptions"
                  :key="sensor.id"
                  :label="`${sensor.nameCn}（${sensor.nameEn}）`"
                  :value="sensor.id"
                >
                  <span class="report-option-main">{{ sensor.nameCn }}</span>
                  <span class="report-option-meta">{{ sensor.nameEn }} · {{ sensor.value }}{{ sensor.unit }}</span>
                </el-option>
              </el-select>
            </div>

            <div class="report-field" :class="{ 'is-filled': form.timeRange?.length === 2 }">
              <label>异常时间段</label>
              <el-date-picker
                v-model="form.timeRange"
                type="datetimerange"
                popper-class="report-date-popper"
                start-placeholder="开始时间"
                end-placeholder="结束时间"
                range-separator="至"
                value-format="YYYY-MM-DDTHH:mm:ss"
              />
            </div>

            <div v-if="contextLocked" class="report-context-note">
              设备、系统和传感器已从趋势图关联，不可修改
            </div>

            <div class="report-field report-field-wide">
              <label>异常描述</label>
              <div class="report-description-wrap">
                <textarea v-model="form.description" rows="3" placeholder="请详细描述异常现象、持续时间、目前状态等"></textarea>
                <button
                  type="button"
                  class="report-voice-btn"
                  :class="{ 'is-recording': isVoiceRecording }"
                  :title="isVoiceRecording ? '停止录音' : '语音描述'"
                  :aria-label="isVoiceRecording ? '停止录音' : '语音描述'"
                  :aria-pressed="isVoiceRecording"
                  @click="toggleVoiceDescription"
                >
                  <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
                    <rect x="7" y="2" width="6" height="10" rx="3" />
                    <path d="M4 10a6 6 0 0 0 12 0M10 15v3M7 18h6" />
                  </svg>
                </button>
              </div>
            </div>

            <div class="report-field report-field-wide">
              <label>图片</label>
              <el-upload
                v-model:file-list="form.images"
                class="report-upload"
                action="#"
                list-type="picture-card"
                :auto-upload="false"
                :limit="4"
              >
                <span class="report-upload-plus">＋</span>
              </el-upload>
            </div>
          </div>

          <footer class="report-dialog-footer">
            <button type="button" class="report-submit" :disabled="!canSubmit" @click="submitReport">提交异常报告</button>
          </footer>

          <div
            v-if="deviceChangeConfirmOpen"
            class="report-device-confirm-layer"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="device-change-confirm-title"
          >
            <div class="report-device-confirm">
              <h3 id="device-change-confirm-title">更换设备？</h3>
              <p>切换设备后，需要重新选择系统和传感器。其他已填写内容会保留。</p>
              <div class="report-device-confirm-actions">
                <button type="button" class="report-confirm-cancel" @click="cancelDeviceChange">取消</button>
                <button type="button" class="report-confirm-submit" @click="confirmDeviceChange">确定更换</button>
              </div>
            </div>
          </div>
        </section>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup>
import { computed, reactive, ref, watch, onBeforeUnmount } from 'vue'
import { ElMessage, ElSelect, ElOption, ElDatePicker, ElUpload } from 'element-plus'
import { useDeviceStore } from '@/stores/deviceStore'
import { useSensorStore } from '@/stores/sensorStore'

const props = defineProps({
  open: { type: Boolean, default: false },
  prefill: { type: Object, default: null },
  contextLocked: { type: Boolean, default: false }
})
const emit = defineEmits(['close', 'submit'])

const deviceStore = useDeviceStore()
const sensorStore = useSensorStore()
const form = reactive({
  deviceId: '',
  systems: [],
  sensorIds: [],
  timeRange: [],
  description: '',
  images: []
})
const deviceChangeConfirmOpen = ref(false)
const pendingDeviceId = ref('')
const isVoiceRecording = ref(false)
let voiceRecognition = null

const sensorsForDevice = computed(() => {
  if (!form.deviceId) return sensorStore.allSensors
  return sensorStore.allSensors.filter(sensor => sensor.deviceId === form.deviceId)
})
const systemOptions = computed(() => {
  const selectedDevice = deviceStore.getDeviceById(form.deviceId)
  if (!selectedDevice) return []
  const systems = [...new Set(sensorsForDevice.value
    .map(sensor => sensor.subsystem || sensor.system)
    .filter(Boolean))]
  return systems.length ? systems : [selectedDevice.system]
})
const sensorOptions = computed(() => {
  if (!form.systems.length) return []
  return sensorsForDevice.value.filter(sensor => (
    form.systems.includes(sensor.subsystem) || form.systems.includes(sensor.system)
  ))
})
const sensorPlaceholder = computed(() => {
  if (!form.deviceId) return '请先选择设备'
  if (!form.systems.length) return '请先选择系统'
  return '请选择传感器（可多选）'
})
const canSubmit = computed(() => form.deviceId && form.systems.length && form.sensorIds.length && form.timeRange?.length === 2)

function resetForm() {
  stopVoiceDescription()
  const prefill = props.prefill || {}
  form.deviceId = prefill.deviceId || ''
  form.systems = Array.isArray(prefill.systems)
    ? [...prefill.systems]
    : prefill.system ? [prefill.system] : []
  form.sensorIds = Array.isArray(prefill.sensorIds)
    ? [...prefill.sensorIds]
    : prefill.sensorId ? [prefill.sensorId] : []
  form.timeRange = Array.isArray(prefill.timeRange) ? [...prefill.timeRange] : []
  form.description = prefill.description || ''
  form.images = []
  deviceChangeConfirmOpen.value = false
  pendingDeviceId.value = ''
}

function applyDeviceChange(deviceId) {
  form.deviceId = deviceId || ''
  form.systems = []
  form.sensorIds = []
}

function requestDeviceChange(deviceId) {
  if (props.contextLocked) return
  const nextDeviceId = deviceId || ''
  if (nextDeviceId === form.deviceId) return

  if (!form.deviceId) {
    applyDeviceChange(nextDeviceId)
    return
  }

  pendingDeviceId.value = nextDeviceId
  deviceChangeConfirmOpen.value = true
}

function cancelDeviceChange() {
  pendingDeviceId.value = ''
  deviceChangeConfirmOpen.value = false
}

function confirmDeviceChange() {
  applyDeviceChange(pendingDeviceId.value)
  cancelDeviceChange()
}

function handleSystemChange() {
  if (props.contextLocked) return
  form.sensorIds = sensorOptions.value.map(sensor => sensor.id)
}

function stopVoiceDescription() {
  if (voiceRecognition) {
    voiceRecognition.onend = null
    try { voiceRecognition.stop() } catch (_) {}
    voiceRecognition = null
  }
  isVoiceRecording.value = false
}

function toggleVoiceDescription() {
  if (isVoiceRecording.value) {
    stopVoiceDescription()
    return
  }

  const SpeechRecognition = typeof window !== 'undefined'
    ? (window.SpeechRecognition || window.webkitSpeechRecognition)
    : null
  if (!SpeechRecognition) {
    ElMessage.warning('当前浏览器不支持语音输入，请使用 Chrome 或 Edge 浏览器')
    return
  }

  const recognition = new SpeechRecognition()
  const baseText = form.description.trim()
  recognition.lang = 'zh-CN'
  recognition.continuous = false
  recognition.interimResults = true
  recognition.maxAlternatives = 1

  recognition.onresult = (event) => {
    let transcript = ''
    for (let index = 0; index < event.results.length; index += 1) {
      transcript += event.results[index][0].transcript
    }
    const spokenText = transcript.trim()
    form.description = [baseText, spokenText].filter(Boolean).join(baseText ? ' ' : '')
  }
  recognition.onerror = (event) => {
    if (event.error !== 'aborted' && event.error !== 'no-speech') {
      ElMessage.warning('语音输入暂时不可用，请重试')
    }
    stopVoiceDescription()
  }
  recognition.onend = () => {
    if (voiceRecognition === recognition) {
      voiceRecognition = null
      isVoiceRecording.value = false
    }
  }

  try {
    recognition.start()
    voiceRecognition = recognition
    isVoiceRecording.value = true
  } catch (_) {
    stopVoiceDescription()
    ElMessage.warning('无法启动语音输入，请重试')
  }
}

function submitReport() {
  if (!canSubmit.value) return
  emit('submit', {
    deviceId: form.deviceId,
    systems: [...form.systems],
    sensorIds: [...form.sensorIds],
    timeRange: [...form.timeRange],
    description: form.description.trim(),
    images: form.images.map(file => ({ name: file.name, url: file.url || '' }))
  })
}

watch(() => props.open, (open) => { if (open) resetForm() })
onBeforeUnmount(stopVoiceDescription)
</script>

<style scoped>
.report-dialog-mask {
  position: fixed;
  inset: 0;
  z-index: 3000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
  background: rgba(6, 15, 29, 0.62);
}
.report-dialog {
  position: relative;
  width: min(760px, calc(100vw - 40px));
  max-height: calc(100vh - 40px);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  border: 1px solid #253A58;
  border-radius: 12px;
  background: #101E32;
  box-shadow: 0 24px 72px rgba(3, 10, 22, 0.38);
  color: #E7EEF8;
}
.report-dialog-header {
  height: 64px;
  flex: none;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 24px;
}
.report-dialog-header h2 { margin: 0; font-size: 24px; line-height: 32px; font-weight: 700; }
.report-dialog-close {
  width: 32px;
  height: 32px;
  padding: 0;
  border: 0;
  background: transparent;
  color: #7890AC;
  font-size: 30px;
  line-height: 28px;
  cursor: pointer;
}
.report-dialog-close:hover { color: #E7EEF8; }
.report-dialog-body {
  min-height: 0;
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 18px 20px;
  padding: 10px 24px 18px;
  overflow-y: auto;
}
.report-field { min-width: 0; display: flex; flex-direction: column; gap: 8px; }
.report-field-wide { grid-column: 1 / -1; }
.report-field > label { color: #8FA7C3; font-size: 14px; line-height: 20px; }
.report-field.is-locked > label { color: #627995; }
.report-context-note {
  grid-column: 1 / -1;
  margin-top: -4px;
  padding: 8px 10px;
  border: 1px solid #284665;
  border-radius: 6px;
  background: #0D1A2C;
  color: #8FA7C3;
  font-size: 12px;
  line-height: 18px;
}
.report-description-wrap { position: relative; }
.report-description-wrap textarea {
  width: 100%;
  box-sizing: border-box;
  resize: vertical;
  min-height: 96px;
  padding: 14px 54px 14px 14px;
  border: 1px solid #2B4667;
  border-radius: 8px;
  outline: none;
  background: #081423;
  color: #E7EEF8;
  font: inherit;
  font-size: 14px;
  line-height: 22px;
}
.report-description-wrap textarea:focus { border-color: #4D87D8; box-shadow: 0 0 0 2px rgba(77, 135, 216, 0.12); }
.report-description-wrap textarea::placeholder { color: #506985; }
.report-voice-btn {
  position: absolute;
  right: 12px;
  bottom: 12px;
  width: 40px;
  height: 40px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  border: 1px solid #2D496B;
  border-radius: 50%;
  background: #193150;
  color: #7899BD;
  cursor: pointer;
  transition: border-color 0.16s, background 0.16s, color 0.16s, box-shadow 0.16s;
}
.report-voice-btn:hover,
.report-voice-btn:focus-visible,
.report-voice-btn.is-recording {
  border-color: #5E91D3;
  background: #21446C;
  color: #DCEBFF;
  box-shadow: 0 0 0 2px rgba(77, 135, 216, 0.14);
}
.report-voice-btn.is-recording { animation: report-voice-pulse 1.4s ease-in-out infinite; }
.report-voice-btn:focus-visible { outline: 2px solid #7DB4FF; outline-offset: 2px; }
.report-voice-btn svg { width: 18px; height: 18px; stroke: currentColor; stroke-width: 1.6; stroke-linecap: round; }
@keyframes report-voice-pulse {
  0%, 100% { box-shadow: 0 0 0 2px rgba(77, 135, 216, 0.14); }
  50% { box-shadow: 0 0 0 5px rgba(77, 135, 216, 0.08); }
}
.report-dialog-footer { flex: none; padding: 14px 24px 22px; }
.report-submit {
  width: 100%;
  height: 48px;
  border: 0;
  border-radius: 8px;
  background: #ED554F;
  color: #FFF8F7;
  font: inherit;
  font-size: 16px;
  font-weight: 700;
  cursor: pointer;
}
.report-submit:hover:not(:disabled) { background: #F0645E; }
.report-submit:disabled { opacity: 0.45; cursor: not-allowed; }
.report-upload-plus { color: #8FA7C3; font-size: 28px; font-weight: 300; }

.report-device-confirm-layer {
  position: absolute;
  inset: 0;
  z-index: 20;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  background: rgba(5, 13, 25, 0.72);
}
.report-device-confirm {
  width: min(380px, 100%);
  padding: 22px;
  border: 1px solid #355575;
  border-radius: 10px;
  background: #14243A;
  box-shadow: 0 18px 48px rgba(2, 8, 18, 0.42);
}
.report-device-confirm h3 {
  margin: 0;
  color: #F4F8FD;
  font-size: 18px;
  line-height: 26px;
  font-weight: 700;
}
.report-device-confirm p {
  margin: 10px 0 22px;
  color: #9CB1CA;
  font-size: 14px;
  line-height: 22px;
}
.report-device-confirm-actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
}
.report-device-confirm-actions button {
  height: 36px;
  padding: 0 16px;
  border-radius: 6px;
  font: inherit;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
}
.report-confirm-cancel {
  border: 1px solid #3B5674;
  background: transparent;
  color: #B8C8DB;
}
.report-confirm-cancel:hover { border-color: #5D7FA4; color: #F4F8FD; }
.report-confirm-submit {
  border: 1px solid #1677FF;
  background: #1677FF;
  color: #F4F8FD;
}
.report-confirm-submit:hover { border-color: #3B8CFF; background: #3B8CFF; }

.report-field :deep(.el-select),
.report-field :deep(.el-date-editor) { width: 100%; }
.report-field :deep(.el-select__wrapper),
.report-field :deep(.el-date-editor.el-input__wrapper),
.report-field :deep(.el-date-editor--datetimerange) {
  min-height: 44px;
  border: 1px solid #2B4667;
  box-shadow: none;
  background: #081423;
}
.report-field :deep(.el-select__wrapper) {
  height: 44px;
  max-height: 44px;
  overflow: hidden;
  padding: 5px 10px;
  align-items: center;
}
.report-field :deep(.el-select__selection) {
  min-width: 0;
  height: 100%;
  flex-wrap: nowrap;
  gap: 6px;
  padding-block: 1px;
  align-items: center;
  overflow: hidden;
}
.report-field :deep(.el-select__input-wrapper) { flex: 0 1 54px; min-width: 0; }
.report-field :deep(.el-select__selected-item) {
  max-width: 100%;
  min-height: 24px;
  align-items: center;
  line-height: 24px;
}
.report-field :deep(.el-tag.el-tag--info) {
  height: 28px;
  max-width: 100%;
  margin: 1px 0;
  padding: 0 8px 0 10px;
  border: 1px solid #376A9E;
  border-radius: 6px;
  background: #183A60;
  color: #F4F8FD;
  font-size: 13px;
  line-height: 26px;
}
.report-field :deep(.el-tag.el-tag--info .el-tag__content) {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.report-field :deep(.el-tag.el-tag--info .el-tag__close) {
  width: 17px;
  height: 17px;
  margin-left: 6px;
  color: #A9C7E8;
}
.report-field :deep(.el-tag.el-tag--info .el-tag__close:hover) {
  background: #D94C50;
  color: #FFF8F7;
}
.report-field :deep(.el-select__wrapper.is-focused),
.report-field :deep(.el-date-editor.is-active) { border-color: #4D87D8; box-shadow: 0 0 0 2px rgba(77, 135, 216, 0.12); }
.report-field :deep(.el-select__selected-item),
.report-field :deep(.el-range-input),
.report-field :deep(.el-range-separator) { color: #E7EEF8; }
.report-field :deep(.el-select__placeholder),
.report-field :deep(.el-range-input::placeholder),
.report-field :deep(.el-range-separator),
.report-field :deep(.el-input__icon) { color: #7890AC; }
.report-field :deep(.el-range-input:not(:placeholder-shown)) { color: #F4F8FD; }
.report-field.is-filled :deep(.el-select__selected-item),
.report-field.is-filled :deep(.el-range-input) { color: #F4F8FD; }
.report-field :deep(.el-select__wrapper.is-disabled) {
  border-color: #213650;
  background: #0B1728;
  box-shadow: none;
  cursor: not-allowed;
}
.report-field :deep(.el-select__wrapper.is-disabled .el-select__placeholder) {
  color: #536B86;
}
.report-field.is-context-locked :deep(.el-select__wrapper.is-disabled) { opacity: 1; }
.report-field.is-context-locked :deep(.el-select__wrapper.is-disabled .el-select__selected-item),
.report-field.is-context-locked :deep(.el-select__wrapper.is-disabled .el-tag.el-tag--info) {
  color: #F4F8FD !important;
  opacity: 1;
}
.report-upload :deep(.el-upload--picture-card) {
  width: 96px;
  height: 96px;
  border: 1px dashed #385879;
  border-radius: 8px;
  background: #14243A;
}
.report-upload :deep(.el-upload--picture-card:hover) { border-color: #5E91D3; }

:global(.report-select-popper.el-popper) {
  z-index: 3100 !important;
  overflow: hidden;
  border: 1px solid #2B4667;
  border-radius: 8px;
  background: #101E32;
  box-shadow: 0 12px 30px rgba(3, 10, 22, 0.34);
}
:global(.report-select-popper .el-popper__arrow::before) {
  border-color: #2B4667;
  background: #101E32;
}
:global(.report-select-popper .el-select-dropdown__list) { padding: 6px; }
:global(.report-select-popper .el-select-dropdown__item) {
  min-height: 38px;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 7px 10px;
  border-radius: 6px;
  color: #C8D6E8;
  font-size: 13px;
  line-height: 20px;
}
:global(.report-select-popper .el-select-dropdown__item:hover),
:global(.report-select-popper .el-select-dropdown__item.is-hovering) {
  background: #172B45;
  color: #F1F6FC;
}
:global(.report-select-popper .el-select-dropdown__item.is-selected) {
  background: #245FA8;
  color: #F4F8FD;
  font-weight: 600;
}
:global(.report-select-popper .el-select-dropdown__item.is-selected .report-option-meta) {
  color: #D6E8FF;
}
:global(.report-select-popper .el-select-dropdown__empty) { color: #7890AC; }
:global(.report-select-popper .el-checkbox__inner) {
  border-color: #4B6787;
  background: #0B192A;
}
:global(.report-select-popper .el-checkbox__input.is-checked .el-checkbox__inner),
:global(.report-select-popper .el-checkbox__input.is-indeterminate .el-checkbox__inner) {
  border-color: #3B8CFF;
  background: #3B8CFF;
}
:global(.report-option-main) {
  min-width: 0;
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
:global(.report-option-meta) {
  flex: none;
  color: #7890AC;
  font-size: 12px;
  font-weight: 400;
}
:global(.report-date-popper.el-popper) { z-index: 3100 !important; }

.report-dialog-enter-active,
.report-dialog-leave-active { transition: opacity 0.18s ease; }
.report-dialog-enter-active .report-dialog,
.report-dialog-leave-active .report-dialog { transition: transform 0.18s cubic-bezier(0.22, 1, 0.36, 1); }
.report-dialog-enter-from,
.report-dialog-leave-to { opacity: 0; }
.report-dialog-enter-from .report-dialog,
.report-dialog-leave-to .report-dialog { transform: translateY(8px) scale(0.985); }

@media (max-width: 720px) {
  .report-dialog-mask { padding: 0; align-items: stretch; }
  .report-dialog { width: 100%; max-height: 100vh; border-radius: 0; }
  .report-dialog-body { grid-template-columns: 1fr; padding-inline: 16px; }
  .report-field-wide { grid-column: auto; }
  .report-context-note { grid-column: auto; }
  .report-dialog-header { padding-inline: 16px; }
  .report-dialog-footer { padding-inline: 16px; }
}
</style>
