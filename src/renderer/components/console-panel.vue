<template>
  <div class="console-panel">
    <div class="console-header">
      <span class="console-title">后端日志</span>
      <div class="console-actions">
        <a-button type="text" size="small" @click="handleClear">清空</a-button>
        <a-button type="text" size="small" @click="handleAutoScroll">{{ autoScroll ? '禁用' : '启用' }}自动滚动</a-button>
      </div>
    </div>
    <div class="console-content" ref="contentRef">
      <div
        v-for="(log, index) in logs"
        :key="index"
        :class="['console-line', `level-${log.level}`]"
      >
        <span class="log-time">{{ formatTime(log.timestamp) }}</span>
        <span :class="['log-level', `level-${log.level}`]">{{ log.level.toUpperCase() }}</span>
        <span class="log-message">{{ log.message }}</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, watch, nextTick } from 'vue'
import { Button as AButton } from 'ant-design-vue'

interface LogMessage {
  level: 'log' | 'warn' | 'error' | 'info'
  timestamp: number
  message: string
}

const logs = ref<LogMessage[]>([])
const autoScroll = ref(true)
const contentRef = ref<HTMLElement>()

onMounted(async () => {
  // 获取历史日志
  const existingLogs = await window.electronAPI.getLogs()
  logs.value = existingLogs

  // 监听实时日志
  window.electronAPI.onLogMessage((log: LogMessage) => {
    logs.value.push(log)
    // 保持最多1000条日志
    if (logs.value.length > 1000) {
      logs.value = logs.value.slice(-1000)
    }
  })

  // 自动滚动到底部
  watch(
    () => logs.value.length,
    async () => {
      if (autoScroll.value) {
        await nextTick()
        if (contentRef.value) {
          contentRef.value.scrollTop = contentRef.value.scrollHeight
        }
      }
    }
  )
})

const formatTime = (timestamp: number) => {
  const date = new Date(timestamp)
  return date.toLocaleTimeString('zh-CN')
}

const handleClear = async () => {
  await window.electronAPI.clearLogs()
  logs.value = []
}

const handleAutoScroll = () => {
  autoScroll.value = !autoScroll.value
}
</script>

<style scoped>
.console-panel {
  display: flex;
  flex-direction: column;
  height: 100%;
  border: 1px solid #d9d9d9;
  border-radius: 2px;
  overflow: hidden;
  background: #15011a;
}

.console-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 12px;
  border-bottom: 1px solid #f0f0f0;
}

.console-title {
  font-weight: 500;
  font-size: 14px;
}

.console-actions {
  display: flex;
  gap: 8px;
}

.console-content {
  flex: 1;
  overflow-y: auto;
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
  font-size: 12px;
  padding: 8px 0;
  background: #1e1e1e;
}

.console-line {
  padding: 2px 12px;
  color: #d4d4d4;
  display: flex;
  gap: 8px;
  align-items: center;
  white-space: pre-wrap;
  word-break: break-all;
}

.console-line:hover {
  background: #2d2d2d;
}

.log-time {
  color: #858585;
  flex-shrink: 0;
  min-width: 80px;
}

.log-level {
  flex-shrink: 0;
  min-width: 50px;
  font-weight: 500;
}

.log-level.level-log {
  color: #4ec9b0;
}

.log-level.level-info {
  color: #569cd6;
}

.log-level.level-warn {
  color: #dcdcaa;
}

.log-level.level-error {
  color: #f48771;
}

.log-message {
  flex: 1;
  color: #d4d4d4;
}

.level-log .log-message {
  color: #d4d4d4;
}

.level-info .log-message {
  color: #569cd6;
}

.level-warn .log-message {
  color: #dcdcaa;
}

.level-error .log-message {
  color: #f48771;
}
</style>
