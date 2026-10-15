// บีบอัด preview.html เป็นไฟล์เดียวที่แตกตัวเองเมื่อเปิด (ตัวดูไฟล์บางแบบแสดงไฟล์ใหญ่ ๆ ไม่ได้): node scripts/pack-preview.mjs [เข้า=preview.html] [ออก=preview-packed.html]
import fs from 'node:fs'
import zlib from 'node:zlib'
const [src = 'preview.html', out = 'preview-packed.html'] = process.argv.slice(2)
const b64 = zlib.gzipSync(fs.readFileSync(src), { level: 9 }).toString('base64')
fs.writeFileSync(out, `<!doctype html><html lang="th"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>บัญชีคริสตจักร (พรีวิว)</title></head><body><p id="l" style="font:16px sans-serif;padding:1rem">กำลังโหลด…</p><script>
(async () => {
  const bin = atob('${b64}'), u = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i)
  const html = await new Response(new Blob([u]).stream().pipeThrough(new DecompressionStream('gzip'))).text()
  document.open(); document.write(html); document.close()
})()
</script></body></html>`)
console.log(out, (fs.statSync(out).size / 1024).toFixed(0), 'KB (จาก', (fs.statSync(src).size / 1024).toFixed(0), 'KB)')
