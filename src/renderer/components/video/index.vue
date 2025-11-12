<template>
	<div class="easyplayer-wrapper">
		<div ref="container" class="player_box" />
	</div>
</template>

<script setup lang="ts">
import { useStorage } from '@vueuse/core';
import { ref, onMounted, onUnmounted, watch } from 'vue';

const videoPlayerSettings = useStorage('video-player-settings', {
	isLive: false,
	hasAudio: true,
	MSE: true,
	// 禁用 WCS（websocket-based streaming）以避免播放器把 HTTP(fMP4) 流当成 websocket 协议处理
	WCS: false,
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
	// 如果为 true，则在播放前请求主进程将该地址转码为 H.264 的本地代理地址
	transcode?: boolean;
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

async function play(url?: string) {
	if (!player) return;
	let u = url ?? props.src;
	if (!u) return;

	// 决定是否需要转码：优先根据 props.transcode（true=强制转码，false=禁用转码），
	// 否则通过主进程探测（ffprobe）判断是否为 MOV 或 HEVC(h265)
	try {
		let doTranscode = false;
		if (props.transcode === true) {
			doTranscode = true;
		} else if (props.transcode === false) {
			doTranscode = false;
		} else if ((window as any).electronAPI && typeof (window as any).electronAPI.shouldTranscode === 'function') {
			try {
				const probe = await (window as any).electronAPI.shouldTranscode(u);
				if (probe && probe.success && probe.shouldTranscode) {
					doTranscode = true;
				}
			} catch (e) {
				// 探测失败时回退到基于扩展名的简单判断
				if (/\.mov($|\?)/i.test(String(u))) doTranscode = true;
			}
		} else {
			// 无主进程探测接口时，使用扩展名回退策略
			if (/\.mov($|\?)/i.test(String(u))) doTranscode = true;
		}

		if (doTranscode) {
			if ((window as any).electronAPI && typeof (window as any).electronAPI.getTranscodeUrl === 'function') {
				const r = await (window as any).electronAPI.getTranscodeUrl(u);
				if (r && r.success && r.url) {
					u = r.url;
				} else {
					emit('error', new Error('transcode failed: ' + (r && r.message ? r.message : 'unknown')));
					return;
				}
			} else {
				emit('error', new Error('transcode requested but getTranscodeUrl is not available'));
				return;
			}
		}

		// 如果是转码得到的 url（一般为 fMP4 via http），确保字符串包含 .mp4 以满足 EasyPlayer 内部判断；
		// 非转码路径直接传原始 URL
		let playUrl = String(u);
		if (doTranscode) {
			if (!/\.mp4/i.test(playUrl) && !/\.m3u8/i.test(playUrl)) {
				try {
					const tmp = new URL(playUrl);
					if (!/\.mp4$/i.test(tmp.pathname) && !/\.m3u8$/i.test(tmp.pathname)) {
						tmp.pathname = tmp.pathname + '.mp4';
					}
					playUrl = tmp.toString();
				} catch (e) {
					playUrl = playUrl + '.mp4';
				}
			}
		}

		try { console.debug('[video] doTranscode=', doTranscode, ' finalPlayUrl=', playUrl); } catch (e) { }

		const p = player.play(playUrl);
		if (p && typeof p.then === 'function') {
			p.then(() => emit('play')).then(() => {
				console.log('player', player);
			}).catch((err: any) => emit('error', err));
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