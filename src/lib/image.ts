/** ย่อรูปใบเสร็จก่อนอัปโหลด (ด้านยาวสุด 1600px · JPEG) เพื่อไม่ให้ repo ข้อมูลโตเร็วและอัปโหลดบนมือถือไม่ช้า */
export async function compressImage(file: File, maxSide = 1600, quality = 0.72): Promise<{ data: ArrayBuffer; ext: string }> {
  if (!file.type.startsWith('image/')) return { data: await file.arrayBuffer(), ext: (file.name.split('.').pop() || 'bin').toLowerCase().replace(/[^a-z0-9]/g, '') }
  const bmp = await createImageBitmap(file)
  const scale = Math.min(1, maxSide / Math.max(bmp.width, bmp.height))
  const w = Math.round(bmp.width * scale), h = Math.round(bmp.height * scale)
  const canvas = document.createElement('canvas')
  canvas.width = w; canvas.height = h
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('ย่อรูปไม่ได้บนเครื่องนี้')
  ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, w, h)
  ctx.drawImage(bmp, 0, 0, w, h)
  bmp.close()
  const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, 'image/jpeg', quality))
  if (!blob) throw new Error('ย่อรูปไม่ได้')
  return { data: await blob.arrayBuffer(), ext: 'jpg' }
}
