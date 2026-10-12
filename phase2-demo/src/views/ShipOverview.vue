<template>
  <div class="ship-overview">
    <!-- 顶部标题栏：来自 Figma 132:695 -->
    <div class="status-header">
      <div class="sh-left">
        <img class="sh-icon" src="/detail-assets/device-situation-icon.svg" alt="" aria-hidden="true" />
        <span class="sh-title">船舶态势</span>

      </div>
    </div>


    <!-- 中部：船舶数字孪生 + 浮动设备卡 -->
    <div ref="shipBodyRef" class="ship-body-container">

      <div class="ship-scene" :class="{ 'is-compact': isCompactScene }">
        <img src="/ship-hologram-v6.png" class="ship-img" alt="清晰通透的蓝色全息工业船舶数字孪生模型" />

        <svg class="device-link-layer" width="100%" height="100%" aria-hidden="true">
          <g v-for="device in floatingDevices" :key="`link-${device.id}`">
            <line
              :x1="device.anchor.x"
              :y1="device.anchor.y"
              :x2="device.position.x"
              :y2="device.position.y"
              class="device-link-line"
            />
            <circle :cx="device.anchor.x" :cy="device.anchor.y" r="5" class="device-anchor-ring" />
            <circle :cx="device.anchor.x" :cy="device.anchor.y" r="2" class="device-anchor-dot" />
          </g>
        </svg>

        <!-- 浮动设备卡与船体共用同一坐标系，缩放时关系不会漂移 -->
        <div
          v-for="device in floatingDevices"
          :key="device.id"
          class="float-dev-card"
          :class="[
            { danger: device.status === 'danger', warning: device.status === 'warning' },
            `device-${device.id}`
          ]"
          :style="{ left: device.position.x, top: device.position.y }"
          tabindex="0" role="group"
          :aria-label="`${device.name}运行情况`"
          @click="$emit('selectDevice', device)"
          @keydown.enter.self="$emit('selectDevice', device)"
          @keydown.space.self.prevent="$emit('selectDevice', device)"
        >
          <button type="button" class="fdc-name-row fdc-open" :aria-label="`查看${device.name}设备概览`" @click.stop="emit('selectDevice',device)">
            <span class="fdc-name">{{ device.name }}</span>
            <span class="fdc-link-arrow" aria-hidden="true">→</span>
          </button>
          <div class="fdc-status-row"><span class="fdc-dot" :class="device.status" :aria-label="device.status==='danger'?'异常':device.status==='warning'?'关注':'正常'"></span><span class="fdc-caption">{{ device.id==='main-engine-1'?decisionItems.length+' 项关注 · '+activeTasks.length+' 项待办':'运行状态' }}</span></div>
          <template v-if="device.id==='main-engine-1'"><button v-for="item in decisionItems" :key="item.id" class="fdc-issue" @click.stop="emit('selectItem',item.id)"><small>关注</small>{{ item.title }}</button><button v-for="task in activeTasks" :key="task.id" class="fdc-issue" @click.stop="openTask(task.id)"><small>待办</small>{{ task.initialTitle }}</button></template>
          <button v-for="task in tasksFor(device)" :key="task.id" class="fdc-issue" @click.stop="openTask(task.id)"><small>待办</small>{{ task.initialTitle }}</button><p v-if="device.id!=='main-engine-1' && !tasksFor(device).length" class="fdc-reading">{{ device.metrics.map(metric=>metric.label+metric.value+metric.unit).join(' · ') }}</p>

        </div>
      </div>
    </div>

    <section class="ship-brief"><header><strong>AI 全船运行概况</strong><span>{{ decisionItems.length }} 项待决策关注 · {{ allActiveTasks.length }} 项待办推进中</span></header><MarkdownContent :content="shipMarkdown"/></section>
    <!-- 底部：船舶工况条 -->
    <div class="ship-work-cond">
      <div class="wc-item">
        <span class="wc-label">工况</span>
        <span class="wc-value sailing"><i aria-hidden="true"></i>航行中</span>
      </div>
      <div class="wc-divider"></div>
      <div class="wc-item">
        <span class="wc-label">航向</span>
        <span class="wc-value">{{ deviceStore.ship.heading }}°</span>
      </div>
      <div class="wc-divider"></div>
      <div class="wc-item">
        <span class="wc-label">航速</span>
        <span class="wc-value">{{ deviceStore.ship.speed }} kn</span>
      </div>
      <div class="wc-divider"></div>
      <div class="wc-item">
        <span class="wc-label">主机转速</span>
        <span class="wc-value">450 rpm</span>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue'
