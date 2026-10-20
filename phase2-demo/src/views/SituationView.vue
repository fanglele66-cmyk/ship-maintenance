<template>
  <div class="situation-view">
    <button
      v-if="isAssistantCollapsed && !isShipLevel "
      class="compact-assistant-float"
      :class="{ 'is-active': compactAssistantOpen, 'is-dragging': isCompactFloatDragging }"
      :style="compactFloatStyle"
      type="button"
      :title="compactAssistantOpen ? '关闭 AI 助手' : '打开 AI 助手'"
      :aria-label="compactAssistantOpen ? '关闭 AI 助手' : '打开 AI 助手'"
      @mousedown="startCompactFloatDrag"
      @touchstart="startCompactFloatDrag"
      @click.stop="toggleCompactAssistant"
    >
      <span v-if="compactAssistantOpen" class="compact-assistant-x" aria-hidden="true">✕</span>
      <img
        v-else
        class="compact-assistant-icon"
        src="/assistant-icons/knowledge-entry.svg"
        alt=""
        aria-hidden="true"
        draggable="false"
        @dragstart.prevent
      />
    </button>
    <div ref="situationBodyRef" class="situation-body">
      <div class="situation-content">
        <CaptainIssueDetail ref="issueDetailRef" v-if="issueId" :key="issueId" :scenario="issueId" @back="returnFromIssue"/><SituationObservation v-else-if="attentionId&&isWorkflow(attentionId)&&!demoStore.cases[attentionId]?.trackingOnly" :key="attentionId" :scenario="attentionId" @back="returnToAttention"/><AirAttentionDetail v-else-if="attentionId==='air-delivery'" @back="returnToAir"/><AttentionDossier v-else-if="attentionId" :key="attentionId" :scenario="attentionId" @back="returnToAttention" @request-inquiry="focusDossierInquiry" />
        <MaintenanceAdviceDetail v-else-if="maintenanceId" standalone :planned="maintenanceId==='planned'" @back="returnToMaintenance" @show-advice="router.push('/situation/issue/maintenance')" @show-arrangements="router.push('/situation/maintenance/planned')" @open-event="openMaintenanceEvent" @open-observation="router.push('/situation/attention/maintenance')" />
        <!-- Layer 1: Ship Overview -->
        <div v-show="!attentionId && !maintenanceId && !issueId && currentLayer === 1" class="layer" :class="layerClass(1)">
          <ShipOverview @select-device="handleDeviceClick" @select-item="openDemoItem" />
        </div>

        <!-- Layer 2: device-level attention, maintenance and todo overview -->
        <div v-if="!attentionId && !maintenanceId && !issueId && currentLayer === 2" class="layer" :class="layerClass(2)">
          <DeviceSituation ref="deviceSituationRef" :device-id="selectedDeviceId" :device-name="selectedDeviceName" @select-device="id=>handleDeviceClick(deviceStore.getDeviceById(id))" @select-sensor="handleSensorClick" @open-data="sensorView='list'" @back="goToLayer(1)">
            <template #data>
              <SensorSimulationControls/>
              <div class="device-data-toolbar">
                <label class="layer-header-search">
                  <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6.5" /><path d="m16 16 4 4" /></svg>
                  <input v-model="sensorSearchQuery" type="search" placeholder="搜索传感器" aria-label="搜索传感器" />
                </label>
                <div class="sensor-view-switch" role="tablist" aria-label="传感器视图切换">
                  <button type="button" role="tab" aria-label="列表视图" title="列表视图" :aria-selected="sensorView === 'list'" :class="{ active: sensorView === 'list' }" @click="setSensorView('list')"><span class="sensor-view-icon sensor-view-icon-list" aria-hidden="true"></span></button>
                  <button type="button" role="tab" aria-label="趋势视图" title="趋势视图" :aria-selected="sensorView === 'trend'" :class="{ active: sensorView === 'trend' }" @click="setSensorView('trend')"><span class="sensor-view-icon sensor-view-icon-trend" aria-hidden="true"></span></button>
                </div>
              </div>
              <SensorGrid v-if="sensorView === 'list'" :search-query="sensorSearchQuery" @select-sensor="handleSensorClick" />
              <SensorTrend v-else :search-query="sensorSearchQuery" @quick-report="openQuickReport" />
            </template>
          </DeviceSituation>
        </div>
      </div>

      <!-- 拖拽手柄（在内容区和助手之间，独立元素不受 overflow 裁剪） -->
      <div
        v-if="!isAssistantCollapsed && !isShipLevel && attentionId!=='air-delivery'"
        class="panel-resize-handle"
        :class="{ resizing: isResizingAssistant }"
        @pointerdown="startResize"
        @dblclick="resetWidth"
        role="separator"
        aria-orientation="vertical"
        aria-label="拖拽调整设备态势与 AI 助手宽度"
        title="拖拽调整宽度 · 双击重置"
      >
        <div class="panel-resize-grip"></div>
      </div>

      <!-- 助手面板容器（宽度由拖拽控制） -->
      <template v-if="!isShipLevel "><Transition name="compact-assistant-slide">
        <div
          v-if="!isShipLevel && attentionId!=='air-delivery' && (!isAssistantCollapsed || compactAssistantOpen)"
          class="assistant-wrapper"
          :class="{ 'compact-assistant-overlay': isAssistantCollapsed }"
          :style="assistantWidthStyle"
        >
          <Phase2Assistant :title="issueId ? 'AI事项助手' : 'AI设备态势助手'" :issue-id="issueId" @issue-section="section => issueDetailRef?.showSection(section)" :key="issueId ? 'issue:'+issueId : maintenanceId ? 'maintenance:'+maintenanceId : attentionId ? 'attention:'+attentionId : 'device:'+selectedDeviceId" :device-id="currentLayer===2?selectedDeviceId:null" :device-name="selectedDeviceName" ref="assistantRef" :dossier="Boolean(attentionId)" :maintenance-detail="Boolean(maintenanceId)" :plan-only="maintenanceId==='planned'" :mode="attentionId || maintenanceId ? 'attention' : currentLayer === 1 ? 'ship' : currentLayer === 2 && selectedDeviceId === 'main-engine-1' ? 'attention' : 'sensor'" @open-device="openDemoDevice" @open-todo="openDemoTodo" @open-item="openDemoItem" />
        </div>
      </Transition></template>
    </div>

    <AbnormalReportDialog v-if="reportDialogOpen"
      :open="reportDialogOpen"
      :prefill="reportPrefill"
      context-locked
      @close="reportDialogOpen = false"
      @submit="submitAbnormalReport"
    />
  </div>
