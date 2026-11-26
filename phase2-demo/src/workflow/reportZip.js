// ZIP's STORE method preserves already-compressed JPEG, WebP and PNG files.
const encoder = new TextEncoder()
const crcTable = Uint32Array.from({length: 256}, (_, value) => {
  for (let bit = 0; bit < 8; bit++) value = (value >>> 1) ^ ((value & 1) ? 0xedb88320 : 0)
  return value
})

export async function reportZip(files) {
  if (files.length > 65535) throw Error('报告附件数量超出 ZIP 格式支持的范围。')
  const parts = [], directory = []
  let offset = 0, directorySize = 0
  for (const {path, blob} of files) {
    const name = encoder.encode(path)
    if (name.length > 65535 || offset + 30 + name.length + blob.size > 0xffffffff)
      throw Error('报告附件超出 ZIP 格式支持的大小。')
    let crc = 0xffffffff
    const reader = blob.stream().getReader()
    try {
      for (;;) {
        const chunk = await reader.read()
        if (chunk.done) break
        for (const byte of chunk.value) crc = (crc >>> 8) ^ crcTable[(crc ^ byte) & 255]
      }
    } finally { reader.releaseLock() }
    const local = new DataView(new ArrayBuffer(30))
    local.setUint32(0, 0x04034b50, true)
    local.setUint16(4, 20, true)
    local.setUint16(6, 0x0800, true) // UTF-8 filenames
    local.setUint16(12, 0x21, true) // The earliest representable DOS date.
    local.setUint32(14, (crc ^ 0xffffffff) >>> 0, true)
    local.setUint32(18, blob.size, true)
    local.setUint32(22, blob.size, true)
    local.setUint16(26, name.length, true)
    parts.push(local.buffer, name, blob)
    const entry = new DataView(new ArrayBuffer(46))
    entry.setUint32(0, 0x02014b50, true)
    entry.setUint16(4, 20, true)
    new Uint8Array(entry.buffer, 6, 26).set(new Uint8Array(local.buffer, 4, 26))
    entry.setUint32(42, offset, true)
    directory.push(entry.buffer, name)
    offset += 30 + name.length + blob.size
    directorySize += 46 + name.length
  }
  if (offset + directorySize > 0xffffffff) throw Error('报告附件超出 ZIP 格式支持的大小。')
  const end = new DataView(new ArrayBuffer(22))
  end.setUint32(0, 0x06054b50, true)
  end.setUint16(8, files.length, true)
  end.setUint16(10, files.length, true)
  end.setUint32(12, directorySize, true)
  end.setUint32(16, offset, true)
  return new Blob([...parts, ...directory, end.buffer], {type: 'application/zip'})
}
