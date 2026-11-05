<template>
 <section v-if="images.length" class="task-reference-images" aria-label="本步骤参考图">
  <div class="reference-heading"><span>本步骤参考图</span><small>点击图片查看细节</small></div>
  <div class="reference-grid">
   <figure v-for="(item, index) in images" :key="item.id" class="reference-card">
    <button type="button" class="reference-preview" :aria-label="'放大查看：'+item.title" @click="open(index)">
     <img v-if="!failed[item.src]" :src="assetUrl(item.src)" :alt="item.title" loading="lazy" @error="failed[item.src]=true"/>
     <span v-else class="reference-unavailable">图片暂未加载，可查看资料出处</span>
     <span class="reference-type">{{item.type}}</span><span class="reference-expand" aria-hidden="true">放大 ↗</span>
    </button>
    <figcaption><strong>{{item.title}}</strong><p class="reference-focus">{{item.focus}}</p></figcaption>
   </figure>
  </div>
  <Teleport to="body">
   <dialog ref="dialog" class="reference-dialog" aria-label="步骤参考图查看器" @click="onBackdrop" @close="reset">
    <template v-if="selected">
     <header class="reference-dialog-head"><div><small>{{selected.type}} · {{active+1}} / {{images.length}}</small><h2>{{selected.title}}</h2></div><button type="button" autofocus class="reference-close" aria-label="关闭参考图" @click="close">关闭 ×</button></header>
     <div class="reference-toolbar" aria-label="图片缩放">
      <button type="button" :disabled="active===0" @click="select(active-1)">上一张</button><button type="button" :disabled="active===images.length-1" @click="select(active+1)">下一张</button>
      <span class="reference-toolbar-gap"/>
      <button type="button" :disabled="zoom<=1" aria-label="缩小图片" @click="zoom=Math.max(1,zoom-.5)">−</button><output aria-live="polite">{{Math.round(zoom*100)}}%</output><button type="button" :disabled="zoom>=4" aria-label="放大图片" @click="zoom=Math.min(4,zoom+.5)">＋</button><button type="button" @click="zoom=1">适应窗口</button>
      <a :href="assetUrl(selected.src)" target="_blank" rel="noopener">打开原图 ↗</a>
     </div>
     <div ref="canvas" class="reference-canvas" tabindex="0" aria-label="参考图，放大后可滚动查看">
      <div class="reference-image-stage" :style="{width:zoom*100+'%',height:zoom*100+'%'}"><img v-if="!failed[selected.src]" :src="assetUrl(selected.src)" :alt="selected.title" @error="failed[selected.src]=true"/><p v-else>图片暂未加载，请通过下方出处核对资料。</p></div>
     </div>
     <footer class="reference-dialog-foot"><p><strong>查看重点：</strong>{{selected.focus}}</p><p class="reference-provenance">出处：<a v-if="selected.sourceHref" :href="assetUrl(selected.sourceHref)" target="_blank" rel="noopener">{{selected.sourceLabel}} ↗</a><span v-else>{{selected.sourceLabel}}</span><template v-if="selected.page"> · PDF 第 {{selected.page}} 页</template><template v-if="selected.figure"> · {{selected.figure}}</template></p><p v-if="selected.note" class="reference-note">{{selected.note}}</p></footer>
    </template>
   </dialog>
  </Teleport>
 </section>