</template>

<script setup>
import {lazyPane} from '@/components/lazyPane'
import {issueCatalog} from '@/mock/captainWorkbench'
import {resolveIssueNavigation} from '@/mock/issueRelationships'
import {isWorkflow} from '@/mock/fourStoryWorkflow'
const SituationObservation=lazyPane(()=>import('@/components/SituationObservation.vue'))
const CaptainIssueDetail=lazyPane(()=>import('@/components/CaptainIssueDetail.vue'))
const AirAttentionDetail=lazyPane(()=>import('@/components/AirAttentionDetail.vue'))
import { ref, computed, reactive, provide, nextTick, watch, onActivated, onMounted, onUnmounted } from 'vue'
import { storeToRefs } from 'pinia'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
const AbnormalReportDialog=lazyPane(()=>import('@/components/AbnormalReportDialog.vue'))
import ShipOverview from './ShipOverview.vue'
import SensorSimulationControls from '@/components/SensorSimulationControls.vue'
const SensorGrid=lazyPane(()=>import('./SensorGrid.vue'))
const SensorTrend=lazyPane(()=>import('./SensorTrend.vue'))
const DeviceSituation=lazyPane(()=>import('./DeviceSituation.vue'))
const MaintenanceAdviceDetail=lazyPane(()=>import('@/components/MaintenanceAdviceDetail.vue'))
const AttentionDossier=lazyPane(()=>import('@/components/AttentionDossier.vue'))
const Phase2Assistant=lazyPane(()=>import('@/components/Phase2Assistant.vue'))
import BackButton from '@/components/BackButton.vue'
import { useSensorStore } from '@/stores/sensorStore'
import { useSituationStore } from '@/stores/situationStore'
import { useDeviceStore } from '@/stores/deviceStore'
import { usePhase2DemoStore } from '@/stores/phase2DemoStore'
import { useAbnormalReport } from '@/composables/useAbnormalReport'

const sensorStore = useSensorStore()
const situationStore = useSituationStore()
const deviceStore = useDeviceStore()
const demoStore = usePhase2DemoStore()
const router = useRouter()
const route = useRoute()
const issueId=computed(()=>route.params.section==='issue'?String(route.params.attentionId||''):'')
const attentionId = computed(() => route.params.section === 'attention' ? String(route.params.attentionId || '') : '')
const maintenanceId=computed(()=>route.params.section==='maintenance'?String(route.params.attentionId || ''):'')
const { createAbnormalEvent } = useAbnormalReport()
const {
  currentLayer,
  selectedDeviceId,
  selectedDeviceName,
  selectedSensorName,
  sensorSearchQuery,
  sensorView
} = storeToRefs(situationStore)

