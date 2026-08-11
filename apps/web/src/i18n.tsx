import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'

export type AppLanguage = 'en' | 'th'
const dictionary = {
  en: {
    overview: 'Overview',
    testCases: 'Test Cases',
    automation: 'Automation',
    scoutLog: 'Scout Log',
    explorer: 'Explorer',
    newProject: 'New project',
    projects: 'Projects',
    files: 'Files',
    settings: 'Project settings',
    localWorkspace: 'Local workspace',
    storedHere: 'Projects are stored on this device',
    activeTarget: 'Active project target',
    savedProject: 'Saved project',
    newWorkspace: 'New local workspace',
    scoutWebsite: 'Scout a website',
    targetUrl: 'Target URL',
    startPath: 'Start Path',
    scopePath: 'Scope Path',
    maxPages: 'Max pages',
    maxDepth: 'Max depth',
    language: 'Test Case Language',
    english: 'English',
    thai: 'ไทย',
    scoutSite: 'Scout Site',
    targetedExploration: 'Targeted Exploration',
    targetedExplorationHelp: 'Limit exploration to a specific page or path.',
    startPathHelp: 'The page path where exploration should begin, such as /admin/users.',
    scopePathHelp: 'Keep exploration under this path, such as /admin.',
    startPathHint: 'Where to continue exploring after login',
    scopePathHint: 'Limits exploration to this section',
    explore: 'Explore',
    currentPageOnly: 'Current page only',
    thisSection: 'This section',
    entireSite: 'Entire site',
    targetedGuideTitle: 'How to use Targeted Exploration',
    targetedGuideTargetUrl: 'Enter the main URL of the system you want LazyScout to explore.',
    targetedGuideStartPath: 'Enter the path where exploration should begin, such as',
    targetedGuideScopePath: 'Set a boundary such as',
    targetedGuideScopePathEnd: 'so the flow does not move to other areas.',
    targetedGuideCurrentPage: 'explores one page',
    targetedGuideThisSection: 'explores only the scope',
    targetedGuideEntireSite: 'explores the whole website',
    targetedGuideExample:
      'Example: Target URL = your system, Start Path = /admin/users, Scope Path = /admin, choose This section.',
    search: 'Search',
    addCase: 'Add Test Case',
    screenshot: 'Screenshot',
    delete: 'Delete',
    export: 'Export CSV',
    activeProjectTarget: 'Active project target',
    currentProject: 'Current project',
    scoutDescription: 'Enter a URL and let Playwright discover pages, controls, forms and UI states automatically.',
    scouting: 'Scouting…',
    optional: 'optional',
    targetUrlHelp: 'The main website URL that LazyScout should open and explore, such as https://example.com.',
    maxPagesHelp: 'Maximum number of pages Scout will inspect. Higher values may take longer.',
    maxDepthHelp: 'Link depth from the starting page. 0 means one page; 1 means pages linked from it.',
    testLanguageHelp: 'Language used for generated Test Case titles and details.',
    maxPagesDescription: 'Maximum number of pages to inspect',
    maxDepthDescription: 'Link depth to follow from the target page',
    testLanguageDescription: 'Language used for generated Test Case details',
    safetyNotice: 'Playwright stays within the same origin and avoids actions that can change or delete data.',
    includeApiChecks: 'Include API checks from XHR/fetch',
    waitAfterNavigation: 'Wait after navigation',
    debugMode: 'Debug mode',
    scoutAgain: 'Scout again',
    regenerateProject: 'Regenerate this project?',
    regenerateWarning:
      'Scout Site will replace the current discovered pages and generated Test Cases for this project.',
    regenerateHint: 'Export any Test Cases you want to keep before confirming. Project Settings will remain unchanged.',
    cancel: 'Cancel',
    expandScout: 'Expand Scout form',
    collapseScout: 'Collapse Scout form',
    help: 'Help'
  },
  th: {
    overview: 'ภาพรวม',
    testCases: 'Test Case',
    automation: 'Automation',
    scoutLog: 'Scout Log',
    explorer: 'Explorer',
    newProject: 'โปรเจกต์ใหม่',
    projects: 'โปรเจกต์',
    files: 'ไฟล์',
    settings: 'ตั้งค่าโปรเจกต์',
    localWorkspace: 'พื้นที่ทำงานในเครื่อง',
    storedHere: 'โปรเจกต์ถูกเก็บไว้ในอุปกรณ์นี้',
    activeTarget: 'เว็บไซต์ของโปรเจกต์',
    savedProject: 'บันทึกแล้ว',
    newWorkspace: 'พื้นที่ทำงานใหม่',
    scoutWebsite: 'สำรวจเว็บไซต์',
    targetUrl: 'URL เป้าหมาย',
    startPath: 'จุดเริ่มต้น (Path)',
    scopePath: 'ขอบเขต (Path)',
    maxPages: 'จำนวนหน้าสูงสุด',
    maxDepth: 'ระดับความลึก',
    language: 'ภาษาของ Test Case',
    english: 'English',
    thai: 'ไทย',
    scoutSite: 'Scout Site',
    targetedExploration: 'Targeted Exploration',
    targetedExplorationHelp: 'กำหนดขอบเขตการสำรวจเฉพาะหน้า หรือเฉพาะ path ที่ต้องการ',
    startPathHelp: 'หน้าเริ่มต้นภายในเว็บไซต์ เช่น /admin/users ใช้เมื่ออยากเริ่มจากหน้าลึก ๆ',
    scopePathHelp: 'จำกัดการสำรวจให้อยู่ใต้ path นี้ เช่น /admin จะไม่ออกไปสำรวจส่วนอื่นของเว็บ',
    startPathHint: 'หน้าที่ต้องการให้เริ่มสำรวจหลังเข้าสู่ระบบ',
    scopePathHint: 'จำกัดการสำรวจให้อยู่ในส่วนนี้',
    explore: 'ขอบเขตการสำรวจ',
    currentPageOnly: 'สำรวจหน้าเดียว',
    thisSection: 'สำรวจเฉพาะส่วนนี้',
    entireSite: 'สำรวจทั้งเว็บไซต์',
    targetedGuideTitle: 'วิธีใช้ Targeted Exploration',
    targetedGuideTargetUrl: 'ใส่ URL หลักของระบบที่ต้องการให้ LazyScout สำรวจ',
    targetedGuideStartPath: 'ใส่ path ที่ต้องการให้เริ่ม เช่น',
    targetedGuideScopePath: 'ใส่ขอบเขต เช่น',
    targetedGuideScopePathEnd: 'เพื่อไม่ให้ flow โยกไปหน้าอื่น',
    targetedGuideCurrentPage: 'สำรวจเพียงหน้าเดียว',
    targetedGuideThisSection: 'สำรวจเฉพาะ scope',
    targetedGuideEntireSite: 'สำรวจทั้งเว็บไซต์',
    targetedGuideExample:
      'ตัวอย่าง: Target URL = ระบบของคุณ, Start Path = /admin/users, Scope Path = /admin, เลือก This section',
    search: 'ค้นหา',
    addCase: 'เพิ่ม Test Case',
    screenshot: 'Screenshot',
    delete: 'ลบ',
    export: 'Export CSV',
    activeProjectTarget: 'เว็บไซต์เป้าหมายของโปรเจกต์',
    currentProject: 'โปรเจกต์ปัจจุบัน',
    scoutDescription: 'ใส่ URL แล้วให้ Playwright ค้นหาหน้า ปุ่ม ฟอร์ม และสถานะ UI โดยอัตโนมัติ',
    scouting: 'กำลังสำรวจ…',
    optional: 'ไม่บังคับ',
    targetUrlHelp: 'URL หลักของเว็บไซต์ที่ต้องการให้ LazyScout เปิดและสำรวจ เช่น https://example.com',
    maxPagesHelp: 'จำนวนหน้าสูงสุดที่ Scout จะสำรวจ ค่ายิ่งมากอาจใช้เวลานานขึ้น',
    maxDepthHelp: 'ระดับความลึกของลิงก์จากหน้าเริ่มต้น 0 คือหน้าเดียว และ 1 คือหน้าที่ลิงก์จากหน้านั้น',
    testLanguageHelp: 'ภาษาที่ใช้สร้างชื่อและรายละเอียดของ Test Case',
    maxPagesDescription: 'จำนวนหน้าสูงสุดที่จะสำรวจ',
    maxDepthDescription: 'ระดับความลึกของลิงก์จากหน้าเป้าหมาย',
    testLanguageDescription: 'ภาษาที่ใช้สร้างรายละเอียด Test Case',
    safetyNotice: 'Playwright จะอยู่ภายใน origin เดียวกัน และหลีกเลี่ยงการกระทำที่อาจเปลี่ยนแปลงหรือลบข้อมูล',
    includeApiChecks: 'รวม API checks จาก XHR/fetch',
    waitAfterNavigation: 'รอหลังเปลี่ยนหน้า',
    debugMode: 'โหมด Debug',
    scoutAgain: 'สำรวจอีกครั้ง',
    regenerateProject: 'ต้องการสร้างข้อมูลของโปรเจกต์นี้ใหม่หรือไม่?',
    regenerateWarning: 'Scout Site จะเขียนทับหน้าที่ค้นพบและ Test Case ที่สร้างไว้ของโปรเจกต์นี้',
    regenerateHint: 'Export Test Case ที่ต้องการเก็บไว้ก่อนยืนยัน ส่วน Project Settings จะยังคงเดิม',
    cancel: 'ยกเลิก',
    expandScout: 'ขยายฟอร์ม Scout',
    collapseScout: 'พับฟอร์ม Scout',
    help: 'คำอธิบาย'
  }
} as const

type LanguageContextValue = {
  language: AppLanguage
  setLanguage: (language: AppLanguage) => void
  toggleLanguage: () => void
  t: (key: keyof typeof dictionary.en) => string
}
const LanguageContext = createContext<LanguageContextValue | null>(null)

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguage] = useState<AppLanguage>(
    () => (localStorage.getItem('lazyscout-language') as AppLanguage) || 'en'
  )
  useEffect(() => {
    localStorage.setItem('lazyscout-language', language)
    document.documentElement.lang = language
  }, [language])
  const value = useMemo(
    () => ({
      language,
      setLanguage,
      toggleLanguage: () => setLanguage((current) => (current === 'en' ? 'th' : 'en')),
      t: (key: keyof typeof dictionary.en) => dictionary[language][key]
    }),
    [language]
  )
  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>
}

export function useLanguage() {
  const value = useContext(LanguageContext)
  if (!value) throw new Error('useLanguage must be used inside LanguageProvider')
  return value
}
