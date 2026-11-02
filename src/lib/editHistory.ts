/**
 * ประวัติการแก้ไขสำหรับปุ่ม “ย้อนกลับ”: เก็บภาพก่อนแก้ไว้ตามลำดับ (ย้อนได้ไม่น้อยกว่า 10 ขั้น · ค่าตั้งต้น 50)
 */
export function createHistory<T>(limit = 50) {
  const stack: T[] = []
  return {
    push(snapshot: T) { stack.push(snapshot); if (stack.length > limit) stack.shift() },
    undo(): T | undefined { return stack.pop() },
    clear() { stack.length = 0 },
    get size() { return stack.length },
  }
}
