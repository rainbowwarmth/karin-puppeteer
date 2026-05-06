import path from 'node:path'
import { config } from '@/utils'
import { vueToHtml } from '@/ssr'
import { Puppeteer } from '@karinjs/puppeteer-core'
import type { ScreenshotOptions } from './types'

export const puppeteer = await new Puppeteer({
  ...config,
  chrome: config.browser === 'chrome-headless-shell'
    ? 'chrome-headless-shell'
    : 'chrome',
}).init()

export const screenshot = async (options: ScreenshotOptions) => {
  options.srcFile = options.file

  if (options.components === 'vue' || path.extname(options.file) === '.vue') {
    options.file = await vueToHtml(options.file, options.data || {})
    options.selector = '#app'
    delete options.data
  } else if (options.html) {
    // 直接传递 HTML 字符串，让 puppeteer-core 内部使用 setContent
    options.file = options.html
    delete options.html
  }

  return puppeteer.screenshot(options)
}
