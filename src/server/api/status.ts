import { app } from '../express'
import { getTodayStats, getAllStats } from '@/utils'

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
    const today = await getTodayStats()
    const all = await getAllStats()

    res.status(200).send({
      status: 200,
      data: {
        today: {
          count: today.count,
          totalInputSize: today.totalInputSize,
          totalOutputSize: today.totalOutputSize,
          totalInputSizeFormatted: formatSize(today.totalInputSize),
          totalOutputSizeFormatted: formatSize(today.totalOutputSize),
          totalRenderTime: today.totalRenderTime,
          totalRenderTimeFormatted: formatDuration(today.totalRenderTime),
          avgRenderTime: today.avgRenderTime,
          avgRenderTimeFormatted: formatDuration(today.avgRenderTime)
        },
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
    })
  } catch (error: any) {
    res.status(500).send({ status: 500, message: error.message || '获取统计数据失败' })
  }
})
