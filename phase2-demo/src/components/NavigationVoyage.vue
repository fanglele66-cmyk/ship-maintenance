<template>
 <section class="voyage" aria-label="航行阶段时间线，从早到晚">
  <div class="voyage-scroll">
   <ol class="voyage-timeline">
    <li v-for="(stage,index) in stages" :key="stage.id" class="voyage-stage" :class="[stage.tone,stage.severity,{'is-latest':index===stages.length-1}]" :style="{'--stage-delay':index*80+'ms','--flow-delay':index*.7+'s'}">
     <div class="stage-clock"><time :datetime="new Date(stage.start).toISOString()">{{shortTime(stage.start)}}</time><span aria-hidden="true">—</span><time :datetime="new Date(stage.end).toISOString()">{{shortTime(stage.end)}}</time></div>
     <div class="stage-track" aria-hidden="true"><i class="track-node"/><span class="track-line"/><svg v-if="index<stages.length-1" viewBox="0 0 8 12"><path d="m2 2 4 4-4 4"/></svg></div>
     <div class="stage-content">
      <header class="stage-heading"><h3>{{stage.status}}</h3><span v-if="index===stages.length-1" class="latest-label">最近阶段</span></header>
      <p class="stage-description">{{stage.detail}}</p>
      <div v-if="index<stages.length-1" class="stage-average"><span>平均航速</span><strong>{{stage.averageSpeed.toFixed(1)}} <small>kn</small></strong></div>
      <dl class="stage-operations"><div><dt>{{index===stages.length-1?'推进方式':'航行变化'}}</dt><dd>{{stage.operation}}</dd></div><div><dt>负荷变化</dt><dd>{{stage.loadTrend}}</dd></div></dl>
      <section v-if="captain&&stage.concerns.length" class="stage-concerns" aria-label="本阶段提醒处置概况"><p class="concern-label">本阶段关联提醒</p>
       <div v-for="concern in stage.concerns" :key="concern.device" :class="concern.severity">
        <strong><i aria-hidden="true"/>{{concern.device}}<span class="concern-types">{{concern.types.map(t=>t.label.replace('事件','')+' '+t.count).join(' · ')}}</span></strong>
        <p>{{concern.states.map(s=>s.label+' '+s.count).join(' · ')}}</p>
       </div>
      </section>
      <p v-else-if="captain&&index===stages.length-1" class="stage-clear">本阶段无关联提醒</p>
     </div>
    </li>
   </ol>
  </div>
 </section>
