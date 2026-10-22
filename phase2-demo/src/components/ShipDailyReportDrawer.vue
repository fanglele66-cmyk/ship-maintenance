<template>
 <Teleport to="body">
  <div class="daily-report-backdrop" @mousedown.self="emit('close')">
   <section ref="dialog" class="daily-report-drawer" :class="{'has-report':selected}" role="dialog" aria-modal="true" aria-labelledby="daily-report-title" @keydown="onKeydown">
    <aside class="daily-report-list">
     <header><div><h2 id="daily-report-title">日检报告</h2><p>长航碧玉 · 近 7 日运行回顾</p></div><button type="button" class="icon-close" aria-label="关闭日检报告" @click="emit('close')">×</button></header>
     <div class="report-date-filter"><label><span>开始日期</span><input v-model="startDate" type="date" aria-label="日检报告开始日期"/></label><span>至</span><label><span>结束日期</span><input v-model="endDate" type="date" aria-label="日检报告结束日期"/></label><button type="button" title="恢复近7日" aria-label="恢复近7日报告" @click="resetDates">↺</button></div>
     <p class="report-list-hint">按日汇总，选择日期查看完整报告</p>
     <div class="report-list-scroll">
      <button v-for="report in filtered" :key="report.id" type="button" class="daily-report-card" :class="{selected:report.id===selectedId}" :aria-pressed="report.id===selectedId" @click="select(report.id)"><span class="report-card-top"><strong>{{dateTitle(report.date)}}</strong><span>{{report.partial?'今日截至当前':'全天报告'}}</span></span><span class="report-card-summary">{{report.summary}}</span><span class="report-card-footer">{{report.readings.length}} 项关键指标统计 <b>查看日报 →</b></span></button>
      <div v-if="!filtered.length" class="report-list-empty">{{startDate>endDate?'开始日期不能晚于结束日期。':'该日期范围暂无日检报告。'}}<button type="button" @click="resetDates">恢复近 7 日</button></div>
     </div>
    </aside>
    <article v-if="selected" class="daily-report-detail" aria-labelledby="daily-document-title">
     <header><div><span>长航碧玉 / 日检报告</span><h2 id="daily-document-title" ref="documentTitle" tabindex="-1">{{dateTitle(selected.date)}}机舱日检报告</h2></div><button type="button" class="icon-close" aria-label="收起日报详情" @click="selectedId=''">×</button></header>
     <div class="daily-document-scroll">
      <div class="daily-document-meta"><span>分析时间窗</span><strong>{{selected.window}}</strong><span v-if="selected.partial" class="report-partial">今日报告持续汇总</span></div>
      <section class="report-conclusion"><h3>运行概览</h3><p>{{selected.conclusion}}</p></section>
      <section class="report-section"><h3>关键指标统计</h3><p class="report-caption">同一时间窗内的最小值、平均值与最大值</p><table><thead><tr><th>指标 / 单位</th><th>最小值</th><th>平均值</th><th>最大值</th></tr></thead><tbody><tr v-for="reading in selected.readings" :key="reading.id"><th>{{reading.name}} <small>{{reading.unit}}</small></th><td>{{reading.min}}</td><td class="report-mean">{{reading.mean}}</td><td>{{reading.max}}</td></tr></tbody></table></section>
      <section class="report-section"><h3>重点关注</h3><ul><li v-for="text in selected.findings" :key="text">{{text}}</li></ul></section>
      <section class="report-section"><h3>后续安排</h3><ol><li v-for="text in selected.next" :key="text">{{text}}</li></ol><button type="button" class="report-events-link" @click="emit('open-events')">查看事件与处置记录 →</button></section>
      <footer class="daily-document-source">{{selected.provenance}}</footer>
     </div>
    </article>
   </section>
  </div>
 </Teleport>
