<template>
  <div class="step-photos" :class="{'draft-photos':editable}">
    <div v-for="(photo, index) in photos" :key="photo.id || photo.name + index" class="photo-item">
      <button type="button" class="photo-thumb" :title="photo.name" :aria-label="labelPrefix+photo.name" @click="preview(photo)">
        <StepPhotoImage :photo="photo"/>
        <span v-if="!editable" class="photo-name">{{photo.name}}</span>
        <template v-if="!editable && (photo.sources || photo.uses)">
          <small v-for="use in photo.uses || [{sources:photo.sources,sourceTimes:photo.sourceTimes}]" :key="use.index ?? 0" class="photo-credit">
            <span v-if="photo.uses?.length>1">第 {{use.index+1}} 步 · </span>
            <span v-for="(source,i) in use.sources" :key="source" :title="use.sourceTimes?.[source]">{{i?' / ':''}}{{photoSourceLabels[source]}}</span>
          </small>
        </template>
      </button>
      <button v-if="editable" type="button" class="remove-photo" :disabled="disabled" :aria-label="'移除照片：'+photo.name" @click="$emit('remove',index)">
        <svg viewBox="0 0 16 16" aria-hidden="true"><path d="m4 4 8 8m0-8-8 8"/></svg>
      </button>
    </div>
    <dialog ref="dialog" class="photo-dialog" aria-label="现场照片预览" @close="selected=null" @click="closeBackdrop">
      <header><strong>{{selected?.name}}</strong><a v-if="downloadUrl" :href="downloadUrl" :download="selected?.name">下载照片</a><button type="button" aria-label="关闭照片预览" @click="dialog.close()">关闭</button></header>
      <StepPhotoImage v-if="selected" :photo="selected" @ready="downloadUrl=$event"/>
    </dialog>
  </div>
</template>
<script setup>
import {nextTick, ref} from 'vue'
import StepPhotoImage from './StepPhotoImage.vue'
import {photoSourceLabels} from '../workflow/stepPhotoEvidence.js'
defineProps({
  photos: {type: Array, required: true},
  editable: Boolean, disabled: Boolean,
  labelPrefix: {type: String, default: '查看照片：'}
})
defineEmits(['remove'])
const selected = ref(null), dialog = ref(null), downloadUrl=ref('')
async function preview(photo) { downloadUrl.value=''; selected.value=photo; await nextTick(); dialog.value?.showModal() }
function closeBackdrop(event) { if(event.target===dialog.value)dialog.value.close() }
</script>
<style scoped>
.step-photos{display:flex;flex-wrap:wrap;align-items:flex-start;gap:8px}
.photo-item{position:relative;min-width:0}
.photo-thumb{display:flex;flex-direction:column;gap:4px;width:104px;padding:4px;border:1px solid var(--ui-border);border-radius:6px;background:white;text-align:left;cursor:pointer}
.photo-thumb:hover,.remove-photo:hover{border-color:var(--ui-accent)}
.photo-thumb :deep(img){display:block;width:100%;height:68px;object-fit:cover;border-radius:4px}
.photo-name{display:block;width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:11px;color:var(--ui-muted)}
.photo-credit{font-size:10px;color:var(--ui-muted);line-height:1.5;overflow-wrap:anywhere}
.draft-photos .photo-thumb{width:68px}.draft-photos .photo-thumb :deep(img){height:54px}
.remove-photo{position:absolute;right:-3px;top:-3px;display:grid;place-items:center;width:20px;height:20px;padding:3px;border:1px solid var(--ui-border);border-radius:50%;background:#fff;color:var(--ui-ink);cursor:pointer}
.remove-photo svg{width:13px;height:13px;fill:none;stroke:currentColor;stroke-width:1.6}
.photo-dialog{max-width:min(92vw,1080px);max-height:90vh;box-sizing:border-box;padding:14px;border:1px solid var(--ui-border);border-radius:10px;background:white}
.photo-dialog::backdrop{background:#15231ec2}
.photo-dialog header{display:flex;align-items:center;justify-content:space-between;gap:20px;margin-bottom:12px}
.photo-dialog header strong{font-size:13px;overflow-wrap:anywhere}
.photo-dialog header a{margin-left:auto;color:var(--ui-accent);font-size:12px;white-space:nowrap}
.photo-dialog header button{flex:none;padding:5px 12px;border:1px solid var(--ui-border);border-radius:5px;background:white;cursor:pointer}
.photo-dialog :deep(img){display:block;max-width:100%;max-height:74vh;object-fit:contain;margin:auto}
</style>
