// esbuild แทนค่า __LAZYSCOUT_VERSION__ ด้วยเลขเวอร์ชันจริงจาก package.json ตอน build
declare const __LAZYSCOUT_VERSION__: string | undefined

export const VERSION = typeof __LAZYSCOUT_VERSION__ === 'string' ? __LAZYSCOUT_VERSION__ : '0.0.0-dev'