</template>
<script setup>
import {computed} from 'vue'
import {navigationStages} from '../workflow/navigationStages.js'
const props=defineProps({periods:{type:Array,required:true},events:{type:Array,default:()=>[]},captain:{type:Boolean,default:false}})
const stages=computed(()=>navigationStages(props.periods,props.events,{captain:props.captain}).slice(-4))
const shortTime=at=>new Date(at).toLocaleString('zh-CN',{month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false,timeZone:'Asia/Shanghai'})
</script>
<style scoped>
.voyage{position:relative;padding:0 20px 18px;min-width:0;color:#435765}
.voyage-scroll{overflow-x:auto;scrollbar-width:thin;scrollbar-color:#d6ddd8 transparent}
.voyage-timeline{display:grid;grid-template-columns:repeat(3,minmax(190px,1fr)) minmax(280px,1.35fr);list-style:none;padding:3px 0 0;margin:0!important}
.voyage-stage{--stage-color:#327c65;--track-color:var(--stage-color);min-width:0;animation:stage-enter .6s both;animation-delay:var(--stage-delay)}
.voyage-stage.anchored{--stage-color:#73608e}.voyage-stage.maneuver{--stage-color:#967025}.voyage-stage.accelerating{--stage-color:#357c9b}
.stage-clock{display:flex;align-items:center;gap:6px;font-size:13px;line-height:1.6;color:#657774;font-variant-numeric:tabular-nums;white-space:nowrap}
.stage-clock>span{color:#b0b7b2}
.stage-track{height:29px;display:flex;align-items:center;position:relative;padding-right:3px}
.track-node{position:relative;z-index:1;width:7px;height:7px;flex:none;border-radius:50%;background:var(--track-color);box-shadow:0 0 0 3px #fff,0 0 9px color-mix(in srgb,var(--track-color) 20%,transparent)}
.track-node:after{content:'';position:absolute;inset:-4px;border:1px solid var(--track-color);border-radius:50%;animation:node-glow 5s ease-out infinite;animation-delay:var(--flow-delay);opacity:0}
.track-line{position:relative;height:2px;flex:1;overflow:hidden;background:linear-gradient(90deg,#cbd8d2,#e4ebe6);transform-origin:left;animation:track-reveal .8s both;animation-delay:var(--stage-delay)}
.track-line:after{content:'';position:absolute;inset:-1px 0;background:linear-gradient(90deg,transparent 15%,color-mix(in srgb,var(--track-color) 35%,transparent) 68%,var(--track-color) 85%,#fff 88%,transparent 96%);transform:translateX(-100%);animation:track-flow 5s linear infinite;animation-delay:var(--flow-delay)}
.stage-track svg{width:6px;height:10px;flex:none;stroke:var(--track-color);fill:none;stroke-width:1.5;margin-right:10px;animation:arrow-flow 5s ease-in-out infinite;animation-delay:var(--flow-delay);opacity:.65}
.voyage-stage:last-child .track-line{background:linear-gradient(90deg,#9fbdb0,#edf3ef00);margin-right:20px}
.is-latest .track-node{box-shadow:0 0 0 4px #eaf4ed,0 0 12px #56967533}
.alarm{--track-color:#c95249}.warning{--track-color:#b78a28}
.stage-content{margin-right:22px;padding:4px 0 0}
.stage-heading{display:flex;align-items:center;flex-wrap:wrap;gap:8px;margin:0 0 8px!important}
.stage-heading h3{color:var(--stage-color);font-size:16px;line-height:1.5;font-weight:600;margin:0}
.stage-heading>small{font-size:10px;line-height:1.5;color:#6b7a70}
.latest-label{font-size:12px;line-height:1.5;color:#357354;background:#edf5ed;border-radius:4px;padding:2px 6px}
.stage-description{font-size:14px;line-height:1.75;color:#53697a;min-height:42px;margin:0 0 12px!important}
.stage-average{display:flex;align-items:baseline;gap:14px;margin:14px 0;color:#687c89;font-size:13px}.stage-average strong{font-size:24px;font-weight:600;color:#304e60;font-variant-numeric:tabular-nums}.stage-average small{font-size:13px;font-weight:400}
.stage-operations{display:grid;gap:10px;margin:14px 0 0}.stage-operations>div{display:grid;grid-template-columns:4em 1fr;gap:12px;font-size:14px;line-height:1.6}.stage-operations dt{color:#71828e}.stage-operations dd{margin:0;color:#405b6c}
.stage-concerns{margin-top:18px;padding-top:14px;border-top:1px solid #e5e9e7}.stage-concerns .concern-label{font-size:13px;margin:0 0 9px!important;color:#71828e}.stage-concerns>div+div{margin-top:10px}.stage-concerns strong{display:flex;align-items:center;gap:8px;color:#345364;font-size:15px;font-weight:600;flex-wrap:wrap}.stage-concerns i{width:7px;height:7px;border-radius:50%;background:#73867c}.stage-concerns .alarm i{background:#c95249}.stage-concerns .warning i{background:#b78a28}.concern-types{font-size:13px;font-weight:400;color:#88613d}.stage-concerns p{font-size:14px;color:#6b7b86;margin:7px 0 0!important}.stage-clear{font-size:13px;color:#71828e;margin-top:18px!important}
@keyframes stage-enter{from{opacity:0;transform:translateX(-7px)}to{opacity:1;transform:translateX(0)}}
@keyframes track-reveal{from{transform:scaleX(0)}to{transform:scaleX(1)}}
@keyframes node-glow{0%,55%,100%{opacity:0;transform:scale(.7)}10%{opacity:.4}40%{opacity:0;transform:scale(1.6)}}
@keyframes track-flow{0%{transform:translateX(-100%);opacity:0}10%{opacity:.8}65%{transform:translateX(100%);opacity:.8}66%,100%{transform:translateX(100%);opacity:0}}
@keyframes arrow-flow{0%,65%,100%{opacity:.4;transform:translateX(0)}40%,50%{opacity:1;transform:translateX(2px)}}
@media(max-width:1400px){.voyage-timeline{grid-template-columns:repeat(2,minmax(0,1fr));gap:24px 18px}.stage-clock{font-size:12px}.stage-content{margin-right:10px}.stage-description{min-height:0}.stage-average{margin:8px 0}.stage-operations{margin-top:10px}}
@media(max-width:760px){.voyage{padding:0 4px 12px}.voyage-timeline{grid-template-columns:1fr}.stage-content{margin-right:0}.stage-track svg{display:none}}
@media(prefers-reduced-motion:reduce){.voyage-stage,.track-line,.track-node:after,.track-line:after,.stage-track svg{animation:none}.track-node:after,.track-line:after{display:none}}
</style>
