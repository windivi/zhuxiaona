<template>
	<div class="video-wrapper">
		<!-- 使用原生HTML5 video标签，简单可靠 -->
		<video ref="videoElement" class="video-player" controls preload="metadata" @play="emit('play')"
			@pause="emit('pause')" @error="handleVideoError">
			<source :src="currentPlayUrl" type="video/mp4" />
			您的浏览器不支持视频播放
		</video>
		<!-- 转码加载提示 -->
		<div v-if="isTranscoding" class="transcode-loading">
			<div class="spinner"></div>
			<p>视频转码中...</p>
		</div>
	</div>
</template>

<script setup lang="ts">
import { ref, watch, onMounted, onUnmounted } from 'vue';

const props = defineProps<{
	src: string | null;
}>()

const emit = defineEmits<{
	(e: 'ready'): void;
	(e: 'play'): void;
	(e: 'pause'): void;
	(e: 'error', err: any): void;
	(e: 'destroy'): void;
}>();

const videoElement = ref<HTMLVideoElement | null>(null);
const currentPlayUrl = ref<string>('');
const isTranscoding = ref(false);

/** 处理视频错误 */
function handleVideoError(event: Event) {
	const video = event.target as HTMLVideoElement;
	const error = video.error;
	if (error) {
		const errorMsg = `视频播放失败: ${error.message || '未知错误'}`;
		console.error('[video]', errorMsg);
		emit('error', new Error(errorMsg));
	}
}

/** 获取转码URL */
async function getTranscodeUrl(inputUrl: string): Promise<string> {
	if ((window as any).electronAPI?.getTranscodeUrl) {
		const result = await (window as any).electronAPI.getTranscodeUrl(inputUrl);
		// 新格式：返回 {success: true, cacheId: "..."} 
		// 需要通过 /file 端点来加载本地文件
		if (result.success && result.cacheId) {
			// 构造文件端点URL，让后端通过 /file 端点来提供文件
			let port = 0;
			if ((window as any).electronAPI?.getTranscodePort) {
				port = await (window as any).electronAPI.getTranscodePort();
			}
			const fileUrl = `http://127.0.0.1:${port}/file?id=${encodeURIComponent(result.cacheId)}`;
			console.log('[video] 转码文件端点:', fileUrl);
			return fileUrl;
		}
		throw new Error(result.message || '获取转码URL失败');
	}
	throw new Error('转码服务不可用');
}

/** 检测是否是H.265视频 */
function isH265Video(url: string): boolean {
	// 根据文件扩展名判断
	return /\.(mov|hevc|h265)($|\?)/i.test(url);
}

/** 检测是否需要转码 */
async function shouldTranscode(inputUrl: string): Promise<boolean> {
	if (!inputUrl) return false;
	
	// 对于H.265视频，需要转码以支持旧显卡（如GT 710）
	if (isH265Video(inputUrl)) {
		return true;
	}
	
	// 自动检测
	try {
		if ((window as any).electronAPI?.shouldTranscode) {
			const probe = await (window as any).electronAPI.shouldTranscode(inputUrl);
			console.log('[video] 转码探测结果:', probe);
			return probe.success && probe.shouldTranscode;
		}
	} catch (e) {
		console.warn('[video] 转码探测失败，使用扩展名判断');
	}

	// 回退：根据扩展名判断
	return /\.(mov|hevc|h265|vp8|vp9|av1)($|\?)/i.test(inputUrl);
}

