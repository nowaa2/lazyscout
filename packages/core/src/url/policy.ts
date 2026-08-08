import type { UrlPolicy } from '../types/url.js'

/**
 * โหมด MVP: เป็น Local QA Tool จึงอนุญาต localhost / private network
 * (จุดประสงค์หลักคือให้ Tester ยิงใส่ dev server ของตัวเอง)
 */
export const LOCAL_QA_POLICY: UrlPolicy = {
  allowedProtocols: ['http:', 'https:'],
  allowLoopback: true,
  allowPrivateNetwork: true,
  allowCloudMetadata: false
}

/**
 * โหมดสำหรับ online version ในอนาคต: บล็อกทุกอย่างที่อยู่ในเครือข่ายภายใน
 * เปลี่ยน policy ตัวเดียวก็ปิดช่อง SSRF ได้โดยไม่ต้องแก้ explorer
 */
export const PUBLIC_SAAS_POLICY: UrlPolicy = {
  allowedProtocols: ['http:', 'https:'],
  allowLoopback: false,
  allowPrivateNetwork: false,
  allowCloudMetadata: false
}
