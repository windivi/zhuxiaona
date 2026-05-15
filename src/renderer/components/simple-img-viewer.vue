<template>
	<div v-if="visible" class="img-viewer-overlay">
		<div class="img-viewer-content">
			<a-form-item label="作品理念：">
				{{ currentImage?.workConcept || '无' }}
			</a-form-item>
			<img :src="currentImage?.url" class="img-viewer-tag" />
			<div class="img-viewer-info" v-if="currentData">
				<!-- <span>ID: {{ data.id }}</span> -->
				<!-- <span>活动名称{{ data.activityTitle }}</span> -->
				<span class="fs-16">第 {{ current + 1 }}/{{ data.images.length }} 张</span>
				<span class="fs-16">{{ currentImage?.itemTitle }}</span>
				<a-tag class="large-tag" :color="getImageStatusColor">{{ currentImage.auditStatusName
				}}</a-tag>
				<!-- <a-tooltip label="读取二维码">
					<a-button @click="tryReadQRCode">
						<ScissorOutlined />
					</a-button>
				</a-tooltip> -->

			</div>
			<div class="img-viewer-toolbar">
				<a-form-item label="不通过原因">
					<a-select style="width: 220px;" placeholder="不通过原因" :dropdownMatchSelectWidth="false"
						v-model:value="currentImage.scriptId"
						:options="options.map(o => ({ label: o.title, value: o.id }))" />
				</a-form-item>
				<a-form-item v-if="evaluateOptions?.length" label="评价">
					<a-select style="width: 120px;" placeholder="评价" :dropdownMatchSelectWidth="false" allowClear
						v-model:value="currentImage.evaluateId"
						:options="evaluateOptions?.map(o => ({ label: o.title, value: o.id }))" />
					<a-tooltip title="设为默认">
						<a-button style="margin-left: 8px" @click="setDefaultEvaluateId">
							<PushpinOutlined />
						</a-button>
					</a-tooltip>
				</a-form-item>
				<a-form-item label="评价2">
					<a-input style="width: 80px" v-model:value="currentImage.evaluate2">
					</a-input>
					<a-tooltip title="从截图解析">
						<a-button style="margin-left: 8px" @click="parseFromScreenshot" :loading="parsingScreenshot">
							<ScissorOutlined />
						</a-button>
					</a-tooltip>
				</a-form-item>
			</div>
		</div>
	</div>
</template>

<script setup lang="ts">

import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { message } from 'ant-design-vue';
import ScissorOutlined from '@ant-design/icons-vue/ScissorOutlined';
import PushpinOutlined from '@ant-design/icons-vue/PushpinOutlined';
import { useStorage } from '@vueuse/core';
// import { BrowserQRCodeReader } from '@zxing/browser';
import GlobalOutlined from '@ant-design/icons-vue/GlobalOutlined';
import { ReviewItem, ScriptOptions } from '../services';
import { useScribeRuntime } from '../services/scribe-runtime';
import type { ScribeRuntimeCallback, ScribeRuntimeResponse } from '../services/scribe-runtime';
import { useScreenshotRuntime } from '../services/screenshot-runtime';
import type { ScreenshotRuntimeResponse } from '../services/screenshot-runtime';

const props = defineProps<{ modelValue?: boolean, data: ReviewItem, options: ScriptOptions[], evaluateOptions?: ScriptOptions[] }>()
const emit = defineEmits(['update:modelValue', 'enter', 'space', 'up', 'down'])

const current = ref(0)
const visible = ref(props.modelValue ?? true)
const cachedDefaultEvaluateId = useStorage<number | null>('default-evaluate-id', null)
const parsingScreenshot = ref(false)
let componentUnmounted = false
let activeParseSessionId = 0
let activeScreenshotRequestId: number | null = null
let activeScribeRequestId: number | null = null
const scribeRuntime = useScribeRuntime()
const screenshotRuntime = useScreenshotRuntime()

const currentData = computed(() => {
	return props.data
})
const images = computed(() => {
	return props.data.images
})
const currentImage = computed(() => {
	const image = images.value[current.value]
	if (image && cachedDefaultEvaluateId.value && !image.evaluateId) {
		image.evaluateId = String(cachedDefaultEvaluateId.value)
	}
	return image
})
const getImageStatusColor = computed(() => {
	if (!currentImage.value) return 'default'
	if (['未审核', '未通过', '不通过'].includes(currentImage.value.auditStatusName!)) return 'blue'
	if (currentImage.value.auditStatusName === '通过') return 'green'
	return 'blue'
})