</template>
<script setup>
import {computed,nextTick,onBeforeUnmount,ref,watch} from 'vue'
const props=defineProps({images:{type:Array,default:()=>[]}})
const dialog=ref(null),canvas=ref(null),active=ref(0),zoom=ref(1),failed=ref({})
const selected=computed(()=>props.images[active.value])
const assetUrl=path=>path?.startsWith('/')?import.meta.env.BASE_URL+path.slice(1):path
let previousOverflow,previousFocus
async function open(index){active.value=index;zoom.value=1;previousFocus=document.activeElement;await nextTick();previousOverflow=document.body.style.overflow;document.body.style.overflow='hidden';dialog.value?.showModal()}
function reset(){if(previousOverflow!==undefined){document.body.style.overflow=previousOverflow;previousOverflow=undefined}previousFocus?.focus();previousFocus=null;zoom.value=1}
function close(){dialog.value?.close();reset()}
function onBackdrop(event){if(event.target!==dialog.value)return;const r=dialog.value.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)close()}
function select(index){active.value=index;zoom.value=1;canvas.value?.scrollTo(0,0)}
watch(()=>props.images.map(item=>item.id).join('|'),()=>{close();active.value=0})
onBeforeUnmount(reset)
</script>
<style scoped>
.task-reference-images{min-width:0;margin:14px 0 10px;grid-column:1/-1}.reference-heading{display:flex;align-items:center;gap:12px;margin-bottom:8px;color:#796644;font-size:12px}.reference-heading small{font-size:11px;color:#8a9299}.reference-grid{display:flex;flex-wrap:wrap;gap:12px;align-items:flex-start}.reference-card{flex:0 1 460px;width:460px;max-width:100%;box-sizing:border-box;margin:0!important;min-width:0;border:1px solid #e5e1d8;border-radius:7px;background:#fff;overflow:hidden}.reference-preview{display:block;position:relative;width:100%;height:160px;padding:12px!important;border:0!important;border-bottom:1px solid #eeeae2!important;border-radius:0!important;background:#f7f8f6!important;cursor:zoom-in!important;overflow:hidden}.reference-preview img{width:100%;height:100%;object-fit:contain;display:block}.reference-type,.reference-expand{position:absolute;top:8px;left:8px;background:#fffffff0;color:#6e6149;border:1px solid #e6e1d7;border-radius:4px;padding:1px 7px;font-size:10px;line-height:1.8}.reference-expand{left:auto;top:auto;right:8px;bottom:8px}.reference-card figcaption{padding:10px 12px;line-height:1.6}.reference-card strong{font-size:12px;font-weight:600;color:#405469}.reference-focus{margin:4px 0!important;color:#647483;font-size:12px}.reference-card figcaption>small{display:block;color:#8b939b;font-size:10px;overflow-wrap:anywhere}.reference-unavailable{font-size:12px;color:#7c828a}.reference-preview:focus-visible,.reference-dialog button:focus-visible,.reference-dialog a:focus-visible{outline:2px solid #a5874b;outline-offset:-3px}
.reference-dialog{box-sizing:border-box;width:min(1180px,96vw);height:min(880px,94dvh);max-width:96vw;max-height:94dvh;margin:auto;padding:0;border:1px solid #d9ddd6;border-radius:12px;background:#fff;color:#425466;box-shadow:0 24px 90px #162b4055;overflow:hidden}.reference-dialog[open]{display:flex;flex-direction:column}.reference-dialog::backdrop{background:#192534b3}.reference-dialog-head{display:flex;justify-content:space-between;align-items:center;gap:16px;padding:16px 20px;border-bottom:1px solid #e9e8e3;flex:none}.reference-dialog-head small{font-size:11px;color:#9b8254}.reference-dialog-head h2{font-size:17px;margin:3px 0 0;font-weight:600;line-height:1.5}.reference-dialog button,.reference-dialog a{font:inherit;font-size:12px;color:#6e6149;border:1px solid #dfdbd1;border-radius:5px;padding:5px 10px;background:#fff;cursor:pointer;white-space:nowrap;text-decoration:none}.reference-dialog button:disabled{opacity:.35;cursor:default}.reference-close{flex:none}.reference-toolbar{display:flex;align-items:center;gap:8px;padding:10px 20px;flex:none;flex-wrap:wrap;border-bottom:1px solid #e5e7e4}.reference-toolbar output{min-width:38px;text-align:center;font-size:12px}.reference-toolbar-gap{flex:1}.reference-canvas{flex:1;min-height:120px;overflow:auto;background:#eceeeb;overscroll-behavior:contain}.reference-image-stage{display:flex;align-items:center;justify-content:center;min-height:100%;box-sizing:border-box;padding:16px}.reference-image-stage img{display:block;width:100%;height:100%;object-fit:contain;max-width:none;max-height:none}.reference-dialog-foot{flex:none;padding:12px 20px;border-top:1px solid #e6e7e3;max-height:27%;overflow-y:auto;line-height:1.7}.reference-dialog-foot p{margin:2px 0;font-size:12px}.reference-dialog-foot a{border:0;padding:0;white-space:normal;text-decoration:underline;text-underline-offset:3px}.reference-provenance{color:#77828c;overflow-wrap:anywhere}.reference-note{color:#8a785d}.reference-dialog-foot strong{font-weight:600}
@media(max-width:700px){.reference-grid{display:flex}.reference-card{flex-basis:100%;width:100%}.reference-preview{height:180px}.reference-dialog{width:96vw;height:94dvh}.reference-dialog-head{padding:12px}.reference-dialog-head h2{font-size:14px}.reference-toolbar{padding:8px;gap:6px}.reference-toolbar-gap{display:none}.reference-toolbar button,.reference-toolbar a{padding:5px 7px}.reference-dialog-foot{padding:10px 12px;max-height:30%}.reference-image-stage{padding:6px}}
</style>
