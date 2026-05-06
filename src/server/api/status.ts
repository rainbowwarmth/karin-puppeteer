import { app } from '../express'
import { getTodayStats, getAllStats, getStatsByDate } from '@/utils'

const formatSize = (bytes: number): string => {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

const formatDuration = (ms: number): string => {
  if (ms === 0) return '0ms'
  if (ms < 1000) return ms + 'ms'
  return (ms / 1000).toFixed(2) + 's'
}

app.get('/status', async (req, res) => {
  try {
    const { time } = req.query
    const all = await getAllStats()

    let data: Record<string, any> = {
      all: {
        count: all.count,
        totalInputSize: all.totalInputSize,
        totalOutputSize: all.totalOutputSize,
        totalInputSizeFormatted: formatSize(all.totalInputSize),
        totalOutputSizeFormatted: formatSize(all.totalOutputSize),
        totalRenderTime: all.totalRenderTime,
        totalRenderTimeFormatted: formatDuration(all.totalRenderTime),
        avgRenderTime: all.avgRenderTime,
        avgRenderTimeFormatted: formatDuration(all.avgRenderTime)
      }
    }

    if (time && typeof time === 'string') {
      const dateMatch = time.match(/^(\d{4})-(\d{2})-(\d{2})$/)
      if (!dateMatch) {
        return res.status(400).send({ status: 400, message: '日期格式错误，应为 YYYY-MM-DD' })
      }

      const todayStr = new Date().toISOString().split('T')[0]
      let specifiedDate

      if (time === todayStr) {
        specifiedDate = await getTodayStats()
      } else {
        specifiedDate = await getStatsByDate(time)
      }

      data.date = time
      data.today = {
        count: specifiedDate.count,
        totalInputSize: specifiedDate.totalInputSize,
        totalOutputSize: specifiedDate.totalOutputSize,
        totalInputSizeFormatted: formatSize(specifiedDate.totalInputSize),
        totalOutputSizeFormatted: formatSize(specifiedDate.totalOutputSize),
        totalRenderTime: specifiedDate.totalRenderTime,
        totalRenderTimeFormatted: formatDuration(specifiedDate.totalRenderTime),
        avgRenderTime: specifiedDate.avgRenderTime,
        avgRenderTimeFormatted: formatDuration(specifiedDate.avgRenderTime)
      }
    } else {
      const today = await getTodayStats()
      data.today = {
        count: today.count,
        totalInputSize: today.totalInputSize,
        totalOutputSize: today.totalOutputSize,
        totalInputSizeFormatted: formatSize(today.totalInputSize),
        totalOutputSizeFormatted: formatSize(today.totalOutputSize),
        totalRenderTime: today.totalRenderTime,
        totalRenderTimeFormatted: formatDuration(today.totalRenderTime),
        avgRenderTime: today.avgRenderTime,
        avgRenderTimeFormatted: formatDuration(today.avgRenderTime)
      }
    }

    res.status(200).send({
      status: 200,
      data
    })
  } catch (error: any) {
    res.status(500).send({ status: 500, message: error.message || '获取统计数据失败' })
  }
})