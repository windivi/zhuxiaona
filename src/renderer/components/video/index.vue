<template>
	<div class="video-wrapper">
		<!-- 使用原生HTML5 video标签，简单可靠 -->
		<video ref="videoElement" class="video-player" controls preload="metadata" @play="emit('play')"
			@pause="emit('pause')" @error="handleVideoError">
			<source :src="currentPlayUrl" type="video/mp4" />
			您的浏览器不支持视频播放
		</video>
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

/** 播放视频 */
async function play(url?: string) {
	const targetUrl = url ?? props.src;
	if (!targetUrl || !videoElement.value) return;

	try {
		videoElement.value.pause();
		currentPlayUrl.value = targetUrl;
		await new Promise(resolve => setTimeout(resolve, 100));
		videoElement.value.load();
	} catch (err) {
		console.error('[video] 播放错误:', err);
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
	emit('ready');
	if (props.src) {
		play();
	}
});

onUnmounted(() => {
	videoElement.value?.pause();
	emit('destroy');
});

// 监听src属性变化
watch(
	() => props.src,
	(newUrl) => {
		if (newUrl) {
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
</style>
