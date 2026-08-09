declare const __LAZYSCOUT_VERSION__: string | undefined

export const VERSION = typeof __LAZYSCOUT_VERSION__ === 'string' ? __LAZYSCOUT_VERSION__ : '0.0.0-dev'
