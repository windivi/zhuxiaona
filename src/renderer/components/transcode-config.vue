<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { message } from 'ant-design-vue';

// 配置状态
const config = ref({
  waitForComplete: true,  // 是否等待转码完成再播放
  cacheVersion: '5',
  transcodePort: 0,
  cacheSize: 0,
  cacheCount: 0,
  currentPreset: 'medium'
});

const presets = ref<any[]>([]);
const loading = ref(false);
const presetsLoading = ref(false);

// 预设说明
const presetDescriptions: { [key: string]: string } = {
  'low': '转码速度慢（可能需要几分钟），但输出质量最好，适合对视频质量要求高的场景',
  'medium': '转码速度中等（几十秒到一分钟），质量良好，推荐日常使用',
  'high': '转码速度快（十几秒），但输出质量相对较低，适合快速预览或低带宽场景'
};

// 获取当前配置
const fetchConfig = async () => {
  try {
    const port = await (window as any).electronAPI?.getTranscodePort?.();
    if (port) {
      config.value.transcodePort = port;
      
      // 从后端获取当前配置状态
      try {
        const response = await fetch(`http://127.0.0.1:${port}/config`);
        if (response.ok) {
          const data = await response.json();
          if (data.success) {
            config.value.waitForComplete = data.waitForComplete;
            config.value.currentPreset = data.preset;
          }
        }
      } catch (e) {
        console.error('获取配置状态失败:', e);
      }
      
      await fetchPresets();
    }
  } catch (e) {
    console.error('获取转码服务信息失败:', e);
  }
};

// 获取预设列表
const fetchPresets = async () => {
  presetsLoading.value = true;
  try {
    const response = await fetch(`http://127.0.0.1:${config.value.transcodePort}/presets`);
    if (response.ok) {
      const data = await response.json();
      presets.value = data.presets || [];
      config.value.currentPreset = data.currentPreset || 'medium';
    }
  } catch (e) {
    console.error('获取预设失败:', e);
  } finally {
    presetsLoading.value = false;
  }
};

// 清除所有缓存
const clearCache = async () => {
  loading.value = true;
  try {
    const response = await fetch(`http://127.0.0.1:${config.value.transcodePort}/clear-cache`, {
      method: 'POST'
    });
    
    if (response.ok) {
      message.success('缓存已清除');
      config.value.cacheSize = 0;
      config.value.cacheCount = 0;
    } else {
      message.error('清除缓存失败');
    }
  } catch (e) {
    message.error('清除缓存出错: ' + (e instanceof Error ? e.message : String(e)));
  } finally {
    loading.value = false;
  }
};

// 获取缓存信息
const fetchCacheInfo = async () => {
  try {
    const response = await fetch(`http://127.0.0.1:${config.value.transcodePort}/cache-info`);
    if (response.ok) {
      const data = await response.json();
      config.value.cacheSize = data.totalSize || 0;
      config.value.cacheCount = data.fileCount || 0;
    }
  } catch (e) {
    console.error('获取缓存信息失败:', e);
  }
};

// 切换等待模式
const toggleWaitMode = async () => {
  try {
    const response = await fetch(`http://127.0.0.1:${config.value.transcodePort}/set-wait-mode`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ waitForComplete: config.value.waitForComplete })
    });
    
    if (response.ok) {
      message.success(config.value.waitForComplete ? '已开启：等待转码完成再播放' : '已切换：边转码边播放');
    }
  } catch (e) {
    message.error('设置失败: ' + (e instanceof Error ? e.message : String(e)));
  }
};

// 切换转码预设
const changePreset = async (presetKey: string) => {
  presetsLoading.value = true;
  try {
    const response = await fetch(`http://127.0.0.1:${config.value.transcodePort}/set-preset`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ preset: presetKey })
    });
    
    if (response.ok) {
      const data = await response.json();
      config.value.currentPreset = presetKey;
      message.success(data.message);
      await fetchPresets();
    } else {
      message.error('设置预设失败');
      config.value.currentPreset = config.value.currentPreset;
    }
  } catch (e) {
    message.error('切换预设出错: ' + (e instanceof Error ? e.message : String(e)));
    config.value.currentPreset = config.value.currentPreset;
  } finally {
    presetsLoading.value = false;
  }
};

onMounted(() => {
  fetchConfig();
  setTimeout(fetchCacheInfo, 1000);
});
</script>

