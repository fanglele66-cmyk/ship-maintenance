<template>
 <section class="voyage" :class="{'motion-paused':motionPaused}" aria-label="航行阶段时间线，从早到晚">
  <button class="voyage-motion" :aria-label="motionPaused?'播放时间线动效':'暂停时间线动效'" :title="motionPaused?'播放时间线动效':'暂停时间线动效'" :aria-pressed="motionPaused" @click="motionPaused=!motionPaused"><svg viewBox="0 0 16 16" aria-hidden="true"><path v-if="motionPaused" d="m6 4 6 4-6 4z"/><path v-else d="M6 4v8m4-8v8"/></svg></button>
  <div class="voyage-scroll">
   <ol class="voyage-timeline">
    <li v-for="(stage,index) in stages" :key="stage.id" class="voyage-stage" :class="[stage.tone,stage.severity,{'is-latest':index===stages.length-1}]" :style="{'--stage-delay':index*80+'ms','--flow-delay':index*.7+'s'}">
     <div class="stage-clock"><time :datetime="new Date(stage.start).toISOString()">{{shortTime(stage.start)}}</time><span aria-hidden="true">—</span><time :datetime="new Date(stage.end).toISOString()">{{shortTime(stage.end)}}</time></div>
     <div class="stage-track" aria-hidden="true"><i class="track-node"/><span class="track-line"/><svg v-if="index<stages.length-1" viewBox="0 0 8 12"><path d="m2 2 4 4-4 4"/></svg></div>
     <div class="stage-content">
      <header class="stage-heading"><h3>{{stage.status}}</h3><span v-if="index===stages.length-1" class="latest-label">最近阶段</span><small v-else>{{duration(stage)}}</small></header>
      <p class="stage-description">{{stage.detail.split(' 主机 ')[0]}}</p>
      <dl class="stage-metrics"><div><dt>航速</dt><dd>{{range(stage.sog)}} <small>kn</small></dd></div><div><dt>主机转速</dt><dd>{{range(stage.rpm)}} <small>rpm</small></dd></div><div><dt>主机负荷</dt><dd>{{range(stage.load)}} <small>%</small></dd></div></dl>
      <div class="stage-secondary"><span>辅机 {{stage.aux}} 台</span><span>航向 {{stage.cog===null?'—':stage.cog+'°'}}</span><span v-if="index===stages.length-1">{{duration(stage)}}</span></div>
      <p class="stage-position">时段末位置 {{stage.position}}</p>
      <div v-if="stage.incidents.length" class="voyage-incidents"><RouterLink v-for="incident in stage.incidents" :key="incident.id" :to="'/situation/issue/'+incident.id" :class="incident.severity"><i aria-hidden="true"/><span>{{incident.type}} · {{incident.title}}</span><span aria-hidden="true">↗</span></RouterLink></div>
     </div>
    </li>
   </ol>
  </div>
 </section>
