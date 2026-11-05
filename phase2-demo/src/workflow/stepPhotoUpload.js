import {STEP_ASSIST_LIMITS} from './stepAssistContract.js'

export const STEP_PHOTO_COPY_TARGET_BYTES=800*1024
export const isStepPhotoCopy=photo=>Boolean(photo?.name?.endsWith('（上传压缩副本）'))
export function stepPhotoBytes(photo){const base64=photo.dataUrl.split(',')[1]||'';return base64.length*3/4-(base64.endsWith('==')?2:base64.endsWith('=')?1:0)}
function readDataUrl(file){return new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=()=>reject(Error('无法读取照片，请重新选择。'));reader.readAsDataURL(file)})}
function decodeImage(dataUrl){return new Promise((resolve,reject)=>{const picture=new Image();picture.onload=()=>resolve(picture);picture.onerror=()=>reject(Error('无法解码照片，请选择可正常打开的 PNG、JPEG 或 WebP 图片。'));picture.src=dataUrl})}

// Build an upload-only copy. Never change or write back to the selected File.
export async function prepareStepPhoto(file,{read=readDataUrl,decode=decodeImage,canvas=()=>document.createElement('canvas')}={}){
 if(!['image/png','image/jpeg','image/webp'].includes(file.type))throw Error('请选择 PNG、JPEG 或 WebP 照片。')
 if(file.size>STEP_ASSIST_LIMITS.maxImageBytes)throw Error('单张照片不能超过 3 MB。')
 const original={name:file.name,mimeType:file.type,dataUrl:await read(file)}
 if(file.size<=STEP_PHOTO_COPY_TARGET_BYTES)return original
 const picture=await decode(original.dataUrl),sourceWidth=picture.naturalWidth||picture.width,sourceHeight=picture.naturalHeight||picture.height
 if(!sourceWidth||!sourceHeight)throw Error('无法读取照片尺寸，请重新选择图片。')
 let scale=Math.min(1,1280/Math.max(sourceWidth,sourceHeight)),quality=.85
 const surface=canvas(),context=surface.getContext('2d')
 if(!context)throw Error('当前浏览器无法生成上传副本，请压缩照片后重试。')
 for(let attempt=0;attempt<6;attempt++){
  surface.width=Math.max(1,Math.round(sourceWidth*scale));surface.height=Math.max(1,Math.round(sourceHeight*scale))
  context.fillStyle='#ffffff';context.fillRect(0,0,surface.width,surface.height)
  context.drawImage(picture,0,0,surface.width,surface.height)
  const dataUrl=surface.toDataURL('image/jpeg',quality)
  if(!dataUrl.startsWith('data:image/jpeg;base64,'))throw Error('照片上传副本生成失败，请压缩照片后重试。')
  const copy={name:`${file.name}（上传压缩副本）`,mimeType:'image/jpeg',dataUrl}
  if(stepPhotoBytes(copy)<=STEP_PHOTO_COPY_TARGET_BYTES)return copy
  if(quality>.65)quality=Math.max(.65,quality-.1);else{scale*=.8;quality=.75}
 }
 throw Error('照片仍过大，请选取需要说明的局部或压缩后重试；原图未修改。')
}
