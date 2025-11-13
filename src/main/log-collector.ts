/**
 * 日志管理 - 将主进程日志转发给前端
 */
import { ipcMain, BrowserWindow } from 'electron'

interface LogMessage {
    level: 'log' | 'warn' | 'error' | 'info'
    timestamp: number
    message: string
}

class LogCollector {
    private mainWindow: BrowserWindow | null = null
    private logs: LogMessage[] = []
    private maxLogs = 1000

    constructor() {
        this.setupIpcHandlers()
        this.redirectConsoleLogs()
    }

    /**
     * 设置 IPC 处理器
     */
    private setupIpcHandlers() {
        ipcMain.handle('get-logs', () => {
            return this.logs
        })

        ipcMain.handle('clear-logs', () => {
            this.logs = []
            return true
        })
    }

    /**
     * 重定向 console 日志
     */
    private redirectConsoleLogs() {
        const originalLog = console.log
        const originalError = console.error
        const originalWarn = console.warn
        const originalInfo = console.info

        const self = this

        console.log = function (...args: any[]) {
            self.addLog('log', args)
            originalLog.apply(console, args)
        }

        console.error = function (...args: any[]) {
            self.addLog('error', args)
            originalError.apply(console, args)
        }

        console.warn = function (...args: any[]) {
            self.addLog('warn', args)
            originalWarn.apply(console, args)
        }

        console.info = function (...args: any[]) {
            self.addLog('info', args)
            originalInfo.apply(console, args)
        }
    }

    /**
     * 添加日志
     */
    private addLog(level: LogMessage['level'], args: any[]) {
        const message = args.map((arg: any) => {
            if (typeof arg === 'string') {
                return arg
            }
            try {
                return JSON.stringify(arg)
            } catch (e) {
                return String(arg)
            }
        }).join(' ')

        const logMessage: LogMessage = {
            level,
            timestamp: Date.now(),
            message
        }

        this.logs.push(logMessage)

        if (this.logs.length > this.maxLogs) {
            this.logs = this.logs.slice(-this.maxLogs)
        }

        if (this.mainWindow) {
            this.mainWindow.webContents.send('log-message', logMessage)
        }
    }

    /**
     * 设置主窗口引用
     */
    setMainWindow(window: BrowserWindow) {
        this.mainWindow = window
    }

    /**
     * 获取所有日志
     */
    getLogs(): LogMessage[] {
        return [...this.logs]
    }

    /**
     * 清空日志
     */
    clearLogs() {
        this.logs = []
    }
}

export const logCollector = new LogCollector()
