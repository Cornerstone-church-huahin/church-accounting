// ข้อมูลสมมติสำหรับพรีวิวหน้า ทะเบียนสมาชิก (ไม่ใช่รายชื่อจริง) — DEMO_SEED=scripts/members-demo-seed.js VITE_START=/members npm run build:preview
;(function () {
  try { if (localStorage.getItem('demo-members-seeded')) return; localStorage.setItem('demo-members-seeded', '1') } catch (e) { return }
  var iso = function (x) { return x.toISOString().slice(0, 10) }
  var mk = function (id, name, extra) { return Object.assign({ id: id, name: name, updated: 1, status: 'สมาชิกสมบูรณ์' }, extra) }
  var recent = iso(new Date(Date.now() - 90 * 864e5))
  var people = [
    mk('m1', 'นายสมชาย ตัวอย่าง', { nick: 'ชาย', code: '001', group: 'ผู้ใหญ่', since: '2005-03-06' }),
    mk('m2', 'นางสมหญิง ทดสอบ', { nick: 'หญิง', code: '002', group: 'ผู้ใหญ่', since: '2010-01-03' }),
    mk('m3', 'นายสมศักดิ์ ขาดไป', { code: '003', group: 'ผู้ใหญ่', since: '2012-05-06' }),
    mk('m4', 'นางสาวใหม่ เพิ่งมา', { code: '004', group: 'เยาวชน', since: recent }),
    mk('m5', 'นายผู้ล่วงลับ ตัวอย่าง', { code: '005', status: 'เสียชีวิต', since: '1999-01-03' }),
    mk('m6', 'นางสมพร หายไปนาน', { code: '006', group: 'ผู้ใหญ่', since: '2008-02-03' })
  ]
  localStorage.setItem('acct.church-members.v1', JSON.stringify(people))
  var att = {}, d = new Date()
  d.setDate(d.getDate() - d.getDay())
  for (var i = 0; i < 150; i++) {
    var s = iso(d), ids = ['m1']
    if (i % 2) ids.push('m2')
    if (i < 10) ids.push('m4')
    if (i > 30 && i < 60) ids.push('m3')
    if (i > 70 && i < 90) ids.push('m6')
    var y = s.slice(0, 4); (att[y] = att[y] || []).push({ id: s, date: s, ids: ids, updated: 1 })
    d.setDate(d.getDate() - 7)
  }
  for (var k in att) localStorage.setItem('acct.attendance.' + k + '.v1', JSON.stringify(att[k]))
})()