<template>
  <div class="transcode-config-container">
    <div class="config-section">
      <h2>转码服务配置</h2>
      
      <!-- 基本信息 -->
      <a-card title="服务信息" class="info-card">
        <a-descriptions :column="1" bordered>
          <a-descriptions-item label="转码服务端口">
            {{ config.transcodePort }}
          </a-descriptions-item>
          <a-descriptions-item label="缓存版本">
            <a-tag color="blue">v{{ config.cacheVersion }}</a-tag>
          </a-descriptions-item>
          <a-descriptions-item label="缓存文件数">
            {{ config.cacheCount }}
          </a-descriptions-item>
          <a-descriptions-item label="缓存总大小">
            {{ (config.cacheSize / 1024 / 1024).toFixed(2) }} MB
          </a-descriptions-item>
        </a-descriptions>
      </a-card>

      <!-- 转码预设配置 -->
      <a-card title="转码速度/质量预设" class="config-card">
        <a-space direction="vertical" class="full-width">
          <p class="cache-desc">选择转码预设来平衡速度和质量。更改预设后，新转码的视频将使用新设置。</p>
          
          <div class="presets-grid">
            <div 
              v-for="preset in presets" 
              :key="preset.key"
              class="preset-card"
              :class="{ active: config.currentPreset === preset.key }"
              @click="changePreset(preset.key)"
            >
              <div class="preset-header">
                <a-radio :value="preset.key" :checked="config.currentPreset === preset.key" />
                <span class="preset-name">{{ preset.name }}</span>
              </div>
              
              <div class="preset-details">
                <div class="detail-row">
                  <span class="label">FFmpeg Preset:</span>
                  <span class="value">{{ preset.preset }}</span>
                </div>
                <div class="detail-row">
                  <span class="label">码率:</span>
                  <span class="value">{{ preset.bitrate }}</span>
                </div>
                <div class="detail-row">
                  <span class="label">最高码率:</span>
                  <span class="value">{{ preset.maxrate }}</span>
                </div>
              </div>
              
              <div class="preset-description">
                {{ presetDescriptions[preset.key] }}
              </div>
            </div>
          </div>

          <a-alert 
            message="预设说明"
            :description="`当前预设: ${config.currentPreset} - 新的转码任务将使用此预设`"
            type="info"
            show-icon
            closable
          />
        </a-space>
      </a-card>

      <!-- 播放模式配置 -->
      <a-card title="播放模式配置" class="config-card">
        <a-space direction="vertical" class="full-width">
          <div class="mode-item">
            <a-radio-group v-model:value="config.waitForComplete" @change="toggleWaitMode">
              <a-radio :value="true">
                <span class="mode-label">等待完成模式</span>
                <span class="mode-desc">等待转码完全完成后再播放，确保视频可寻址和完整（推荐）</span>
              </a-radio>
            </a-radio-group>
          </div>

          <div class="mode-item">
            <a-radio-group v-model:value="config.waitForComplete" @change="toggleWaitMode">
              <a-radio :value="false">
                <span class="mode-label">流式播放模式</span>
                <span class="mode-desc">边转码边播放，更快速但可能出现进度条增长、无法seek等问题</span>
              </a-radio>
            </a-radio-group>
          </div>

          <a-alert 
            v-if="config.waitForComplete"
            message="当前模式：等待完成"
            description="视频转码完全完成后才会返回给浏览器播放，确保最佳兼容性"
            type="success"
            show-icon
            closable
          />
          <a-alert 
            v-else
            message="当前模式：流式播放"
            description="视频可能在转码过程中就开始播放，可能导致进度不准确或无法seek"
            type="warning"
            show-icon
            closable
          />
        </a-space>
      </a-card>

      <!-- 缓存管理 -->
      <a-card title="缓存管理" class="config-card">
        <a-space direction="vertical" class="full-width">
          <p class="cache-desc">当前缓存：<strong>{{ config.cacheCount }}</strong> 个文件，总大小 <strong>{{ (config.cacheSize / 1024 / 1024).toFixed(2) }} MB</strong></p>
          
          <a-popconfirm
            title="确定要清除所有缓存吗？"
            description="这将删除所有已转码的视频文件（包括转码中的临时文件）"
            ok-text="确定"
            cancel-text="取消"
            @confirm="clearCache"
          >
            <a-button 
              type="primary" 
              danger 
              :loading="loading"
              size="large"
              class="clear-btn"
            >
              🗑️ 清除所有缓存
            </a-button>
          </a-popconfirm>

          <a-alert 
            message="清除缓存会："
            description="1. 删除所有已转码完成的视频文件