</template>
<script setup>
import {computed,nextTick,onMounted,onUnmounted,ref,watch} from 'vue'
const props=defineProps({reports:{type:Array,default:()=>[]}})
const emit=defineEmits(['close','open-events'])
const dialog=ref(null),documentTitle=ref(null),selectedId=ref(''),startDate=ref(props.reports.at(-1)?.date||''),endDate=ref(props.reports[0]?.date||'')
const previousFocus=typeof document!=='undefined'?document.activeElement:null
const selected=computed(()=>props.reports.find(report=>report.id===selectedId.value))
const filtered=computed(()=>props.reports.filter(report=>(!startDate.value||report.date>=startDate.value)&&(!endDate.value||report.date<=endDate.value)))
watch(filtered,reports=>{if(selectedId.value&&!reports.some(report=>report.id===selectedId.value))selectedId.value=''})
const dateTitle=value=>`${Number(value.slice(5,7))}月${Number(value.slice(8,10))}日`
function resetDates(){startDate.value=props.reports.at(-1)?.date||'';endDate.value=props.reports[0]?.date||''}
async function select(id){selectedId.value=id;await nextTick();documentTitle.value?.focus()}
function onKeydown(event){
 if(event.key==='Escape'){event.preventDefault();if(selectedId.value){selectedId.value='';nextTick(()=>dialog.value?.querySelector('.daily-report-card')?.focus())}else emit('close');return}
 if(event.key!=='Tab')return
 const focusable=[...dialog.value.querySelectorAll('button,input,[tabindex="0"]')].filter(el=>el.getClientRects().length&&!el.disabled)
 const first=focusable[0],last=focusable.at(-1)
 if(event.shiftKey&&(document.activeElement===first||document.activeElement===documentTitle.value)){event.preventDefault();last?.focus()}
 else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus()}
}
onMounted(()=>dialog.value?.querySelector('button')?.focus())
onUnmounted(()=>previousFocus?.isConnected&&previousFocus.focus())
</script>
<style scoped>
.daily-report-backdrop{position:fixed;inset:0;z-index:2100;background:#1525344a;display:flex;justify-content:flex-end}
.daily-report-drawer{width:390px;max-width:100%;height:100%;display:flex;background:#fff;box-shadow:-12px 0 44px #172a4626;color:#35475d}.daily-report-drawer.has-report{width:min(1150px,calc(100vw - 70px))}.daily-report-list{display:flex;flex-direction:column;width:390px;flex:none;min-height:0;background:#f6f8fb;border-left:1px solid #e3e8ef}.has-report .daily-report-list{width:350px}.daily-report-list>header,.daily-report-detail>header{min-height:91px;display:flex;justify-content:space-between;align-items:center;padding:21px 24px;border-bottom:1px solid #e3e8ef;background:#fff}.daily-report-list h2{margin:0;font-size:19px;color:#25384e}.daily-report-list header p{margin:6px 0 0;color:#8b96a5;font-size:12px}.icon-close{width:30px;height:30px;border:0;background:none;border-radius:5px;color:#7d8b9d;font-size:26px;line-height:1;cursor:pointer}.icon-close:hover{background:#edf1f6}.report-date-filter{display:flex;align-items:flex-end;gap:7px;padding:19px 18px 8px;font-size:12px;color:#8995a5}.report-date-filter label{min-width:0;flex:1}.report-date-filter label>span{display:block;font-size:11px;margin-bottom:6px}.report-date-filter input{width:100%;height:34px;box-sizing:border-box;border:1px solid #dce3ec;border-radius:5px;background:#fff;padding:4px 5px;font:inherit;color:#465972}.report-date-filter>span{padding-bottom:9px}.report-date-filter>button{height:34px;width:30px;border:1px solid #dce3ec;background:#fff;border-radius:5px;color:#70839c;font-size:20px;cursor:pointer}.report-list-hint{font-size:11px;color:#8b96a5;margin:5px 19px 13px}.report-list-scroll{padding:0 17px 24px;overflow:auto;min-height:0}.daily-report-card{display:block;width:100%;text-align:left;background:#fff;border:1px solid #dfe6ee;border-radius:7px;padding:15px;margin-bottom:10px;cursor:pointer;color:#4a5f78;font:inherit}.daily-report-card:hover,.daily-report-card.selected{border-color:#b99b67;background:#fdfbf7}.report-card-top{display:flex;align-items:center;justify-content:space-between;gap:8px}.report-card-top strong{font-size:15px;color:#354960}.report-card-top>span{font-size:10px;background:#edf3f8;color:#6c829c;padding:3px 6px;border-radius:3px}.report-card-summary{display:block;font-size:12px;line-height:1.8;margin-top:9px}.report-card-footer{display:flex;justify-content:space-between;font-size:10px;color:#95a0ae;border-top:1px solid #eef1f5;padding-top:10px;margin-top:11px}.report-card-footer b{font-weight:400;color:#987a42}.report-list-empty{font-size:13px;line-height:1.8;color:#8592a3;padding:24px 6px}.report-list-empty button{display:block;border:0;background:none;color:#96763e;margin-top:12px;cursor:pointer}.daily-report-detail{min-width:0;flex:1;display:flex;flex-direction:column;border-left:1px solid #dce4ed}.daily-report-detail>header span{font-size:11px;color:#8b96a5}.daily-report-detail h2{font-size:21px;color:#2c415a;margin:6px 0 0}.daily-document-scroll{padding:24px 30px 36px;overflow:auto;min-height:0;flex:1}.daily-document-meta{font-size:11px;color:#94a0ae;display:flex;flex-wrap:wrap;gap:7px 11px;line-height:1.8}.daily-document-meta strong{font-weight:400;color:#6b7c91}.report-partial{color:#a08452}.report-conclusion{background:#faf8f3;border:1px solid #eee7da;border-radius:7px;margin:19px 0 23px;padding:16px 19px}.report-conclusion h3,.report-section h3{font-size:14px;color:#344a63;margin:0 0 9px}.report-conclusion p,.report-section li{font-size:13px;line-height:1.9;color:#61748b}.report-conclusion p{margin:0}.report-section{margin-top:25px}.report-caption{font-size:11px;color:#97a2b0;margin:0 0 12px}.report-section table{width:100%;border-collapse:collapse;font-size:12px}.report-section th,.report-section td{padding:10px 8px;border-bottom:1px solid #edf0f5;text-align:right;font-variant-numeric:tabular-nums}.report-section th{font-weight:400;color:#677b93}.report-section thead{background:#f4f7fa;font-size:11px}.report-section th:first-child{text-align:left}.report-section small{color:#9aa6b5;font-size:10px;margin-left:5px;white-space:nowrap}.report-mean{font-weight:600;color:#3c5977}.report-section ul,.report-section ol{padding-left:20px;margin:0}.report-section li{padding-left:3px;margin:8px 0}.report-events-link{border:1px solid #ded2bc;border-radius:5px;background:#fff;color:#947541;padding:8px 12px;font:inherit;font-size:12px;margin-top:12px;cursor:pointer}.daily-document-source{font-size:10px;line-height:1.8;color:#a0a9b4;border-top:1px solid #e9edf3;padding-top:15px;margin-top:25px}
button:focus-visible,input:focus-visible{outline:2px solid #ad8c50;outline-offset:2px}
@media(max-width:760px){.daily-report-drawer,.daily-report-drawer.has-report{width:100%}.daily-report-list,.has-report .daily-report-list{width:100%}.has-report .daily-report-list{display:none}.daily-document-scroll{padding:18px 16px 30px}.daily-report-detail>header{padding:20px 16px}.daily-report-detail h2{font-size:18px}.report-section th,.report-section td{font-size:11px;padding:9px 5px}.report-section th:first-child{max-width:140px}.report-section small{display:block;margin:3px 0 0}.daily-document-meta strong{font-size:10px}}
</style>