const visibleSensors = computed(() => {
  const query = sensorSearchQuery.value.trim().toLowerCase()
  const sensors = sensorStore.filteredSensors

  if (!query) return sensors

  return sensors.filter((sensor) => [
    sensor.nameEn,
    sensor.nameCn,
    sensor.subsystem,
    sensor.system,
    sensor.unit,
  ].some((value) => String(value || '').toLowerCase().includes(query)))
})

const reportDialogOpen = ref(false)
const reportPrefill = ref(null)
const situationBodyRef = ref(null)
const isResizingAssistant = ref(false)
watch(()=>demoStore.captainEntry,()=>goToLayer(1))
const isShipLevel=computed(()=>currentLayer.value===1&&!attentionId.value&&!maintenanceId.value&&!issueId.value)
const isAssistantCollapsed = ref(false)
const compactAssistantOpen = ref(false)
const assistantRef=ref(null)
const issueDetailRef=ref(null)
watch(issueId,async value=>{if(value){await nextTick();updateAssistantVisibility();if(isAssistantCollapsed.value)compactAssistantOpen.value=true}})
async function focusDossierInquiry(){
  if(isAssistantCollapsed.value) compactAssistantOpen.value=true
  await nextTick()
  assistantRef.value?.focusInquiry()
}
watch([issueId,isAssistantCollapsed],([id,collapsed])=>{if(id&&collapsed)compactAssistantOpen.value=true})
const windowWidth = ref(typeof window !== 'undefined' ? window.innerWidth : 1366)
const windowHeight = ref(typeof window !== 'undefined' ? window.innerHeight : 1024)
const isCompactAssistant = computed(() => windowWidth.value <= 900 && windowHeight.value >= windowWidth.value)
const compactFloatPos = ref(null)
const isCompactFloatDragging = ref(false)
const hasCustomCompactFloatPos = ref(false)
const COMPACT_FLOAT_SIZE = 46
const COMPACT_FLOAT_DRAG_THRESHOLD = 8
let compactFloatDragStartX = 0
let compactFloatDragStartY = 0
let compactFloatOffsetX = 0
let compactFloatOffsetY = 0
let compactFloatDidDrag = false

const situationContext = reactive({
  layer: 1,
  device: null,
  sensor: null,
  action: null
})
provide('situationContext', situationContext)

// ===== 助手面板拖拽调宽 =====
const STORAGE_KEY = 'situation-assistant-width'
const MIN_W = 280
const MAX_W = 750
const defaultAssistantWidth = computed(() => Math.round(Math.min(480, Math.max(320, windowWidth.value * 0.23))))
const LEFT_MIN_W = 470
const COLLAPSE_GAP = 16

const customWidth = ref(null)

const assistantWidthStyle = computed(() => {
  const w = customWidth.value || defaultAssistantWidth.value
  return { width: w + 'px', minWidth: w + 'px', maxWidth: w + 'px', flex: 'none' }
})

function updateAssistantVisibility() {
  const bodyWidth = situationBodyRef.value?.clientWidth || 0
  if (!bodyWidth) return
  const assistantWidth = customWidth.value || defaultAssistantWidth.value
  isAssistantCollapsed.value = bodyWidth < LEFT_MIN_W + assistantWidth + COLLAPSE_GAP
}

const compactFloatStyle = computed(() => {
  const base = compactFloatPos.value || (windowWidth.value < 768
    ? { right: 20, bottom: 52 }
    : { right: 24, bottom: 80 })
  let { right, bottom } = base
  if (compactAssistantOpen.value) {
    const panelWidth = Math.min(400, Math.max(0, windowWidth.value - 24))
    const safeRight = panelWidth + 32
    if (!hasCustomCompactFloatPos.value || right < safeRight) right = safeRight
  }
  right = Math.max(8, Math.min(right, windowWidth.value - COMPACT_FLOAT_SIZE - 8))
  bottom = Math.max(8, Math.min(bottom, windowHeight.value - COMPACT_FLOAT_SIZE - 8))
  return { right: `${right}px`, bottom: `${bottom}px` }
})

function toggleCompactAssistant() {
  if (compactFloatDidDrag) {
    compactFloatDidDrag = false
    return
  }
  compactAssistantOpen.value = !compactAssistantOpen.value
}