import MarkdownContent from '@/components/MarkdownContent.vue'
import { fleetAssessment } from '@/mock/captainAssessments'
import { useRouter } from 'vue-router'
import { useElementSize } from '@vueuse/core'
import { useDeviceStore } from '@/stores/deviceStore'
import { usePhase2DemoStore } from '@/stores/phase2DemoStore'

const emit = defineEmits(['selectDevice','selectItem'])
const router=useRouter()


const deviceStore = useDeviceStore()
const demoStore = usePhase2DemoStore()
const shipReport=computed(()=>fleetAssessment(demoStore))
const allActiveTasks=computed(()=>demoStore.visibleTodos.filter(task=>!demoStore.isTaskHandled(task.id)))
const activeTasks=computed(()=>allActiveTasks.value.filter(task=>!task.deviceId || task.deviceId==='main-engine-1'))
const tasksFor=device=>allActiveTasks.value.filter(task=>task.deviceId===device.id)
const shipMarkdown=computed(()=>`**当前结论**\n\n${shipReport.value.conclusion}\n\n**综合依据**\n\n${shipReport.value.basis}\n\n**下一步建议**\n\n${shipReport.value.recommendation}`)
const decisionItems=computed(()=>[
 {id:'drift',title:'3号缸排温偏离扩大',summary:'同工况相对偏差由8°C扩大至10°C，建议先核实仪表与现场现象。'},
 {id:'maintenance',title:'连杆轴承提前检查建议',summary:'近7日振动2.1→3.0 mm/s，距周期检修约140小时，建议评估检查时机。'}
].filter(item=>!demoStore.todoCreated[item.id]&&!demoStore.ignoredSuggestions[item.id]))
function openTask(id){demoStore.selectTodo(id);router.push({path:'/event',query:{todo:id}})}
const shipBodyRef = ref(null)
const { width: shipBodyWidth } = useElementSize(shipBodyRef)
const isCompactScene = computed(() => shipBodyWidth.value > 0 && shipBodyWidth.value <= 720)
const compactCardX = (ratio) => {
  const cardHalfWidth = 120
  const edgeGutter = 8
  const safeInset = cardHalfWidth + edgeGutter
  const sceneWidth = shipBodyWidth.value
  const desiredX = sceneWidth * ratio
  const safeX = Math.min(Math.max(desiredX, safeInset), sceneWidth - safeInset)
  return `${Math.round(safeX)}px`
}

const openEventCounts = computed(() => {
  return {'main-engine-1':demoStore.visibleTodos.filter(todo=>!demoStore.isTaskHandled(todo.id)).length}
})

