import { app } from '../express'
import { common, logger, addStats } from '@/utils'
import { screenshot } from '@/puppeteer'
import { dealTpl } from './template'
import { httpErrRes, httpSuccRes } from '@/utils/response'
import { ScreenshotOptions } from '@/puppeteer/types'

app.post('/render', async (req, res) => {
  logger.info(`[HTTP][post][收到请求]: ${req.ip} ${JSON.stringify(req.body)}`)
  if (!req.body?.file) return res.status(400).send({ status: 400, message: '无效的file' })

  try {
    const options = req.body as ScreenshotOptions
    options.srcFile = options.file

    const file = dealTpl(options.file, options.data || {})
    if (!file) return res.status(400).send({ status: 400, message: '无效的file' })
    options.file = file
    delete options.data

    const start = Date.now()
    const data = await screenshot(options)

    let outputSize = 0
    if (Buffer.isBuffer(data)) {
      outputSize = data.length
    } else if (typeof data === 'string') {
      outputSize = Buffer.from(data, 'base64').length
    }

    const inputSize = Buffer.from(JSON.stringify(req.body)).length
    await addStats(inputSize, outputSize, Date.now() - start)

    httpSuccRes(res, data, options.encoding, options.multiPage)

    return common.log(data, options.srcFile, start)
  } catch (error: any) {
    console.error(error)
    httpErrRes(res, error)
  }
})

app.post('/render/html', async (req, res) => {
  logger.info(`[HTTP][post][收到HTML渲染请求]: ${req.ip}`)
  if (!req.body?.html) return res.status(400).json({ error: 'HTML content is required', message: '无效的html' })

  try {
    const start = Date.now()
    const options: ScreenshotOptions = {
      file: '',
      html: req.body.html,
      type: req.body.type || 'jpeg',
      quality: req.body.quality || 80,
      encoding: 'binary',
      pageGotoParams: {
        waitUntil: req.body.waitUntil || 'load',
        timeout: req.body.timeout || 30000
      },
      setViewport: req.body.setViewport,
      selector: req.body.selector || '.container'
    }

    const data = await screenshot(options)

    const contentType = options.type === 'jpeg' ? 'image/jpeg' : 'image/png'
    res.setHeader('Content-Type', contentType)

    let imageBuffer: Buffer
    if (Buffer.isBuffer(data)) {
      imageBuffer = data
    } else if (typeof data === 'string') {
      // 如果是 base64 字符串，转换为 Buffer
      imageBuffer = Buffer.from(data, 'base64')
    } else {
      // 其他情况，强制转换
      imageBuffer = Buffer.from(data as any)
    }

    const outputSize = imageBuffer.length
    const inputSize = Buffer.from(req.body.html).length
    await addStats(inputSize, outputSize, Date.now() - start)

    res.status(200).send(imageBuffer)

    return logger.debug(data, 'html-content', start)
  } catch (error: any) {
    console.error('[渲染服务] 渲染失败:', error.message)
    res.status(500).json({
      error: 'Render failed',
      message: error.message
    })
  }
})