function startCompactFloatDrag(event) {
  if (compactAssistantOpen.value) return
  isCompactFloatDragging.value = false
  compactFloatDidDrag = false
  const isTouch = event.type === 'touchstart'
  const point = isTouch ? event.touches[0] : event
  compactFloatDragStartX = point.clientX
  compactFloatDragStartY = point.clientY
  const rect = event.currentTarget.getBoundingClientRect()
  compactFloatOffsetX = point.clientX - rect.left
  compactFloatOffsetY = point.clientY - rect.top
  if (isTouch) {
    document.addEventListener('touchmove', moveCompactFloat, { passive: false })
    document.addEventListener('touchend', stopCompactFloatDrag)
  } else {
    document.addEventListener('mousemove', moveCompactFloat)
    document.addEventListener('mouseup', stopCompactFloatDrag)
  }
}

function moveCompactFloat(event) {
  const isTouch = event.type === 'touchmove'
  const point = isTouch ? event.touches[0] : event
  const dx = point.clientX - compactFloatDragStartX
  const dy = point.clientY - compactFloatDragStartY
  if (!compactFloatDidDrag && (Math.abs(dx) > COMPACT_FLOAT_DRAG_THRESHOLD || Math.abs(dy) > COMPACT_FLOAT_DRAG_THRESHOLD)) {
    compactFloatDidDrag = true
    isCompactFloatDragging.value = true
  }
  if (!compactFloatDidDrag) return
  event.preventDefault()
  compactFloatPos.value = {
    right: Math.max(8, window.innerWidth - (point.clientX - compactFloatOffsetX + COMPACT_FLOAT_SIZE)),
    bottom: Math.max(8, window.innerHeight - (point.clientY - compactFloatOffsetY + COMPACT_FLOAT_SIZE))
  }
}

function stopCompactFloatDrag() {
  isCompactFloatDragging.value = false
  if (compactFloatDidDrag && compactFloatPos.value) hasCustomCompactFloatPos.value = true
  document.removeEventListener('mousemove', moveCompactFloat)
  document.removeEventListener('mouseup', stopCompactFloatDrag)
  document.removeEventListener('touchmove', moveCompactFloat)
  document.removeEventListener('touchend', stopCompactFloatDrag)
}

function onWindowResize() {
  windowWidth.value = window.innerWidth
  windowHeight.value = window.innerHeight
  updateAssistantVisibility()
}

let bodyResizeObserver = null
onMounted(() => {
  window.addEventListener('resize', onWindowResize)
  bodyResizeObserver = new ResizeObserver(updateAssistantVisibility)
  if (situationBodyRef.value) bodyResizeObserver.observe(situationBodyRef.value)
  requestAnimationFrame(updateAssistantVisibility)
  restoreSituationContext()
})
onUnmounted(() => {
  window.removeEventListener('resize', onWindowResize)
  if (bodyResizeObserver) bodyResizeObserver.disconnect()
  if (resizeCleanup) resizeCleanup()
  stopCompactFloatDrag()
})

let resizeCleanup = null
function startResize(e) {
  if (resizeCleanup) resizeCleanup()
  e.preventDefault()
  e.stopPropagation()

  const handle = e.currentTarget
  const pointerId = e.pointerId
  const startX = e.clientX
  const startW = customWidth.value || defaultAssistantWidth.value
  isResizingAssistant.value = true
  handle?.setPointerCapture?.(pointerId)

  const cleanup = () => {
    document.removeEventListener('pointermove', onMove)
    document.removeEventListener('pointerup', onUp)
    document.removeEventListener('pointercancel', onUp)
    if (handle?.hasPointerCapture?.(pointerId)) handle.releasePointerCapture(pointerId)
    document.body.style.cursor = ''
    document.body.style.userSelect = ''
    isResizingAssistant.value = false
    try { localStorage.setItem(STORAGE_KEY, String(customWidth.value)) } catch (_) {}
    resizeCleanup = null
  }

  const onMove = (ev) => {
    if (ev.pointerId !== pointerId) return
    ev.preventDefault()
    const dx = startX - ev.clientX
    customWidth.value = Math.min(Math.max(startW + dx, MIN_W), MAX_W)
    updateAssistantVisibility()
  }
  const onUp = (ev) => {
    if (ev?.pointerId != null && ev.pointerId !== pointerId) return
    cleanup()
  }

  resizeCleanup = cleanup
  document.addEventListener('pointermove', onMove, { passive: false })
  document.addEventListener('pointerup', onUp)
  document.addEventListener('pointercancel', onUp)
  document.body.style.cursor = 'col-resize'
  document.body.style.userSelect = 'none'
}

