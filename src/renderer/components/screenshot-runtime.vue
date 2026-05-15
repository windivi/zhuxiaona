<template>
	<div class="screenshot-runtime" aria-hidden="true">
		<screen-short
			v-if="activeRequest"
			@destroy-component="handleDestroyComponent"
			@get-image-data="handleImageData"
			@webrtc-error="handleWebrtcError"
		/>
	</div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import type {
	ScreenshotCaptureRequest,
	ScreenshotRuntimeRequest,
	ScreenshotRuntimeResponse,
} from '../services/screenshot-runtime'

const props = defineProps<{
	request: ScreenshotRuntimeRequest | null;
}>()

const emit = defineEmits<{
	response: [response: ScreenshotRuntimeResponse];
}>()

const activeRequest = ref<ScreenshotCaptureRequest | null>(null)

let destroyResponseTimer: number | null = null

function clearDestroyResponseTimer() {
	if (destroyResponseTimer === null) return

	window.clearTimeout(destroyResponseTimer)
	destroyResponseTimer = null
}

function finishRequest() {
	clearDestroyResponseTimer()
	activeRequest.value = null
}

function emitSuccessResponse(request: ScreenshotCaptureRequest, data: string) {
	emit('response', {
		id: request.id,
		type: request.type,
		ok: true,
		data,
	})
}

function emitErrorResponse(request: ScreenshotCaptureRequest, error: unknown) {
	emit('response', {
		id: request.id,
		type: request.type,
		ok: false,
		error: error,
	})
}

function cancelActiveRequest(targetRequestId?: number) {
	const request = activeRequest.value
	if (!request) return
	if (typeof targetRequestId === 'number' && request.id !== targetRequestId) return

	finishRequest()
}

function handleDestroyComponent() {
	const request = activeRequest.value
	if (!request) return

	clearDestroyResponseTimer()
	destroyResponseTimer = window.setTimeout(() => {
		if (!activeRequest.value || activeRequest.value.id !== request.id) return

		emitErrorResponse(request, new Error('截图已取消'))
		finishRequest()
	}, 0)
}

function handleImageData(base64: string) {
	const request = activeRequest.value
	if (!request) return

	clearDestroyResponseTimer()
	emitSuccessResponse(request, base64)
	finishRequest()
}

function handleWebrtcError(error: unknown) {
	const request = activeRequest.value
	if (!request) return

	emitErrorResponse(request, error)
	finishRequest()
}

watch(() => props.request?.id, () => {
	const request = props.request
	if (!request) return
	if (request.type === 'cancel') {
		cancelActiveRequest(request.targetRequestId)
		return
	}

	if (activeRequest.value) {
		emitErrorResponse(request, new Error('已有截图任务正在进行中'))
		return
	}

	activeRequest.value = request
	clearDestroyResponseTimer()
})
</script>

<style scoped>
.screenshot-runtime {
	display: contents;
}
</style>