// 4 个关键设备的浮动位置（侧视图船体：船头朝左，船尾朝右）
const floatingDevices = computed(() => {
  const devices = deviceStore.devices.filter(d =>
    ['main-engine-1', 'aux-engine-2','boiler', 'steering-gear', 'air-compressor'].includes(d.id)
  )
  // 卡片围绕船身排布；窄画布使用错层布局，避免 150px 卡片互相覆盖
  const desktopPositions = {
    'aux-engine-2': {position:{x:'52%',y:'21%'},anchor:{x:'58%',y:'50%'}},
    'main-engine-1': {
      position: { x: '42%', y: '74%' },
      anchor: { x: '68%', y: '55%' }
    },
    'boiler': {
      position: { x: '72%', y: '31%' },
      anchor: { x: '68%', y: '45%' }
    },
    'steering-gear': {
      position: { x: '83%', y: '70%' },
      anchor: { x: '79%', y: '50%' }
    },
    'air-compressor': {
      position: { x: '27%', y: '34%' },
      anchor: { x: '48%', y: '53%' }
    }
  }
  const compactPositions = {
    'aux-engine-2': {position:{x:'50%',y:'48%'},anchor:{x:'58%',y:'50%'}},
    'main-engine-1': {
      position: { x: compactCardX(0.24), y: '75%' },
      anchor: { x: '69.8%', y: '55.5%' }
    },
    'boiler': {
      position: { x: compactCardX(0.76), y: '27%' },
      anchor: { x: '69.8%', y: '44.5%' }
    },
    'steering-gear': {
      position: { x: compactCardX(0.76), y: '75%' },
      anchor: { x: '81.9%', y: '50%' }
    },
    'air-compressor': {
      position: { x: compactCardX(0.24), y: '28%' },
      anchor: { x: '47.8%', y: '53.3%' }
    }
  }
  const positions = isCompactScene.value ? compactPositions : desktopPositions
  return devices.map(d => ({
    ...d,
    status:tasksFor(d).length?'danger':d.id==='main-engine-1'?(demoStore.progress.fault<4||demoStore.todoCreated.drift&&demoStore.progress.drift>=2&&demoStore.progress.drift<6?'danger':demoStore.monitorStep.stable<2||!demoStore.todoCreated.drift||!demoStore.todoCreated.maintenance?'warning':'normal'):d.status,
    position: positions[d.id]?.position || { x: '50%', y: '50%' },
    anchor: positions[d.id]?.anchor || { x: '50%', y: '50%' },
    openEventCount: openEventCounts.value[d.id] || 0
  }))
})

const circumference = 2 * Math.PI * 22 // ~138.2
const healthOffset = computed(() => {
  return circumference - ((deviceStore.ship.healthScore || 0) / 100 * circumference)
})
</script>

<style scoped>
.ship-overview {
  height: 100%;
  display: flex;
  flex-direction: column;
  background: #F3F7FF;
  overflow: hidden;
}