function resetWidth() {
  customWidth.value = null
  updateAssistantVisibility()
  try { localStorage.removeItem(STORAGE_KEY) } catch (_) {}
}

try {
  const v = parseInt(localStorage.getItem(STORAGE_KEY), 10)
  if (v >= MIN_W && v <= MAX_W) customWidth.value = v
} catch (_) {}

function layerClass(layer) {
  return {
    'layer-current': currentLayer.value === layer,
    'layer-hidden-left': currentLayer.value > layer,
    'layer-hidden-right': currentLayer.value < layer
  }
}

function goToLayer(layer) {
  currentLayer.value = layer
  situationContext.layer = layer
  situationContext.action = 'back'
  if (layer === 1) {
    sensorStore.clearDevice()
    situationStore.reset()
  } else if (layer === 2) {
    sensorView.value = 'list'
  }
}

function handleDeviceClick(device) {
  if(!device)return
  sensorSearchQuery.value = ''
  sensorView.value = 'list'
  selectedDeviceId.value = device.id
  selectedDeviceName.value = device.name
  sensorStore.setDevice(device.id)
  goToLayer(2)
  situationContext.layer = 2
  situationContext.device = { ...device }
  situationContext.action = 'select_device'
}

const deviceSituationRef = ref(null)
watch(()=>route.query.device,id=>{if(id){const device=id==='aux-system'?{id:'aux-system',name:'辅机'}:deviceStore.getDeviceById(id);if(device)handleDeviceClick(device)}},{immediate:true})
watch([attentionId,maintenanceId], async ([id, maintenance]) => {
  if(maintenance) { demoStore.clearObservationFocus();demoStore.selectAttention('maintenance');demoStore.attentionInFocus=true;demoStore.regularMaintenanceInFocus=maintenance==='planned';return }
  demoStore.regularMaintenanceInFocus=false
  if (!id) { demoStore.clearObservationFocus(); demoStore.attentionInFocus=false; return }
  if (demoStore.isTaskHandled(id)) demoStore.selectObservation(id)
  else if (demoStore.attention.some(item=>item.id===id)) {
    demoStore.clearObservationFocus()
    demoStore.selectAttention(id)
    demoStore.attentionInFocus=true
  } else { demoStore.clearObservationFocus(); demoStore.attentionInFocus=false }
}, {immediate:true,flush:'post'})
onMounted(()=>{if(maintenanceId.value){demoStore.selectAttention('maintenance');demoStore.attentionInFocus=true;demoStore.regularMaintenanceInFocus=maintenanceId.value==='planned'}})
async function returnFromIssue(deviceId){if(route.query.from==='device'){const type=route.query.type,state=route.query.state;await router.push('/situation');if(currentLayer.value!==2||selectedDeviceId.value!==deviceId)handleDeviceClick(deviceStore.getDeviceById(deviceId));await nextTick();deviceSituationRef.value?.showRelated(type,state);return}if(route.query.from==='workbench'){demoStore.showCaptainWorkbench();await router.push('/situation');return}if(route.query.from==='issues'){await router.push({path:'/situation/issues',query:{resume:'1',state:route.query.state,device:route.query.device,type:route.query.type}});return}await router.push('/situation');handleDeviceClick(deviceStore.getDeviceById(deviceId))}
async function returnToAir(){await router.push('/situation');handleDeviceClick(deviceStore.getDeviceById('air-compressor'))}
async function returnToAttention() {
  await router.push('/situation')
  if (currentLayer.value !== 2 || selectedDeviceId.value !== 'main-engine-1') openDemoDevice()
  await nextTick()
  deviceSituationRef.value?.showAttentionList()
}
async function returnToMaintenance() {
  await router.push('/situation')
  if(currentLayer.value!==2 || selectedDeviceId.value!=='main-engine-1')openDemoDevice()
  await nextTick()
  deviceSituationRef.value?.showMaintenanceList()
}
function openMaintenanceEvent(){demoStore.selectTodo('maintenance');router.push({path:'/event',query:{todo:'maintenance'}})}
onActivated(async () => { const id=route.query.observation; if(id && demoStore.isTaskHandled(id)){openDemoDevice();await nextTick();deviceSituationRef.value?.openObservation(id)} })
async function openDemoItem(id) {
  const target=resolveIssueNavigation(id)
  if(target.id!==id){await router.push({path:'/situation/issue/'+target.id,query:{tab:target.tab,recommendation:target.recommendationId}});return}
  if(issueCatalog.some(i=>i.id===id)&&!demoStore.todoCreated[id]){await router.push('/situation/issue/'+id);return}
  if(id==='fault'){demoStore.selectTodo(id);await router.push({path:'/event',query:{todo:id}});return}
  await router.push(id==='maintenance'?'/situation/maintenance/maintenance':'/situation/attention/'+id)
}