/** 播放视频 */
async function play(url?: string) {
	const targetUrl = url ?? props.src;
	if (!targetUrl || !videoElement.value) return;

	try {
		console.log('[video] 开始播放:', targetUrl);

		// 先暂停当前播放
		videoElement.value.pause();
		currentPlayUrl.value = '';  // 清空当前URL

		// 检测是否需要转码
		const needTranscode = await shouldTranscode(targetUrl);
		console.log('[video] 是否需要转码:', needTranscode);

		let finalUrl = targetUrl;

		if (needTranscode) {
			console.log('[video] 检测到需要转码（H.265或其他格式），等待转码完成...');
			isTranscoding.value = true;  // 立即显示加载界面
			try {
				const startTime = Date.now();
				finalUrl = await getTranscodeUrl(targetUrl);
				const elapsedTime = Date.now() - startTime;
				console.log(`[video] 转码完成，耗时: ${elapsedTime}ms，获取到缓存ID: ${finalUrl}`);
			} catch (transcodeErr) {
				console.warn('[video] 转码失败，降级为直接播放原URL:', transcodeErr);
				finalUrl = targetUrl;  // 转码失败则使用原URL
			} finally {
				isTranscoding.value = false;  // 隐藏加载界面
			}
		} else {
			console.log('[video] 视频无需转码，直接使用原URL');
		}

		// 确保转码完成后再设置播放源
		console.log('[video] 设置播放URL:', finalUrl);
		currentPlayUrl.value = finalUrl;

		// 延迟一下，确保DOM更新
		await new Promise(resolve => setTimeout(resolve, 100));

		// 加载新的视频源
		console.log('[video] 调用videoElement.load()');
		videoElement.value.load();

		// 等待视频可以播放后再开始播放
		// 使用 canplay 事件而不是立即调用 play()
		const onCanPlay = () => {
			if (!videoElement.value) return;
			console.log('[video] 视频可以播放，开始播放');
			videoElement.value.play().catch(err => {
				console.error('[video] 播放失败:', err);
				emit('error', err);
			});
			videoElement.value.removeEventListener('canplay', onCanPlay);
			clearTimeout(timeoutId);
		};

		// 添加超时保护（防止某些情况下 canplay 事件不触发）
		const timeoutId = setTimeout(() => {
			console.warn('[video] canplay 事件超时（5秒），强制播放');
			if (videoElement.value) {
				videoElement.value.removeEventListener('canplay', onCanPlay);
				videoElement.value.play().catch(err => {
					console.error('[video] 强制播放失败:', err);
					emit('error', err);
				});
			}
		}, 5000);

		// 一次性监听 canplay 事件
		videoElement.value.addEventListener('canplay', onCanPlay, { once: true });

		console.log('[video] 已设置播放源，等待 canplay 事件...');
	} catch (err) {
		console.error('[video] 播放错误:', err);
		isTranscoding.value = false;
		emit('error', err);
	}
}

/** 暂停视频 */
function pause() {
	if (videoElement.value) {
		videoElement.value.pause();
	}
}

onMounted(() => {
	console.log('[video] 组件已挂载');
	emit('ready');
	if (props.src) {
		play();
	}
});

onUnmounted(() => {
	console.log('[video] 组件已卸载');
	videoElement.value?.pause();
	emit('destroy');
});

// 监听src属性变化
watch(
	() => props.src,
	(newUrl) => {
		if (newUrl) {
			console.log('[video] src属性已变化，重新播放:', newUrl);
			play(newUrl);
		} else {
			// src为空时暂停播放
			pause();
			currentPlayUrl.value = '';
		}
	},
	{ immediate: false }
);

// 导出API
defineExpose({ play, pause });

</script>

<style scoped>
.video-wrapper {
	position: relative;
	width: 100%;
	height: 100%;
	display: inline-flex;
	background: #000;
	box-sizing: border-box;
}

.video-player {
	max-width: 100%;
	max-height: 100%;
}

.transcode-loading {
	position: absolute;
	top: 0;
	left: 0;
	right: 0;
	bottom: 0;
	display: flex;
	flex-direction: column;
	align-items: center;
	justify-content: center;
	background: rgba(0, 0, 0, 0.7);
	color: white;
	gap: 20px;
	z-index: 10;
}

.spinner {
	width: 40px;
	height: 40px;
	border: 4px solid rgba(255, 255, 255, 0.3);
	border-top-color: white;
	border-radius: 50%;
	animation: spin 1s linear infinite;
}

@keyframes spin {
	to {
		transform: rotate(360deg);
	}
}

.transcode-loading p {
	font-size: 16px;
	margin: 0;
}
</style>