</template>
<script setup>
import {computed,ref} from 'vue'
import {RouterLink} from 'vue-router'
import {navigationStages} from '../workflow/navigationStages.js'
const props=defineProps({periods:{type:Array,required:true},events:{type:Array,default:()=>[]}})
const stages=computed(()=>navigationStages(props.periods,props.events).slice(-4))
const motionPaused=ref(false)
const shortTime=at=>new Date(at).toLocaleString('zh-CN',{month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false,timeZone:'Asia/Shanghai'})
const range=values=>values[0]===values[1]?String(values[0]):values.join('–')
function duration(stage){const minutes=Math.round((stage.end-stage.start)/60000);return `${Math.floor(minutes/60)?Math.floor(minutes/60)+'小时':''}${minutes%60?minutes%60+'分':''}`}
</script>
<style scoped>
.voyage{position:relative;padding:0 20px 18px;min-width:0;color:#435765}
.voyage-motion{position:absolute;z-index:2;right:20px;top:0;display:grid;place-items:center;width:24px;height:24px;padding:0;border:1px solid #e3e9e5;border-radius:6px;background:#fff;color:#688477;cursor:pointer;transition:background .15s,color .15s}
.voyage-motion:hover{background:#edf5ef;color:#315e49}.voyage-motion:focus-visible{outline:2px solid #698d7c;outline-offset:3px}.voyage-motion svg{width:13px;height:13px;fill:none;stroke:currentColor;stroke-width:1.5;stroke-linejoin:round}
.voyage-scroll{overflow-x:auto;scrollbar-width:thin;scrollbar-color:#d6ddd8 transparent}
.voyage-timeline{display:grid;grid-template-columns:repeat(4,minmax(230px,1fr));list-style:none;padding:3px 0 0;margin:0!important}
.voyage-stage{--stage-color:#327c65;--track-color:var(--stage-color);min-width:0;animation:stage-enter .6s both;animation-delay:var(--stage-delay)}
.voyage-stage.anchored{--stage-color:#73608e}.voyage-stage.maneuver{--stage-color:#967025}.voyage-stage.accelerating{--stage-color:#357c9b}
.stage-clock{display:flex;align-items:center;gap:6px;font-size:11px;line-height:1.6;color:#657774;font-variant-numeric:tabular-nums;white-space:nowrap}
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
.stage-heading h3{color:var(--stage-color);font-size:14px;line-height:1.5;font-weight:600;margin:0}
.stage-heading>small{font-size:10px;line-height:1.5;color:#6b7a70}
.latest-label{font-size:10px;line-height:1.5;color:#357354;background:#edf5ed;border-radius:4px;padding:2px 6px}
.stage-description{font-size:12px;line-height:1.75;color:#53697a;min-height:42px;margin:0 0 12px!important}
.stage-metrics{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;margin:0;padding:0}
.stage-metrics dt{font-size:10px;color:#647872;line-height:1.5;margin-bottom:4px}
.stage-metrics dd{font-size:13px;line-height:1.5;color:#365566;font-weight:600;margin:0;white-space:nowrap;font-variant-numeric:tabular-nums}
.stage-metrics dd small{font-size:10px;font-weight:400;color:#667c73}
.stage-secondary{display:flex;gap:6px 16px;flex-wrap:wrap;font-size:10px;line-height:1.6;color:#617a6e;margin-top:12px;font-variant-numeric:tabular-nums}
.stage-position{font-size:10px;line-height:1.6;color:#6b7c73;margin:5px 0 0!important;font-variant-numeric:tabular-nums}
.voyage-incidents{display:grid;gap:4px;margin-top:10px}
.voyage-incidents a{display:flex;align-items:baseline;gap:5px;color:#a17b2d;font-size:11px;line-height:1.6;text-decoration:none}
.voyage-incidents a.alarm{color:#b95e51}
.voyage-incidents i{width:5px;height:5px;border-radius:50%;background:currentColor;align-self:center;flex:none}
.voyage-incidents a:hover{text-decoration:underline}
.voyage-incidents a:focus-visible{outline:2px solid #b49a68;outline-offset:3px;border-radius:3px}
@keyframes stage-enter{from{opacity:0;transform:translateX(-7px)}to{opacity:1;transform:translateX(0)}}
@keyframes track-reveal{from{transform:scaleX(0)}to{transform:scaleX(1)}}
@keyframes node-glow{0%,55%,100%{opacity:0;transform:scale(.7)}10%{opacity:.4}40%{opacity:0;transform:scale(1.6)}}
@keyframes track-flow{0%{transform:translateX(-100%);opacity:0}10%{opacity:.8}65%{transform:translateX(100%);opacity:.8}66%,100%{transform:translateX(100%);opacity:0}}
@keyframes arrow-flow{0%,65%,100%{opacity:.4;transform:translateX(0)}40%,50%{opacity:1;transform:translateX(2px)}}
.motion-paused .voyage-stage,.motion-paused .track-line,.motion-paused .track-line:after,.motion-paused .track-node:after,.motion-paused .stage-track svg{animation-play-state:paused}
@media(min-width:1600px){.stage-clock{font-size:12px}.stage-heading h3{font-size:15px}.stage-description{font-size:13px;min-height:46px}.stage-metrics dd{font-size:14px}.stage-secondary,.stage-position,.stage-metrics dt{font-size:11px}}
@media(max-width:1100px){.voyage{padding:0 16px 16px}.voyage-timeline{grid-template-columns:repeat(4,minmax(225px,1fr))}.stage-content{margin-right:20px}}
@media(max-width:760px){.voyage-scroll{scroll-snap-type:x proximity}.voyage-timeline{grid-template-columns:repeat(4,minmax(245px,78vw));width:max-content}.voyage-stage{scroll-snap-align:start}.stage-content{margin-right:24px}}
@media(prefers-reduced-motion:reduce){.voyage-stage,.track-line,.track-node:after,.track-line:after,.stage-track svg{animation:none}.track-node:after,.track-line:after,.voyage-motion{display:none}}
</style>
