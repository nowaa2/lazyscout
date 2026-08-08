import { defineConfig } from 'vitest/config'

// รัน unit test ของ packages ทั้งหมดจาก root เดียว (ไม่ต้องตั้งค่าแยกทีละ package)
export default defineConfig({
  test: {
    include: ['packages/*/tests/**/*.test.ts'],
    environment: 'node'
  }
})
