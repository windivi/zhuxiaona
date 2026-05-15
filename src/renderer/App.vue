<script setup lang="ts">
import { provide, shallowRef } from 'vue';
import { theme } from 'ant-design-vue';
import Activity from './components/activity.vue'
import MActivity from './components/m-activity.vue';
import MActivityExtra from './components/m-activity-extra.vue';
import ConsolePanel from './components/console-panel.vue'
import ScribeRuntime from './components/scribe-runtime.vue'
import ScreenshotRuntime from './components/screenshot-runtime.vue'
import {
	scribeRuntimeBridgeKey,
	type ScribeRuntimeBridge,
	type ScribeExtractTextPayload,
	type ScribeRuntimeRequest,
	type ScribeRuntimeResponse,
} from './services/scribe-runtime'
import {
	screenshotRuntimeBridgeKey,
	type ScreenshotRuntimeBridge,
	type ScreenshotRuntimeRequest,
	type ScreenshotRuntimeResponse,
} from './services/screenshot-runtime'

const scribeRequest = shallowRef<ScribeRuntimeRequest | null>(null)
const scribeCallbacks = new Map<number, (response: ScribeRuntimeResponse) => void>()
const screenshotRequest = shallowRef<ScreenshotRuntimeRequest | null>(null)
const screenshotCallbacks = new Map<number, (response: ScreenshotRuntimeResponse) => void>()

let nextScribeRequestId = 1
let nextScreenshotRequestId = 1

function handleScribeResponse(response: ScribeRuntimeResponse) {
	const callback = scribeCallbacks.get(response.id)
	if (!callback) return

	scribeCallbacks.delete(response.id)
	callback(response)
}

function handleScreenshotResponse(response: ScreenshotRuntimeResponse) {
	const callback = screenshotCallbacks.get(response.id)
	if (!callback) return

	screenshotCallbacks.delete(response.id)
	callback(response)
}

const extractText: ScribeRuntimeBridge['extractText'] = (
	payload: ScribeExtractTextPayload,
	callback,
) => {
	const requestId = nextScribeRequestId
	nextScribeRequestId += 1

	scribeCallbacks.set(requestId, callback)

	scribeRequest.value = {
		id: requestId,
		type: 'extract-text',
		payload,
	}

	return requestId
}

const cancelScribe: ScribeRuntimeBridge['cancel'] = targetRequestId => {
	const requestId = nextScribeRequestId
	nextScribeRequestId += 1

	if (typeof targetRequestId === 'number') {
		scribeCallbacks.delete(targetRequestId)
	} else {
		scribeCallbacks.clear()
	}

	scribeRequest.value = {
		id: requestId,
		type: 'cancel',
		targetRequestId: targetRequestId,
	}

	return requestId
}

const captureScreenshot: ScreenshotRuntimeBridge['capture'] = callback => {
	const requestId = nextScreenshotRequestId
	nextScreenshotRequestId += 1

	screenshotCallbacks.set(requestId, callback)

	screenshotRequest.value = {
		id: requestId,
		type: 'capture',
	}

	return requestId
}

const cancelScreenshot: ScreenshotRuntimeBridge['cancel'] = targetRequestId => {
	const requestId = nextScreenshotRequestId
	nextScreenshotRequestId += 1

	if (typeof targetRequestId === 'number') {
		screenshotCallbacks.delete(targetRequestId)
	} else {
		screenshotCallbacks.clear()
	}

	screenshotRequest.value = {
		id: requestId,
		type: 'cancel',
		targetRequestId: targetRequestId,
	}

	return requestId
}

provide(scribeRuntimeBridgeKey, {
	extractText,
	cancel: cancelScribe,
})

provide(screenshotRuntimeBridgeKey, {
	capture: captureScreenshot,
	cancel: cancelScreenshot,
})
</script>

<template>
	<a-config-provider :theme="{ algorithm: theme.darkAlgorithm }">
		<a-tabs class="tab">
			<a-tab-pane key="normal" tab="常用转发">
				<Activity />
			</a-tab-pane>
			<a-tab-pane key="month" tab="月度转发">
				<MActivity></MActivity>
			</a-tab-pane>
			<a-tab-pane key="month-2" tab="狗屎月度转发">
				<MActivityExtra></MActivityExtra>
			</a-tab-pane>
			<a-tab-pane key="logs" tab="后端日志">
				<ConsolePanel />
			</a-tab-pane>
		</a-tabs>
		<ScribeRuntime :request="scribeRequest" @response="handleScribeResponse" />
		<ScreenshotRuntime :request="screenshotRequest" @response="handleScreenshotResponse" />
	</a-config-provider>
</template>

<style scoped>
.size-full {
	width: 100%;
	height: 100%;
}

.tab {
	width: 100%;
	min-height: 100vh;
	padding: 0 20px 20px 20px;
}

:deep(.ant-tabs-content-holder) {
	flex: 1;
	height: 100%;
	width: 100%;
	display: flex;


	.ant-tabs-content {
		flex: 1;
		height: 100%;
		width: 100%;
		display: flex;
	}

	.ant-tabs-tabpane {
		flex: 1;
		height: 100%;
		width: 100%;
		display: flex;
	}
}

:deep(.ant-pagination-options) {
	.ant-select {
		min-width: 100px;
	}
}
</style>
