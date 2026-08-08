import { LOCAL_QA_POLICY, PUBLIC_SAAS_POLICY, type UrlPolicy } from '@lazyscout/core'

/**
 * ตั้งค่าทั้งหมดของ server อยู่ที่ไฟล์เดียว
 * เปลี่ยน LAZYSCOUT_MODE=public เมื่อ deploy online เพื่อปิดการเข้าถึงเครือข่ายภายใน (SSRF)
 */
export const config = {
  host: process.env.HOST ?? '127.0.0.1',
  port: Number(process.env.PORT ?? 4000),
  urlPolicy: (process.env.LAZYSCOUT_MODE === 'public' ? PUBLIC_SAAS_POLICY : LOCAL_QA_POLICY) as UrlPolicy,
  limits: {
    maxPages: 20,
    maxDepth: 3
  }
}

/** บังคับให้ค่าที่ user ส่งมาอยู่ในช่วงที่ปลอดภัย */
export function clamp(value: number | undefined, min: number, max: number, fallback: number): number {
  if (value === undefined || Number.isNaN(value)) return fallback
  return Math.min(Math.max(Math.trunc(value), min), max)
}
