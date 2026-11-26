export const MAX_STEP_PHOTOS = 4
export const MAX_STEP_PHOTO_BYTES = 12 * 1024 * 1024
// Allow time for in-flight uploads and edits from other tabs to be acknowledged.
export const STEP_PHOTO_GRACE_MS = 24 * 60 * 60 * 1000

export function referencedStepPhotos(workspace, storage) {
  const ids = new Set()
  function visit(value) {
    if (!value || typeof value !== 'object') return
    if (value.storage === storage && typeof value.id === 'string') ids.add(value.id)
    else for (const child of Object.values(value)) visit(child)
  }
  visit(workspace)
  return ids
}

export function checkStepPhotoFile(mimeType, size, bytes) {
  const matches = (...signature) => signature.every((byte, index) => bytes[index] === byte)
  const types = {
    'image/png': () => matches(137, 80, 78, 71, 13, 10, 26, 10),
    'image/jpeg': () => matches(255, 216, 255),
    'image/webp': () => matches(82, 73, 70, 70) && bytes[8] === 87 && bytes[9] === 69 && bytes[10] === 66 && bytes[11] === 80
  }
  if (!Object.hasOwn(types, mimeType)) throw Error('请选择 PNG、JPEG 或 WebP 照片。')
  if (!size || size > MAX_STEP_PHOTO_BYTES) throw Error('单张现场照片须大于 0 字节且不超过 12 MB。')
  if (bytes && !types[mimeType]()) throw Error('照片内容与文件类型不符，请重新选择。')
}
