import test from 'node:test'
import assert from 'node:assert/strict'
import {prepareStepPhoto,stepPhotoBytes,isStepPhotoCopy,STEP_PHOTO_COPY_TARGET_BYTES} from '../src/workflow/stepPhotoUpload.js'

const originalUrl='data:image/png;base64,iVBORw0KGgo='
function jpeg(bytes){const buffer=Buffer.alloc(bytes,42);buffer[0]=255;buffer[1]=216;buffer[2]=255;return 'data:image/jpeg;base64,'+buffer.toString('base64')}

test('small images remain byte-for-byte unchanged and do not enter the canvas path',async()=>{
 const file=Object.freeze({name:'小图.png',type:'image/png',size:600000}),copy=await prepareStepPhoto(file,{read:async selected=>{assert.equal(selected,file);return originalUrl},decode:()=>{throw Error('small image must not be decoded')}})
 assert.deepEqual(copy,{name:file.name,mimeType:file.type,dataUrl:originalUrl});assert.equal(isStepPhotoCopy(copy),false)
})

test('large images produce a white-backed JPEG upload copy with a 1280px longest side',async()=>{
 const file=Object.freeze({name:'c2-icu-demo-generated.png',type:'image/png',size:2554493}),calls=[],resultUrl=jpeg(180000)
 const picture={naturalWidth:4096,naturalHeight:2048},context={fillStyle:'',fillRect(...args){calls.push(['fill',this.fillStyle,...args])},drawImage(...args){calls.push(['draw',...args])}},surface={width:0,height:0,getContext:()=>context,toDataURL(mime,quality){calls.push(['encode',mime,quality]);return resultUrl}}
 const result=await prepareStepPhoto(file,{read:async selected=>{assert.equal(selected,file);return originalUrl},decode:async url=>{assert.equal(url,originalUrl);return picture},canvas:()=>surface})
 assert.equal(surface.width,1280);assert.equal(surface.height,640)
 assert.deepEqual(calls[0],['fill','#ffffff',0,0,1280,640]);assert.deepEqual(calls[1],['draw',picture,0,0,1280,640]);assert.deepEqual(calls[2],['encode','image/jpeg',.85])
 assert.equal(result.name,'c2-icu-demo-generated.png（上传压缩副本）');assert.equal(result.mimeType,'image/jpeg');assert.equal(result.dataUrl,resultUrl)
 assert.ok(isStepPhotoCopy(result));assert.ok(stepPhotoBytes(result)<=STEP_PHOTO_COPY_TARGET_BYTES)
 assert.deepEqual(file,{name:'c2-icu-demo-generated.png',type:'image/png',size:2554493},'the selected File metadata remains unchanged')
})

test('the upload copy is reduced further when its first encoding is still too large',async()=>{
 const qualities=[],surface={getContext:()=>({fillRect(){},drawImage(){}}),toDataURL(mime,quality){qualities.push(quality);return jpeg(qualities.length===1?900000:600000)}}
 const result=await prepareStepPhoto({name:'纹理.jpg',type:'image/jpeg',size:2500000},{read:async()=>originalUrl,decode:async()=>({width:1280,height:960}),canvas:()=>surface})
 assert.deepEqual(qualities,[.85,.75]);assert.equal(stepPhotoBytes(result),600000)
})

test('oversize, unsupported and unreadable inputs fail explicitly instead of losing a photo',async()=>{
 await assert.rejects(prepareStepPhoto({type:'image/png',size:3*1024*1024+1}),/3 MB/)
 await assert.rejects(prepareStepPhoto({type:'image/svg+xml',size:1000}),/PNG、JPEG 或 WebP/)
 await assert.rejects(prepareStepPhoto({name:'损坏.png',type:'image/png',size:1000000},{read:async()=>originalUrl,decode:async()=>({width:0,height:0})}),/照片尺寸/)
 await assert.rejects(prepareStepPhoto({name:'错误编码.png',type:'image/png',size:1000000},{read:async()=>originalUrl,decode:async()=>({width:100,height:100}),canvas:()=>({getContext:()=>({fillRect(){},drawImage(){}}),toDataURL:()=>originalUrl})}),/上传副本生成失败/)
})