/* ===== 顶部状态条 ===== */
.status-header {
  height: 48px;
  box-sizing: border-box;
  padding: 0 16px;
  background: #FFFFFF;
  display: flex;
  align-items: center;
  flex-shrink: 0;
}
.sh-left {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}
.sh-icon { width: 20px; height: 20px; display: block; }
.sh-title {
  color: #19213D;
  font-size: 14px;
  line-height: 24px;
  font-weight: 500;
}
.sh-demo-tag { border-radius: 10px; background: #F1F5FA; color: #77869A; padding: 3px 8px; font-size: 11px; line-height: 1.4; }
.sh-meta {
  position: absolute;
  top: 12px;
  left: 12px;
  right: 12px;
  z-index: 20;
  display: flex;
  align-items: center;
  gap: 16px;
  min-height: 64px;
  box-sizing: border-box;
  padding: 8px 16px;
  border-radius: 8px;
  border: 1px solid rgba(255,255,255,0.72);
  background: rgba(255,255,255,0.94);
  backdrop-filter: blur(8px);
  box-shadow: 0 4px 16px rgba(0,8,20,0.10);
}
.sh-meta-item {
  flex: 1 1 112px;
  min-width: 88px;
  display: flex;
  flex-direction: column;
  justify-content: center;
}
.sh-meta-label {
  color: #6C7183;
  font-size: 12px;
  line-height: 20px;
  font-weight: 500;
}
.sh-meta-value {
  color: #19213D;
  font-size: 14px;
  line-height: 24px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}
.sh-meta-value.online {
  color: var(--success);
}
.sh-meta-health {
  position: relative;
  width: 48px;
  height: 48px;
  flex-shrink: 0;
  margin-left: auto;
}
.sh-health-text {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  font-size: 13px;
  font-weight: 700;
  color: #19213D;
  font-variant-numeric: tabular-nums;
}

/* ===== 中部船体 ===== */
.ship-body-container {
  flex: 1;
  position: relative;
  overflow: hidden;
  /* 取自图片上下边缘的实际色值，让不同屏幕比例下的留白自然延展 */
  background: linear-gradient(180deg, #001133 0%, #001235 100%);
}
.ship-scene {
  position: absolute;
  left: 50%;
  top: 57%;
  width: 112%;
  aspect-ratio: 1672 / 941;
  transform: translate(-50%, -50%);
  z-index: 1;
}
.ship-scene.is-compact {
  /* 卡片坐标层保持在可视区域内，船图在内部独立放大 */
  width: 100%;
}
.ship-scene.is-compact .ship-img {
  transform: scale(1.1);
  transform-origin: center;
}
.ship-img {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: fill;
  z-index: 1;
  -webkit-mask-image: linear-gradient(to bottom, transparent 0%, #000 5%, #000 93%, transparent 100%);
  mask-image: linear-gradient(to bottom, transparent 0%, #000 5%, #000 93%, transparent 100%);
}
.device-link-layer {
  position: absolute;
  inset: 0;
  z-index: 5;
  overflow: visible;
  pointer-events: none;
}
.device-link-line {
  stroke: rgba(103, 207, 255, 0.34);
  stroke-width: 1;
  stroke-linecap: round;
  vector-effect: non-scaling-stroke;
}
.device-anchor-ring {
  fill: rgba(5, 33, 62, 0.72);
  stroke: rgba(103, 207, 255, 0.38);
  stroke-width: 1;
  vector-effect: non-scaling-stroke;
}
.device-anchor-dot {
  fill: #67CFFF;
  filter: drop-shadow(0 0 4px rgba(103, 207, 255, 0.75));
}

/* ===== 浮动设备卡 ===== */
.float-dev-card {
  position: absolute;
  width: 232px;
  min-width: 0;
  box-sizing: border-box;
  padding: 15px 16px;
  border: 1px solid rgba(105,199,255,0.26);
  border-radius: 8px;
  background: rgba(7,29,51,0.88);
  backdrop-filter: blur(8px);
  cursor: pointer;
  transition: transform 0.18s ease, border-color 0.18s ease, box-shadow 0.18s ease;
  z-index: 10;
  box-shadow: 0 8px 24px rgba(0,10,28,0.30);
  transform: translate(-50%, -50%);
}
.float-dev-card:hover {
  border-color: #66D0FF;
  transform: translate(-50%, calc(-50% - 2px));
  box-shadow: 0 10px 28px rgba(0,16,38,0.42), 0 0 0 1px rgba(102,208,255,0.10);
}
.float-dev-card:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}
.float-dev-card.danger {
  border-color: rgba(255,103,116,0.44);
}
.float-dev-card.warning {
  border-color: rgba(255,174,92,0.44);
}
.float-dev-card.danger:hover {
  border-color: #FF6774;
  box-shadow: 0 10px 28px rgba(0,16,38,0.42), 0 0 0 1px rgba(255,103,116,0.22), 0 0 18px rgba(255,103,116,0.16);
}
.float-dev-card.warning:hover {
  border-color: #FFAE5C;
  box-shadow: 0 10px 28px rgba(0,16,38,0.42), 0 0 0 1px rgba(255,174,92,0.22), 0 0 18px rgba(255,174,92,0.16);
}

.fdc-name-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 6px;
  margin-bottom: 4px;
}
.fdc-name {
  font-size: var(--font-base);
  font-weight: 600;
  color: #F4F8FF;
}
.fdc-link-arrow {
  margin-left: auto;
  color: #67CFFF;
  font-size: var(--font-base);
  line-height: 1;
  transition: transform 0.18s ease;
}
.float-dev-card:hover .fdc-link-arrow {
  transform: translateX(2px);
}
.fdc-status-row {
  display: flex;
  align-items: center;
  gap: 5px;
  min-height: 20px;
}
.fdc-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
}
.fdc-dot.danger { background: var(--danger); }
.fdc-dot.warning { background: var(--warning); }
.fdc-dot.normal { background: var(--success); }

.fdc-status {
  font-size: var(--font-sm);
  font-weight: 500;
}
.fdc-status.danger { color: var(--danger); }
.fdc-status.warning { color: var(--warning); }
.fdc-status.normal { color: var(--success); }
.fdc-event-badge {
  margin-left: auto;
  padding: 0 6px;
  border: 1px solid rgba(185, 201, 216, 0.20);
  border-radius: 999px;
  background: rgba(185, 201, 216, 0.08);
  color: #B9C9D8;
  font-size: 11px;
  line-height: 18px;
  font-weight: 500;
  white-space: nowrap;
}
/* ===== 底部工况条 ===== */
.ship-work-cond {
  height: 32px;
  box-sizing: border-box;
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 4px 16px;
  background: #FFFFFF;
  flex-shrink: 0;
}
.wc-item {
  display: flex;
  align-items: center;
  gap: 4px;
  white-space: nowrap;
}
.wc-label {
  color: #6C7183;
  font-size: 12px;
  line-height: 20px;
  font-weight: 500;
}
.wc-value {
  color: #19213D;
  font-size: 14px;
  line-height: 24px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}
.wc-value.sailing {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  color: var(--success);
  font-weight: 400;
}
.wc-value.sailing i { width: 6px; height: 6px; border-radius: 50%; background: currentColor; }
.wc-divider {
  width: 1px;
  height: 16px;
  background: #EBEEF5;
}

@media (max-width: 980px) {
  .sh-meta { gap: 10px; padding-inline: 12px; }
  .sh-meta-item { min-width: 72px; }
  .float-dev-card { min-width: 100px; }
}
.fdc-caption{color:#a5c5d6;font-size:12px}.fdc-issue{display:block;border:0;border-top:1px solid #284356;background:transparent;color:#dfedf4;padding:9px 0;width:100%;text-align:left;font-size:13px;line-height:1.5;cursor:pointer}.fdc-issue small{color:#91b5c9;margin-right:8px}.fdc-issue:hover{color:#fff;background:#19394c}.fdc-reading{font-size:13px;color:#abc7d9;margin:8px 0 0}.fdc-name{font-size:17px}.ship-scene{width:100%;top:55%}.ship-overview .float-dev-card{width:232px;max-width:calc(100% - 16px)}@media(max-width:1100px){.ship-overview{grid-template-columns:minmax(0,1fr) 310px}.ship-assessment{padding:16px}.ship-overview .float-dev-card{width:210px}}@media(max-width:780px){.ship-overview{overflow:auto;display:flex}.ship-body-container{min-height:520px;flex:none}.ship-assessment{overflow:visible}.ship-work-cond{flex-shrink:0}}
.fdc-open{width:100%;border:0;padding:0;background:none;color:inherit;cursor:pointer;text-align:left;font:inherit}.fdc-open:focus-visible,.fdc-issue:focus-visible{outline:2px solid #7edaff;outline-offset:4px}
 .ship-overview{display:flex;position:relative;overflow:auto}.ship-body-container{flex:1 0 450px;min-height:450px}.ship-overview .ship-scene{width:100%;height:100%;aspect-ratio:auto;top:50%}.ship-img{object-fit:contain}.ship-brief{flex:none;background:#fff;padding:20px 28px;border-top:1px solid #e2e7ee;color:#35465d}.ship-brief header{display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;gap:16px}.ship-brief header strong{font-size:17px}.ship-brief header span{font-size:13px;color:#7a8595}.ship-brief :deep(.markdown-content){max-width:1200px}.ship-work-cond{flex:none}.ship-scene .device-main-engine-1{max-height:280px;overflow:auto}@media(max-width:900px){.ship-body-container{min-height:540px;flex-basis:540px}.ship-brief{padding:18px}.ship-brief header{align-items:flex-start;flex-direction:column}}
</style>