function openDemoDevice() {
  const device = deviceStore.getDeviceById('main-engine-1')
  if (device) handleDeviceClick(device)
}

function openDemoTodo() {
  demoStore.selectTodo('fault')
  router.push({path:'/event',query:{todo:'fault'}})
}

function handleSensorClick(sensor) {
  sensorStore.selectSensor(sensor.id)
  selectedSensorName.value = sensor.nameEn + ' · ' + sensor.nameCn
  sensorView.value = 'trend'
  situationContext.layer = 2
  situationContext.sensor = { ...sensor }
  situationContext.action = 'select_sensor'
}

function restoreSituationContext() {
  if (currentLayer.value === 1) {
    situationContext.layer = 1
    situationContext.device = null
    situationContext.sensor = null
    situationContext.action = 'enter_layer'
    return
  }

  const device = sensorStore.currentDeviceId && selectedDeviceId.value
    ? { id: selectedDeviceId.value, name: selectedDeviceName.value }
    : null
  const sensor = sensorStore.selectedSensor

  situationContext.layer = currentLayer.value
  situationContext.device = device
  situationContext.sensor = sensor ? { ...sensor } : null
  situationContext.action = 'restore_layer'
}

function setSensorView(view) {
  if (view === sensorView.value) return

  if (view === 'trend') {
    const sensor = visibleSensors.value.find((item) => item.id === sensorStore.selectedSensorId)
      || visibleSensors.value[0]
    if (sensor) {
      sensorStore.selectSensor(sensor.id)
      selectedSensorName.value = sensor.nameEn + ' · ' + sensor.nameCn
      situationContext.sensor = { ...sensor }
    }
    sensorView.value = 'trend'
    situationContext.layer = 2
    situationContext.action = 'switch_trend_view'
    return
  }

  sensorView.value = 'list'
  situationContext.layer = 2
  situationContext.action = 'switch_list_view'
}

function openQuickReport(prefill) {
  reportPrefill.value = { ...prefill }
  reportDialogOpen.value = true
}

function submitAbnormalReport(report) {
  createAbnormalEvent(report, '异常报告提交（态势趋势快速上报）')
  reportDialogOpen.value = false
  ElMessage({ type: 'success', message: '异常报告已提交，可在事件中心查看', duration: 2400 })
}

situationContext.layer = currentLayer.value
situationContext.action = currentLayer.value === 1 ? 'enter_layer' : 'restore_layer'
</script>

<style scoped>
.situation-view {
  flex: 1;
  display: flex;
  flex-direction: column;
  height: 100%;
  padding: 12px;
  box-sizing: border-box;
  background: #F5F7FA;
  overflow: hidden;
}

.situation-body {
  flex: 1;
  display: flex;
  position: relative;
  overflow: hidden;
  min-height: 0;
}

.situation-content {
  flex: 1;
  position: relative;
  overflow: hidden;
  min-width: 0;
  border-radius: 8px;
  background: #FFFFFF;
}

.layer {
  position: absolute; inset: 0;
  display: flex; flex-direction: column;
  transition: transform 0.35s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.3s ease;
  overflow: hidden;
}
.layer-current { transform: translateX(0); opacity: 1; z-index: 2; }
.layer-hidden-left { transform: translateX(-100%); opacity: 0; pointer-events: none; z-index: 1; }
.layer-hidden-right { transform: translateX(100%); opacity: 0; pointer-events: none; z-index: 1; }

.layer-header {
  height: 48px;
  box-sizing: border-box;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 0 16px;
  background: #FFFFFF;
  border-bottom: 1px solid #E4E7ED;
  flex-shrink: 0;
  z-index: 5;
}

