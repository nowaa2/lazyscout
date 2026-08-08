import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'

export type AppLanguage = 'en' | 'th'
const dictionary = {
  en: { overview: 'Overview', testCases: 'Test Cases', automation: 'Automation', scoutLog: 'Scout Log', explorer: 'Explorer', newProject: 'New project', projects: 'Projects', files: 'Files', settings: 'Project settings', localWorkspace: 'Local workspace', storedHere: 'Projects are stored on this device', activeTarget: 'Active project target', savedProject: 'Saved project', newWorkspace: 'New local workspace', scoutWebsite: 'Scout a website', targetUrl: 'Target URL', maxPages: 'Max pages', maxDepth: 'Max depth', language: 'Test Case Language', english: 'English', thai: 'ไทย', scoutSite: 'Scout Site', search: 'Search', addCase: 'Add Test Case', screenshot: 'Screenshot', delete: 'Delete', export: 'Export CSV' },
  th: { overview: 'ภาพรวม', testCases: 'Test Case', automation: 'Automation', scoutLog: 'Scout Log', explorer: 'Explorer', newProject: 'โปรเจกต์ใหม่', projects: 'โปรเจกต์', files: 'ไฟล์', settings: 'ตั้งค่าโปรเจกต์', localWorkspace: 'พื้นที่ทำงานในเครื่อง', storedHere: 'โปรเจกต์ถูกเก็บไว้ในอุปกรณ์นี้', activeTarget: 'เว็บไซต์ของโปรเจกต์', savedProject: 'บันทึกแล้ว', newWorkspace: 'พื้นที่ทำงานใหม่', scoutWebsite: 'สำรวจเว็บไซต์', targetUrl: 'URL เป้าหมาย', maxPages: 'จำนวนหน้าสูงสุด', maxDepth: 'ระดับความลึก', language: 'ภาษาของ Test Case', english: 'English', thai: 'ไทย', scoutSite: 'Scout Site', search: 'ค้นหา', addCase: 'เพิ่ม Test Case', screenshot: 'Screenshot', delete: 'ลบ', export: 'Export CSV' }
} as const

type LanguageContextValue = { language: AppLanguage; setLanguage: (language: AppLanguage) => void; toggleLanguage: () => void; t: (key: keyof typeof dictionary.en) => string }
const LanguageContext = createContext<LanguageContextValue | null>(null)

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguage] = useState<AppLanguage>(() => (localStorage.getItem('lazyscout-language') as AppLanguage) || 'en')
  useEffect(() => { localStorage.setItem('lazyscout-language', language); document.documentElement.lang = language }, [language])
  const value = useMemo(() => ({ language, setLanguage, toggleLanguage: () => setLanguage((current) => current === 'en' ? 'th' : 'en'), t: (key: keyof typeof dictionary.en) => dictionary[language][key] }), [language])
  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>
}

export function useLanguage() {
  const value = useContext(LanguageContext)
  if (!value) throw new Error('useLanguage must be used inside LanguageProvider')
  return value
}