watch(() => props.modelValue, value => {
	visible.value = value
	if (value === false) {
		cancelActiveParsing()
	}
})
watch(currentData, () => {
	// 默认尝试从'未审核','待审核'的第一条数据开始
	const list = images.value || []
	if (!list.length) {
		current.value = 0
		return
	}

	const targetStatuses = ['未审核', '待审核']
	const index = list.findIndex((item: any) => targetStatuses.includes(item?.auditStatusName))
	current.value = index >= 0 ? index : 0
}, { immediate: true })

function findNextIndex(direction: 1 | -1, skipApproved: boolean) {
	const list = images.value || []
	if (!list.length) return 0

	if (!skipApproved) {
		if (direction === 1) return (current.value + 1) % list.length
		return (current.value - 1 + list.length) % list.length
	}

	const isApproved = (item: any) => !['未审核', '待审核'].includes(item?.auditStatusName)
	let index = current.value
	for (let i = 0; i < list.length; i++) {
		index = (index + direction + list.length) % list.length
		if (!isApproved(list[index])) return index
	}
	return current.value
}

function close() {
	cancelActiveParsing()
	visible.value = false
	emit('update:modelValue', false)
}

function startParseSession() {
	activeParseSessionId += 1
	return activeParseSessionId
}


function isParseSessionActive(sessionId: number) {
	return sessionId === activeParseSessionId
}

function cancelActiveParsing() {
	const screenshotRequestId = activeScreenshotRequestId
	const scribeRequestId = activeScribeRequestId
	if (screenshotRequestId === null && scribeRequestId === null && !parsingScreenshot.value) return

	activeParseSessionId += 1
	parsingScreenshot.value = false
	activeScreenshotRequestId = null
	activeScribeRequestId = null

	if (screenshotRequestId !== null) {
		screenshotRuntime.cancel(screenshotRequestId)
	}

	if (scribeRequestId !== null) {
		scribeRuntime.cancel(scribeRequestId)
	}
}

function normalizeScreenshotDataUrl(imageData: string) {
	return imageData.startsWith('data:') ? imageData : `data:image/png;base64,${imageData}`
}

function screenshotDataToFile(imageData: string) {
	const dataUrl = normalizeScreenshotDataUrl(imageData)
	const matches = dataUrl.match(/^data:([^,]+),(.*)$/)
	if (!matches) {
		throw new Error('无效的截图数据')
	}

	const metadata = matches[1]
	const payload = matches[2]
	const mimeType = metadata.split(';')[0] || 'image/png'
	const byteString = metadata.includes(';base64') ? atob(payload) : decodeURIComponent(payload)
	const bytes = new Uint8Array(byteString.length)

	for (let index = 0; index < byteString.length; index += 1) {
		bytes[index] = byteString.charCodeAt(index)
	}

	const extension = mimeType.split('/')[1]?.split('+')[0] || 'png'
	return new File([bytes], `screenshot.${extension}`, { type: mimeType })
}

function handleExtractTextResponse(sessionId: number, targetImage: ReviewItem['images'][number] | undefined, response: ScribeRuntimeResponse) {
	if (componentUnmounted || !isParseSessionActive(sessionId)) return
	activeScribeRequestId = null
	parsingScreenshot.value = false
	if (!response.ok) {
		console.error('截图 OCR 失败：', response.error)
		message.error('截图 OCR 失败')
		return
	}

	if (targetImage) {
		targetImage.evaluate2 = typeof response.data === 'string' ? response.data.trim() : ''
	}
}

function handleScreenshotError(error: unknown) {
	activeScreenshotRequestId = null
	activeScribeRequestId = null
	parsingScreenshot.value = false
	console.error('截图 OCR 失败：', error)
	message.error(error instanceof Error ? error.message : '截图 OCR 失败')
}