.back-btn {
  width: 28px;
  height: 28px;
  flex: 0 0 28px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  border: 1px solid #E4E7ED;
  border-radius: 8px;
  background: #FFFFFF;
  color: #6C7183;
  cursor: pointer;
  transition: border-color 0.16s, color 0.16s, background 0.16s;
}
.back-btn svg {
  width: 18px;
  height: 18px;
  fill: none;
  stroke: currentColor;
  stroke-width: 1.8;
  stroke-linecap: round;
  stroke-linejoin: round;
}
.back-btn:hover {
  border-color: #BFD4FF;
  background: #F3F7FF;
  color: #106BFF;
}
.layer-subtitle {
  min-width: 0;
  flex: 0 1 auto;
  overflow: hidden;
  color: #19213D;
  font-size: 14px;
  line-height: 24px;
  font-weight: 700;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.layer-header-tools {
  min-width: 0;
  margin-left: auto;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
}
.device-data-toolbar {
  display: flex;
  justify-content: flex-end;
  align-items: center;
  gap: 8px;
  margin: 3px 0 10px;
}
.layer-header-search {
  width: clamp(160px, 32%, 240px);
  height: 32px;
  box-sizing: border-box;
  display: flex;
  align-items: center;
  gap: 7px;
  padding: 0 10px;
  border: 1px solid #E4E7ED;
  border-radius: 6px;
  background: #F7F8FA;
  color: #9195A2;
  transition: border-color 0.16s, background 0.16s, box-shadow 0.16s;
}
.layer-header-search:focus-within {
  border-color: #BFD4FF;
  background: #FFFFFF;
  box-shadow: 0 0 0 2px rgba(16, 107, 255, 0.08);
}
.layer-header-search svg {
  width: 16px;
  height: 16px;
  flex: none;
  fill: none;
  stroke: currentColor;
  stroke-width: 1.8;
  stroke-linecap: round;
}
.layer-header-search input {
  min-width: 0;
  flex: 1;
  padding: 0;
  border: 0;
  outline: 0;
  background: transparent;
  color: #19213D;
  font: inherit;
  font-size: 13px;
  line-height: 20px;
}
.layer-header-search input::placeholder { color: #9195A2; }
.layer-header-search input::-webkit-search-cancel-button { cursor: pointer; }
.sensor-view-switch {
  height: 32px;
  box-sizing: border-box;
  display: inline-flex;
  align-items: center;
  gap: 2px;
  padding: 2px;
  border: 1px solid #E4E7ED;
  border-radius: 8px;
  background: #F5F7FA;
}
.sensor-view-switch button {
  width: 28px;
  height: 26px;
  padding: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: #6C7183;
  font: inherit;
  font-size: 13px;
  line-height: 20px;
  cursor: pointer;
  white-space: nowrap;
  transition: color 0.16s ease, background-color 0.16s ease, box-shadow 0.16s ease;
}
.sensor-view-icon {
  display: block;
  width: 16px;
  height: 16px;
  background: currentColor;
}
.sensor-view-icon-list {
  -webkit-mask: url('/ui-icons/view-list.svg') center / contain no-repeat;
  mask: url('/ui-icons/view-list.svg') center / contain no-repeat;
}
.sensor-view-icon-trend {
  -webkit-mask: url('/ui-icons/view-trend.svg') center / contain no-repeat;
  mask: url('/ui-icons/view-trend.svg') center / contain no-repeat;
}
.sensor-view-switch button:hover { color: #106BFF; }
.sensor-view-switch button.active {
  background: #FFFFFF;
  color: #106BFF;
  font-weight: 600;
  box-shadow: 0 1px 3px rgba(25, 33, 61, 0.1);
}
.sensor-view-switch button:focus-visible {
  outline: 2px solid #106BFF;
  outline-offset: 1px;
}

/* ===== 拖拽手柄 ===== */
.panel-resize-handle {
  width: 12px;
  cursor: col-resize;
  touch-action: none;
  user-select: none;
  flex: none;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 50;
  position: relative;
  background: transparent;
}
.panel-resize-grip {
  width: 4px;
  height: 104px;
  border-radius: 999px;
  background: #D3D5DD;
  opacity: 0;
  transform: scaleY(0.82);
  transition: opacity 0.16s ease, transform 0.16s ease;
  pointer-events: none;
}
.panel-resize-handle:hover .panel-resize-grip,
.panel-resize-handle:active .panel-resize-grip,
.panel-resize-handle.resizing .panel-resize-grip {
  opacity: 1;
  transform: scaleY(1);
}

/* ===== 助手面板容器 ===== */
.assistant-wrapper {
  flex: none;
  min-height: 0;
  overflow: hidden;
  border-radius: 8px;
  background: #FFFFFF;
}
/* 覆盖 AssistantPanel 自身的 flex/min-width，让外层 wrapper 完全掌控宽度 */
.assistant-wrapper :deep(.assistant-panel), .assistant-wrapper :deep(.p2-assistant) {
  flex: 1 1 auto !important;
  min-width: 0 !important;
  width: 100% !important;
}

/* 与事件详情一致：空间不足时助手以可展开悬浮面板呈现 */
.compact-assistant-float {
  position: fixed;
  z-index: 1002;
  width: 46px;
  height: 46px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  border: 0;
  border-radius: 50%;
  background: #106BFF;
  box-shadow: 0 4px 16px rgba(22, 119, 255, 0.35);
  cursor: pointer;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  user-select: none;
  touch-action: none;
}
.compact-assistant-float:hover { transform: scale(1.08); box-shadow: 0 6px 24px rgba(22, 119, 255, 0.5); }
.compact-assistant-float:active { transform: scale(0.95); }
.compact-assistant-float.is-active { box-shadow: 0 4px 20px rgba(22, 119, 255, 0.55); }
.compact-assistant-float.is-dragging { cursor: grabbing; transform: scale(1.04) !important; transition: none !important; box-shadow: 0 8px 28px rgba(16, 107, 255, 0.5); }
.compact-assistant-icon { display: block; width: 24px; height: 24px; object-fit: contain; pointer-events: none; user-select: none; }
.compact-assistant-x { font-size: 17px; color: #fff; font-weight: 600; line-height: 1; }
.assistant-wrapper.compact-assistant-overlay {
  position: absolute;
  top: 0;
  right: 0;
  bottom: 0;
  z-index: 90;
  width: min(400px, calc(100% - 24px)) !important;
  height: auto !important;
  min-width: 0 !important;
  max-width: none !important;
  border-radius: 8px;
  box-shadow: -6px 0 24px rgba(25, 33, 61, 0.16);
}
.compact-assistant-slide-enter-active,
.compact-assistant-slide-leave-active { transition: transform 0.22s ease, opacity 0.18s ease; }
.compact-assistant-slide-enter-from,
.compact-assistant-slide-leave-to { opacity: 0; transform: translateX(24px); }

@media (max-width: 760px) {
  .layer-header { gap: 6px; padding: 0 12px; }
  .layer-header-tools { flex: 1 1 auto; }
  .device-data-toolbar .layer-header-search { min-width: 0; flex: 1 1 144px; width: auto; }
  .layer-header-search { min-width: 0; flex: 1 1 144px; width: auto; }
  .sensor-view-switch button { padding: 0 8px; }
}

@media (max-width: 900px) and (orientation: portrait) {
  .situation-view { position: relative; padding: 12px; }
  .compact-assistant-float {
    position: fixed;
    z-index: 1002;
    width: 46px;
    height: 46px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 0;
    border: 0;
    border-radius: 50%;
    background: #106BFF;
    box-shadow: 0 4px 16px rgba(22, 119, 255, 0.35);
    cursor: pointer;
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    user-select: none;
    touch-action: none;
  }
  .compact-assistant-float:hover { transform: scale(1.08); box-shadow: 0 6px 24px rgba(22, 119, 255, 0.5); }
  .compact-assistant-float:active { transform: scale(0.95); }
  .compact-assistant-float.is-active { box-shadow: 0 4px 20px rgba(22, 119, 255, 0.55); }
  .compact-assistant-float.is-dragging { cursor: grabbing; transform: scale(1.04) !important; transition: none !important; box-shadow: 0 8px 28px rgba(16, 107, 255, 0.5); }
  .compact-assistant-icon { display: block; width: 24px; height: 24px; object-fit: contain; pointer-events: none; user-select: none; }
  .compact-assistant-x { font-size: 17px; color: #fff; font-weight: 600; line-height: 1; }
  .assistant-wrapper.compact-assistant-overlay {
    position: absolute;
    top: 12px;
    right: 12px;
    bottom: 12px;
    z-index: 90;
    width: min(400px, calc(100% - 24px)) !important;
    height: auto !important;
    min-width: 0 !important;
    max-width: none !important;
    border-radius: 8px;
    box-shadow: -6px 0 24px rgba(25, 33, 61, 0.16);
  }
  .compact-assistant-slide-enter-active,
  .compact-assistant-slide-leave-active { transition: transform 0.22s ease, opacity 0.18s ease; }
  .compact-assistant-slide-enter-from,
  .compact-assistant-slide-leave-to { opacity: 0; transform: translateX(24px); }
}

</style>
