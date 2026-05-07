import sqlite3 from 'sqlite3'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { logger } from './logger'
import fs from 'fs'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const dataDir = join(process.cwd(), 'data', 'db')
const dbPath = join(dataDir, 'status.db')

if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true })
}

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    logger.error('[数据库] 打开失败:', err.message)
  } else {
    logger.info('[数据库] 打开成功:', dbPath)
    initDB()
  }
})

const getShanghaiDateString = (date: Date): string => {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

const getShanghaiDateTimeString = (date: Date): string => {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')
  const seconds = String(date.getSeconds()).padStart(2, '0')
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`
}

function initDB () {
  db.run(`
    CREATE TABLE IF NOT EXISTS screenshot_stats (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
      input_size INTEGER DEFAULT 0,
      output_size INTEGER DEFAULT 0,
      render_time INTEGER DEFAULT 0
    )
  `, (err) => {
    if (err) {
      logger.error('[数据库] 创建 screenshot_stats 表失败:', err.message)
    }
  })

  db.run(`
    CREATE TABLE IF NOT EXISTS daily_stats (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date DATE UNIQUE,
      count INTEGER DEFAULT 0,
      total_input_size INTEGER DEFAULT 0,
      total_output_size INTEGER DEFAULT 0,
      total_render_time INTEGER DEFAULT 0,
      avg_render_time INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `, (err) => {
    if (err) {
      logger.error('[数据库] 创建 daily_stats 表失败:', err.message)
    } else {
      scheduleDailyMerge()
    }
  })
}

export const addStats = (inputSize: number, outputSize: number, renderTime: number) => {
  return new Promise<void>((resolve, reject) => {
    const now = new Date()
    const dateStr = getShanghaiDateTimeString(now)
    db.run(
      'INSERT INTO screenshot_stats (timestamp, input_size, output_size, render_time) VALUES (?, ?, ?, ?)',
      [dateStr, inputSize, outputSize, renderTime],
      (err) => {
        if (err) {
          logger.error('[数据库] 添加统计失败:', err.message)
          reject(err)
        } else {
          resolve()
        }
      }
    )
  })
}

export const getTodayStats = () => {
  return new Promise<{ count: number; totalInputSize: number; totalOutputSize: number; totalRenderTime: number; avgRenderTime: number }>((resolve, reject) => {
    const todayStr = getShanghaiDateString(new Date())
    db.get(
      `SELECT
        COUNT(*) as count,
        COALESCE(SUM(input_size), 0) as totalInputSize,
        COALESCE(SUM(output_size), 0) as totalOutputSize,
        COALESCE(SUM(render_time), 0) as totalRenderTime,
        COALESCE(AVG(render_time), 0) as avgRenderTime
      FROM screenshot_stats
      WHERE DATE(timestamp) = ?`,
      [todayStr],
      (err, row: any) => {
        if (err) {
          logger.error('[数据库] 获取今日统计失败:', err.message)
          reject(err)
        } else {
          resolve({
            count: row?.count || 0,
            totalInputSize: row?.totalInputSize || 0,
            totalOutputSize: row?.totalOutputSize || 0,
            totalRenderTime: row?.totalRenderTime || 0,
            avgRenderTime: Math.round(row?.avgRenderTime || 0)
          })
        }
      }
    )
  })
}

export const getAllStats = () => {
  return new Promise<{ count: number; totalInputSize: number; totalOutputSize: number; totalRenderTime: number; avgRenderTime: number }>((resolve, reject) => {
    db.get(
      `SELECT
        COALESCE(SUM(count), 0) as count,
        COALESCE(SUM(total_input_size), 0) as totalInputSize,
        COALESCE(SUM(total_output_size), 0) as totalOutputSize,
        COALESCE(SUM(total_render_time), 0) as totalRenderTime,
        COALESCE(AVG(avg_render_time), 0) as avgRenderTime
      FROM (
        SELECT count, total_input_size, total_output_size, total_render_time, avg_render_time FROM daily_stats
        UNION ALL
        SELECT COUNT(*) as count, SUM(input_size) as total_input_size, SUM(output_size) as total_output_size, SUM(render_time) as total_render_time, AVG(render_time) as avg_render_time FROM screenshot_stats
      ) AS combined`,
      (err, row: any) => {
        if (err) {
          logger.error('[数据库] 获取全部统计失败:', err.message)
          reject(err)
        } else {
          resolve({
            count: row?.count || 0,
            totalInputSize: row?.totalInputSize || 0,
            totalOutputSize: row?.totalOutputSize || 0,
            totalRenderTime: row?.totalRenderTime || 0,
            avgRenderTime: Math.round(row?.avgRenderTime || 0)
          })
        }
      }
    )
  })
}

const mergeYesterdayStats = () => {
  return new Promise<void>((resolve, reject) => {
    const now = new Date()
    const yesterday = new Date(now)
    yesterday.setDate(yesterday.getDate() - 1)
    const yesterdayDateStr = getShanghaiDateString(yesterday)

    db.get(
      `SELECT
        COUNT(*) as count,
        COALESCE(SUM(input_size), 0) as total_input_size,
        COALESCE(SUM(output_size), 0) as total_output_size,
        COALESCE(SUM(render_time), 0) as total_render_time,
        COALESCE(AVG(render_time), 0) as avg_render_time
      FROM screenshot_stats
      WHERE DATE(timestamp) = ?`,
      [yesterdayDateStr],
      (err, row: any) => {
        if (err) {
          logger.error('[数据库] 获取昨日统计失败:', err.message)
          return reject(err)
        }

        if (!row || row.count === 0) {
          logger.info('[数据库] 昨日无统计数据，跳过合并')
          return resolve()
        }

        db.run(
          `INSERT OR REPLACE INTO daily_stats
            (date, count, total_input_size, total_output_size, total_render_time, avg_render_time)
          VALUES (?, ?, ?, ?, ?, ?)`,
          [yesterdayDateStr, row.count, row.total_input_size, row.total_output_size, row.total_render_time, Math.round(row.avg_render_time)],
          (insertErr) => {
            if (insertErr) {
              logger.error('[数据库] 插入每日统计失败:', insertErr.message)
              return reject(insertErr)
            }

            db.run(
              `DELETE FROM screenshot_stats WHERE DATE(timestamp) = ?`,
              [yesterdayDateStr],
              (deleteErr) => {
                if (deleteErr) {
                  logger.error('[数据库] 删除昨日数据失败:', deleteErr.message)
                  return reject(deleteErr)
                }
                logger.info(`[数据库] 成功合并昨日(${yesterdayDateStr})统计数据，共${row.count}条记录`)
                resolve()
              }
            )
          }
        )
      }
    )
  })
}

const scheduleDailyMerge = () => {
  const now = new Date()
  const tomorrow = new Date(now)
  tomorrow.setDate(tomorrow.getDate() + 1)
  tomorrow.setHours(0, 0, 0, 0)
  const delay = tomorrow.getTime() - now.getTime()

  const executeMerge = async () => {
    try {
      await mergeYesterdayStats()
    } catch (error) {
      logger.error('[数据库] 每日合并任务执行失败:', error)
    }
    setTimeout(executeMerge, 24 * 60 * 60 * 1000)
  }

  setTimeout(executeMerge, delay)
  logger.info(`[数据库] 每日合并任务已安排，下次执行时间: ${tomorrow.toLocaleString()}`)
}

export const getDailyStats = (days: number = 30) => {
  return new Promise<Array<{ date: string; count: number; total_input_size: number; total_output_size: number; total_render_time: number; avg_render_time: number }>>((resolve, reject) => {
    db.all(
      `SELECT date, count, total_input_size, total_output_size, total_render_time, avg_render_time
       FROM daily_stats
       ORDER BY date DESC
       LIMIT ?`,
      [days],
      (err, rows: any) => {
        if (err) {
          logger.error('[数据库] 获取每日统计失败:', err.message)
          reject(err)
        } else {
          resolve(rows || [])
        }
      }
    )
  })
}

export const getStatsByDate = (date: string) => {
  return new Promise<{ count: number; totalInputSize: number; totalOutputSize: number; totalRenderTime: number; avgRenderTime: number }>((resolve, reject) => {
    db.get(
      `SELECT
        COALESCE(SUM(count), 0) as count,
        COALESCE(SUM(total_input_size), 0) as totalInputSize,
        COALESCE(SUM(total_output_size), 0) as totalOutputSize,
        COALESCE(SUM(total_render_time), 0) as totalRenderTime,
        COALESCE(AVG(avg_render_time), 0) as avgRenderTime
      FROM (
        SELECT count, total_input_size, total_output_size, total_render_time, avg_render_time
        FROM daily_stats
        WHERE date = ?
        UNION ALL
        SELECT COUNT(*) as count, SUM(input_size) as total_input_size, SUM(output_size) as total_output_size, SUM(render_time) as total_render_time, AVG(render_time) as avg_render_time
        FROM screenshot_stats
        WHERE DATE(timestamp) = ?
      ) AS combined`,
      [date, date],
      (err, row: any) => {
        if (err) {
          logger.error('[数据库] 获取指定日期统计失败:', err.message)
          reject(err)
        } else {
          resolve({
            count: row?.count || 0,
            totalInputSize: row?.totalInputSize || 0,
            totalOutputSize: row?.totalOutputSize || 0,
            totalRenderTime: row?.totalRenderTime || 0,
            avgRenderTime: Math.round(row?.avgRenderTime || 0)
          })
        }
      }
    )
  })
}

export default db
