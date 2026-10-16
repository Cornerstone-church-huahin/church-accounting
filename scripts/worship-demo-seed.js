// ข้อมูลสมมติ: มุมมองของ "ผู้บันทึกการนมัสการ" (ไม่ใช่รายชื่อจริง) — DEMO_SEED=scripts/worship-demo-seed.js VITE_START=/members npm run build:preview
;(function () {
  var FLAG = 'demo-worship-v1'
  try { if (localStorage.getItem(FLAG)) return; Object.keys(localStorage).filter(function (k) { return k.indexOf('acct.') === 0 || k.indexOf('demo-') === 0 }).forEach(function (k) { localStorage.removeItem(k) }); localStorage.setItem(FLAG, '1') } catch (e) { return }
  var iso = function (x) { return x.toISOString().slice(0, 10) }
  localStorage.setItem('acct.sync.v1', JSON.stringify({ repo: 'demo/demo', token: 'demo', name: 'พี่ลงชื่อ (ตัวอย่าง)' }))
  localStorage.setItem('acct.me.v1', JSON.stringify({ id: 'pw1' }))
  localStorage.setItem('acct.members.v1', JSON.stringify([
    { id: 'ad1', name: 'แอดมิน', role: 'admin', joined: 1, updated: 1 },
    { id: 'pw1', name: 'พี่ลงชื่อ (ตัวอย่าง)', role: 'worship', joined: 2, updated: 1 }
  ]))
  var mk = function (id, name, extra) { return Object.assign({ id: id, name: name, updated: 1, status: '1.สมบูรณ์ ( 1 )', tel: '081-000-0000', birth: '1985-06-15' }, extra) }
  var people = [
    mk('m1', 'นายสมชาย ตัวอย่าง', { nick: 'ชาย', code: '001', group: '1.ผู้ชาย', gender: 'ชาย', since: '2005-03-06' }),
    mk('m2', 'นางสมหญิง ทดสอบ', { nick: 'หญิง', code: '002', group: '2.สตรี', gender: 'หญิง', since: '2010-01-03' }),
    mk('m3', 'นายสมศักดิ์ ขาดไป', { code: '003', group: '1.ผู้ชาย', gender: 'ชาย', since: '2012-05-06', status: '2.สมบูรณ์ ( 2 )' }),
    mk('m4', 'นางสาวใหม่ เพิ่งมา', { code: '004', group: '7.ไม่มีกลุ่ม', gender: 'หญิง', status: '5.คนใหม่', since: iso(new Date(Date.now() - 90 * 864e5)) }),
    mk('m5', 'นางสมพร ใจดี', { nick: 'พร', code: '005', group: '2.สตรี', gender: 'หญิง', since: '2008-02-03' }),
    mk('m6', 'นายสมบัติ มั่นคง', { code: '006', group: '1.ผู้ชาย', gender: 'ชาย', since: '2015-09-06' })
  ]
  localStorage.setItem('acct.church-members.v1', JSON.stringify(people))
  var d = new Date(); d.setDate(d.getDate() - d.getDay())
  var rows = {}
  for (var i = 0; i < 20; i++) {
    var s = iso(d), y = s.slice(0, 4), ids = ['m1', 'm5']
    if (i % 2) ids.push('m2')
    if (i < 6) ids.push('m4')
    if (i % 3 === 0) ids.push('m6')
    ids.forEach(function (id) { (rows[y] = rows[y] || []).push({ id: s + '_' + id, date: s, mid: id, tm: '10:05', rec: 'ผู้ช่วย ก', updated: 1 }) })
    d.setDate(d.getDate() - 7)
  }
  localStorage.setItem('acct.recorders.v1', JSON.stringify([{ id: 'rc1', name: 'ผู้ช่วย ก', updated: 1 }, { id: 'rc2', name: 'ผู้ช่วย ข', updated: 1 }]))
  localStorage.setItem('acct.recorder', 'rc1')
  for (var k in rows) localStorage.setItem('acct.attendance.' + k + '.v1', JSON.stringify(rows[k]))
})()