function handleScreenshotResponse(sessionId: number, response: ScreenshotRuntimeResponse) {
	if (componentUnmounted || !isParseSessionActive(sessionId)) return
	activeScreenshotRequestId = null

	if (!response.ok) {
		handleScreenshotError(response.error)
		return
	}

	try {
		const screenshotFile = screenshotDataToFile(response.data)
		const targetImage = currentImage.value
		const onExtractTextResponse: ScribeRuntimeCallback = runtimeResponse => {
			handleExtractTextResponse(sessionId, targetImage, runtimeResponse)
		}

		activeScribeRequestId = scribeRuntime.extractText({
			images: [screenshotFile],
			langs: ['chi_sim', 'eng'],
		}, onExtractTextResponse)
	} catch (error: unknown) {
		handleScreenshotError(error)
	}
}
function prev(skipApprovedNow = false) {
	if (!images.value || !images.value.length) return
	current.value = findNextIndex(-1, skipApprovedNow)
}

function next(skipApprovedNow = false) {
	if (!images.value || !images.value.length) return
	current.value = findNextIndex(1, skipApprovedNow)
}

function setDefaultEvaluateId() {
	if (currentImage.value && currentImage.value.evaluateId) {
		cachedDefaultEvaluateId.value = Number(currentImage.value.evaluateId)
	}
}

function onKeydown(event: KeyboardEvent) {
	if (!visible.value) return
	if (activeScreenshotRequestId !== null) {
		if (event.key !== 'Escape') return

		event.preventDefault()
		event.stopPropagation()
		cancelActiveParsing()
		return
	}

	if (parsingScreenshot.value) {
		if (event.key !== 'Escape') return

		event.preventDefault()
		event.stopPropagation()
		close()
		return
	}

	if (event.key === ' ' || event.key === 'Enter') {
		event.preventDefault()
		event.stopPropagation()
	}

	switch (event.key) {
		case 'ArrowLeft':
			prev(!Boolean(event.ctrlKey || event.metaKey))
			break
		case 'ArrowRight':
			next(!Boolean(event.ctrlKey || event.metaKey))
			break
		case 'ArrowUp':
			emit('up')
			break
		case 'ArrowDown':
			emit('down')
			break
		case 'd':
			if (!event.ctrlKey) {
				return
			}
			parseFromScreenshot()
			break
		case 'Enter':
			emit('enter', currentImage.value, currentData.value, current.value)
			break
		case ' ':
			emit('space', currentImage.value, currentData.value, current.value)
			break
		case 'Escape':
			close()
			break
	}
}

async function parseFromScreenshot() {
	if (parsingScreenshot.value) return

	const sessionId = startParseSession()
	parsingScreenshot.value = true
	activeScribeRequestId = null
	activeScreenshotRequestId = screenshotRuntime.capture(response => {
		handleScreenshotResponse(sessionId, response)
	})
}

onMounted(() => {
	window.addEventListener('keydown', onKeydown)
})
onUnmounted(() => {
	cancelActiveParsing()
	componentUnmounted = true
	window.removeEventListener('keydown', onKeydown)
})
</script>

<style scoped>
.img-viewer-overlay {
	position: fixed;
	left: 0;
	top: 0;
	right: 0;
	bottom: 0;
	background: rgba(0, 0, 0, 0.8);
	z-index: 10;
	display: flex;
	align-items: center;
	justify-content: center;
}

.img-viewer-content {
	position: relative;
	background: #222;
	padding: 16px;
	gap: 16px;
	border-radius: 8px;
	box-shadow: 0 2px 16px rgba(0, 0, 0, 0.5);
	max-width: 90vw;
	max-height: 90vh;
	display: flex;
	flex-direction: column;
	align-items: center;
}

.img-viewer-tag {
	max-width: 80vw;
	overflow: auto;
	flex-grow: 1;
	border-radius: 4px;
	box-shadow: 0 1px 8px rgba(0, 0, 0, 0.3);
}

.img-viewer-toolbar {
	display: flex;
	align-items: center;
	flex-wrap: wrap;
	gap: 12px;
	color: #fff;
	font-size: 16px;
	flex-shrink: 0;
}

.img-viewer-info {
	color: #eee;
	font-size: 14px;
	display: flex;
	gap: 16px;
	flex-shrink: 0;
	align-items: center;
}

.large-tag {
	font-size: 16px;
	padding: 6px;
}

.fs-16 {
	font-size: 18px;
	font-weight: 600;
}

.w-full {
	width: 100%;
}
</style>