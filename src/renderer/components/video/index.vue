<template>
	<div class="easyplayer-wrapper">
		<div ref="container" class="player_box" />
	</div>
</template>

<script setup lang="ts">
import { useStorage } from '@vueuse/core';
import { ref, onMounted, onUnmounted, watch } from 'vue';

/**
 * 简单的 EasyPlayerPro Wrapper（Vue3 + TypeScript）
 * Props:
 *  - src: 要播放的地址（ws:// / http(s) / flv 等）
 *  - 组件假设页面已全局引入 EasyPlayer-pro 脚本（例如在 `index.html` 中通过 <script> 引入），不再动态加载脚本。
 *  - isLive, hasAudio, MSE, WCS, autoplay, bufferTime: 透传到 EasyPlayerPro 的构造选项
 *  - enableH265: 语义选项，若为 true 会尝试启用 WCS（或 MSE）以便 H.265 解码（需 EasyPlayer 支持）
 * Emits: ready, play, pause, error, destroy
 */

const videoPlayerSettings = useStorage('video-player-settings', {
	isLive: false,
	hasAudio: true,
	MSE: true,
	WCS: true,
	autoplay: true,
	bufferTime: 0.2,
	isMute: true,
	WASM: true,
	WASMSIMD: true,
	gpuDecoder: true,
	webGPU: true,
});

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

const container = ref<HTMLElement | null>(null);
let player: any = null;

async function initPlayer() {
	// 组件不动态加载脚本，依赖页面（例如 `index.html`）已通过 <script> 引入 EasyPlayer-pro
	const EasyPlayerPro = (window as any).EasyPlayerPro;
	if (!EasyPlayerPro) {
		// 既然不动态加载，这里直接报错，提示用户在页面中引入脚本
		emit('error', new Error('EasyPlayerPro is not available on window. Please include EasyPlayer-pro.js in the page (e.g. in index.html)'));
		return;
	}

	player = new EasyPlayerPro(container.value, videoPlayerSettings.value);

	// 绑定基本事件
	if (player.on) {
		try {
			player.on('error', (e: any) => emit('error', e));
		} catch (e) {
			// ignore
		}
	}

	emit('ready');

	if (props.src) {
		play();
	}
}

function destroyPlayer() {
	if (player) {
		try {
			player.destroy && player.destroy();
		} catch (e) {
			// ignore
		}
		player = null;
		emit('destroy');
	}
}

function play(url?: string) {
	if (!player) return;
	const u = url ?? props.src;
	if (!u) return;
	// EasyPlayerPro.play 返回 Promise（示例中如此），兼容处理
	try {
		const p = player.play(u);
		if (p && typeof p.then === 'function') {
			p.then(() => emit('play')).catch((err: any) => emit('error', err));
		} else {
			emit('play');
		}
		return p;
	} catch (err) {
		emit('error', err);
	}
}

function pause() {
	if (!player) return;
	try {
		player.pause && player.pause();
		emit('pause');
	} catch (e) {
		// ignore
	}
}

onMounted(() => {
	initPlayer();
});

onUnmounted(() => {
	destroyPlayer();
});

watch(
	() => props.src,
	(val) => {
		if (!val) return;
		// 当 src 变化时，自动播放新地址
		if (player) {
			play(val);
		}
	},
);

// 导出给模板或外部使用（可在父组件通过 ref 调用）
defineExpose({ play, pause, destroy: destroyPlayer });

</script>

<style scoped>
.easyplayer-wrapper {
	min-width: 60vw;
	min-height: 60vh;
	width: 100%;
	height: 100%;
}

.player_box {
	width: 100%;
	height: 100%;
	min-width: 60vw;
	min-height: 60vh;
	position: relative;
}
</style>