<template>
	<div class="scribe-runtime" aria-hidden="true"></div>
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, watch } from 'vue'
import type {
	ScribeExtractTextRequest,
	ScribeInput,
	ScribeRuntimeRequest,
	ScribeRuntimeResponse,
} from '../services/scribe-runtime'

type ScribeInitOptions = {
	pdf?: boolean;
	ocr?: boolean;
	font?: boolean;
	ocrParams?: Record<string, unknown>;
}

type ScribeApi = {
	init(options?: ScribeInitOptions): Promise<void>;
	terminate(): Promise<void>;
	extractText(images: ScribeInput[] | FileList, langs?: string[], outputFormat?: string, options?: Record<string, unknown>): Promise<string | ArrayBuffer>;
}

const props = defineProps<{
	request: ScribeRuntimeRequest | null;
}>()

const emit = defineEmits<{
	response: [response: ScribeRuntimeResponse];
}>()

const SCRIBE_INIT_OPTIONS: ScribeInitOptions = {
	ocr: true,
	font: true,
	ocrParams: {
		lang: ['chi_sim', 'eng'],
		config: {
			user_defined_dpi: '300',
		},
	},
}

let lastHandledRequestId = 0
let scribeModulePromise: Promise<ScribeApi> | null = null
let scribeReadyPromise: Promise<ScribeApi> | null = null
let requestQueue: Promise<void> = Promise.resolve()
let activeRequestId: number | null = null
let runtimeRevision = 0

const canceledRequestIds = new Set<number>()

function getScribeModuleUrl() {
	return new URL('vendor/scribe.js-ocr/scribe.js', window.location.href).toString()
}

function queueTask(task: () => Promise<void>) {
	const queuedTask = requestQueue.then(task, task)
	requestQueue = queuedTask.then(() => undefined, () => undefined)
	return queuedTask
}

function consumeCanceledRequest(requestId: number) {
	if (!canceledRequestIds.has(requestId)) return false

	canceledRequestIds.delete(requestId)
	return true
}

async function loadScribeModule() {
	if (!scribeModulePromise) {
		const moduleUrl = getScribeModuleUrl()
		scribeModulePromise = import(/* @vite-ignore */ moduleUrl)
			.then(module => module.default as ScribeApi)
			.catch(error => {
				scribeModulePromise = null
				throw error
			})
	}

	return scribeModulePromise
}

async function ensureScribeReady() {
	if (!scribeReadyPromise) {
		scribeReadyPromise = loadScribeModule()
			.then(async scribe => {
				await scribe.init(SCRIBE_INIT_OPTIONS)
				return scribe
			})
			.catch(error => {
				scribeReadyPromise = null
				throw error
			})
	}

	return scribeReadyPromise
}

function emitSuccessResponse(request: ScribeExtractTextRequest, data: string | ArrayBuffer) {
	emit('response', {
		id: request.id,
		type: request.type,
		ok: true,
		data,
	})
}

function emitErrorResponse(request: ScribeExtractTextRequest, error: unknown) {
	emit('response', {
		id: request.id,
		type: request.type,
		ok: false,
		error: error,
	})
}

async function processExtractTextRequest(request: ScribeExtractTextRequest, requestRevision: number) {
	activeRequestId = request.id
	if (consumeCanceledRequest(request.id)) return

	const scribe = await ensureScribeReady()
	if (consumeCanceledRequest(request.id) || requestRevision !== runtimeRevision || activeRequestId !== request.id) {
		return
	}

	const result = await scribe.extractText(
		request.payload.images,
		request.payload.langs,
		request.payload.outputFormat,
		request.payload.options,
	)
	if (consumeCanceledRequest(request.id) || requestRevision !== runtimeRevision || activeRequestId !== request.id) {
		return
	}

	emitSuccessResponse(request, result)
}

async function processRequest(request: ScribeExtractTextRequest) {
	const requestRevision = runtimeRevision
	try {
		await processExtractTextRequest(request, requestRevision)
	} catch (error) {
		if (consumeCanceledRequest(request.id) || requestRevision !== runtimeRevision || activeRequestId !== request.id) {
			return
		}

		emitErrorResponse(request, error)
	} finally {
		if (activeRequestId === request.id) {
			activeRequestId = null
		}
	}
}

async function cancelActiveRequest(targetRequestId?: number) {
	if (typeof targetRequestId === 'number') {
		canceledRequestIds.add(targetRequestId)
	} else if (activeRequestId !== null) {
		canceledRequestIds.add(activeRequestId)
	}

	if (activeRequestId === null) return
	if (typeof targetRequestId === 'number' && activeRequestId !== targetRequestId) return

	runtimeRevision += 1
	activeRequestId = null
	await terminateScribe()
}

async function terminateScribe() {
	scribeReadyPromise = null
	const scribe = scribeModulePromise ? await scribeModulePromise.catch(() => null) : null
	scribeModulePromise = null

	if (!scribe) return

	try {
		await scribe.terminate()
	} catch (error) {
		console.error('释放 Scribe 失败：', error)
	}
}

watch(() => props.request?.id, () => {
	const request = props.request
	if (!request || request.id <= lastHandledRequestId) return

	lastHandledRequestId = request.id
	if (request.type === 'cancel') {
		void cancelActiveRequest(request.targetRequestId)
		return
	}

	void queueTask(() => processRequest(request))
})

onMounted(() => {
	void queueTask(async () => {
		try {
			await ensureScribeReady()
		} catch (error) {
			console.error('初始化 Scribe 失败：', error)
		}
	})
})

onBeforeUnmount(() => {
	void terminateScribe()
})
</script>

<style scoped>
.scribe-runtime {
	display: none;
}
</style>