2. 删除所有正在转码的临时文件
3. 清空缓存管理器的内存记录
4. 下次播放会重新转码"
            type="info"
            show-icon
            closable
          />
        </a-space>
      </a-card>

      <!-- 转码参数 -->
      <a-card title="当前转码参数" class="config-card">
        <a-descriptions :column="1" bordered>
          <a-descriptions-item label="视频编码">
            libx264 (H.264)
          </a-descriptions-item>
          <a-descriptions-item label="编码速度">
            ultrafast
          </a-descriptions-item>
          <a-descriptions-item label="码率">
            1200 kbps (上限 1500 kbps)
          </a-descriptions-item>
          <a-descriptions-item label="分辨率">
            自适应（最大 1280 宽）
          </a-descriptions-item>
          <a-descriptions-item label="帧率">
            25 fps
          </a-descriptions-item>
          <a-descriptions-item label="音频">
            AAC 96 kbps
          </a-descriptions-item>
          <a-descriptions-item label="MP4 格式">
            faststart (moov 在文件开头)
          </a-descriptions-item>
          <a-descriptions-item label="硬件加速">
            DXVA2 (如可用)
          </a-descriptions-item>
        </a-descriptions>
      </a-card>

      <!-- 帮助信息 -->
      <a-card title="常见问题" class="config-card">
        <a-collapse>
          <a-collapse-panel key="1" header="Q: 为什么我的视频无法拖动进度条？">
            <template #default>
              <p>A: 确保在"等待完成模式"下播放。如果仍然无法拖动，请清除缓存后重新播放。某些旧版本生成的缓存文件可能不支持seek。</p>
            </template>
          </a-collapse-panel>
          <a-collapse-panel key="2" header="Q: 转码需要多长时间？">
            <template #default>
              <p>A: 时间取决于：</p>
              <ul>
                <li>视频分辨率（越高越慢）</li>
                <li>视频时长（越长越慢）</li>
                <li>硬件性能（有硬件加速会更快）</li>
                <li>网络速度（需要先下载原始文件）</li>
              </ul>
            </template>
          </a-collapse-panel>
          <a-collapse-panel key="3" header="Q: 缓存文件存储在哪里？">
            <template #default>
              <p>A: 缓存文件存储在系统临时目录的 transcode-cache 文件夹中：</p>
              <code>%TEMP%/transcode-cache/</code>
            </template>
          </a-collapse-panel>
          <a-collapse-panel key="4" header="Q: 为什么要删除缓存？">
            <template #default>
              <p>A: 在以下情况可能需要删除缓存：</p>
              <ul>
                <li>更新转码参数后（需要重新转码才能生效）</li>
                <li>某个缓存文件损坏或无法播放</li>
                <li>需要释放磁盘空间</li>
                <li>修复播放问题</li>
              </ul>
            </template>
          </a-collapse-panel>
        </a-collapse>
      </a-card>
    </div>
  </div>
</template>

<style scoped>
.transcode-config-container {
  width: 100%;
  height: 100%;
  padding: 20px;
  overflow-y: auto;

  .config-section {
    max-width: 1200px;
    margin: 0 auto;

    h2 {
      margin-bottom: 20px;
      font-size: 24px;
      color: #fff;
    }

    .info-card,
    .config-card {
      margin-bottom: 20px;
      background: #1f1f1f;
      border-color: #434343;

      :deep(.ant-card-head) {
        border-bottom-color: #434343;
      }
    }

    .mode-item {
      padding: 12px;
      border-radius: 4px;
      background: rgba(255, 255, 255, 0.05);
      margin-bottom: 12px;

      .mode-label {
        font-weight: 600;
        margin-right: 12px;
        display: block;
        margin-bottom: 4px;
      }

      .mode-desc {
        display: block;
        font-size: 12px;
        color: #8c8c8c;
        margin-left: 24px;
      }
    }

    .cache-desc {
      font-size: 14px;
      color: #fff;
      margin-bottom: 16px;
    }

    .clear-btn {
      width: 100%;
      height: 40px;
      font-size: 16px;
    }

    .full-width {
      width: 100%;
    }

    .presets-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
      gap: 16px;
      margin: 16px 0;

      .preset-card {
        padding: 16px;
        border-radius: 6px;
        background: rgba(255, 255, 255, 0.05);
        border: 2px solid transparent;
        cursor: pointer;
        transition: all 0.3s ease;

        &:hover {
          background: rgba(255, 255, 255, 0.08);
          border-color: #1890ff;
        }

        &.active {
          background: rgba(24, 144, 255, 0.15);
          border-color: #1890ff;
        }

        .preset-header {
          display: flex;
          align-items: center;
          margin-bottom: 12px;
          gap: 8px;

          .preset-name {
            font-weight: 600;
            font-size: 14px;
            color: #fff;
          }
        }

        .preset-details {
          margin-bottom: 12px;
          padding-bottom: 12px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.1);

          .detail-row {
            display: flex;
            justify-content: space-between;
            font-size: 12px;
            margin-bottom: 6px;
            color: #8c8c8c;

            .label {
              font-weight: 600;
            }

            .value {
              color: #fff;
              font-family: monospace;
            }
          }
        }

        .preset-description {
          font-size: 12px;
          color: #8c8c8c;
          line-height: 1.4;
        }
      }
    }
  }
}

:deep(.ant-radio-wrapper) {
  color: rgba(255, 255, 255, 0.85);

  &:hover {
    color: #fff;
  }
}

:deep(.ant-alert) {
  margin-bottom: 12px;
}

:deep(.ant-descriptions-item-content) {
  color: rgba(255, 255, 255, 0.85);
}
</style>
