<template>
	<div v-if="visible" class="media-viewer-overlay">
		<div class="media-viewer-content">
			<EzPlayer :src="currentMedia?.url" class="media-viewer-media" />
			<div class="media-viewer-info" v-if="currentData">
				<!-- <span>ID: {{ data.id }}</span> -->
				<!-- <span>活动名称{{ data.activityTitle }}</span> -->
				<span class="fs-16">第 {{ current + 1 }}/{{ data.medias.length }} 张</span>
				<span class="fs-16">{{ currentMedia?.itemTitle || currentMedia?.uploadId }}</span>
				<a-tag class="large-tag" :color="getMediaStatusColor">{{ currentMedia.auditStatusName }}</a-tag>
			</div>
			<div class="media-viewer-toolbar">
				<a-form-item label="不通过原因">
					<a-select style="width: 220px;" placeholder="不通过原因" :dropdownMatchSelectWidth="false"
						v-model:value="currentMedia.scriptId"
						:options="options.map(o => ({ label: o.title, value: o.id }))" />
				</a-form-item>
			</div>
		</div>
	</div>
</template>

<script setup lang="ts">

import { ref, watch, onMounted, onUnmounted, computed } from 'vue'
import { ReviewItem, ScriptOptions } from '../services';
import EzPlayer from './video/index.vue'
const props = defineProps<{ modelValue?: boolean, data: ReviewItem, options: ScriptOptions[] }>()
const emit = defineEmits(['update:modelValue', 'enter', 'space', 'up', 'down'])

const current = ref(0)
const visible = ref(props.modelValue ?? true)
const currentData = computed(() => {
	return props.data
})
const currentMedia = computed(() => {
	return medias.value[current.value]
})
const getMediaStatusColor = computed(() => {
	if (!currentMedia.value) return 'default'
	if (['未审核', '未通过', '不通过'].includes(currentMedia.value?.auditStatusName!)) return 'blue'
	if (currentMedia.value.auditStatusName === '通过') return 'green'
	return 'blue'
})
const medias = computed(() => {
	// 支持两种数据结构：旧的 item.video (string) 或新的 item.medias: ParsedVideo[]
	return props.data.medias
})
watch(() => props.modelValue, v => visible.value = v)
watch(currentData, (newData) => {
	// 默认尝试从'未审核','待审核'的第一条数据开始
	const list = medias.value || []
	if (!list.length) {
		current.value = 0
		return
	}
	
	const targetStatuses = ['未审核', '待审核']
	let idx = list.findIndex((it: any) => targetStatuses.includes(it?.auditStatusName))
	current.value = idx >= 0 ? idx : 0
}, { immediate: true })
function close() {
	visible.value = false
	emit('update:modelValue', false)
}
function prev(skipApprovedNow = false) {
	if (!medias.value || !medias.value.length) return
	current.value = findNextIndex(-1, skipApprovedNow)
}
function next(skipApprovedNow = false) {
	if (!medias.value || !medias.value.length) return
	current.value = findNextIndex(1, skipApprovedNow)
}
function findNextIndex(direction: 1 | -1, skipApproved: boolean) {
	const list = medias.value || []
	if (!list.length) return 0

	if (!skipApproved) {
		if (direction === 1) return (current.value + 1) % list.length
		return (current.value - 1 + list.length) % list.length
	}

	const isApproved = (it: any) => !['未审核', '待审核'].includes(it?.auditStatusName)
	let idx = current.value
	for (let i = 0; i < list.length; i++) {
		idx = (idx + direction + list.length) % list.length
		if (!isApproved(list[idx])) return idx
	}
	return current.value
}
function onKeydown(e: KeyboardEvent) {
	if (!visible.value) return

	// 阻止空格和回车键的默认行为，防止触发页面上的按钮点击
	if (e.key === ' ' || e.key === 'Enter') {
		e.preventDefault()
		e.stopPropagation()
	}

	switch (e.key) {
		case 'ArrowLeft':
			prev(!Boolean(e.ctrlKey || e.metaKey))
			break;
		case 'ArrowRight':
			next(!Boolean(e.ctrlKey || e.metaKey))
			break;
		case 'ArrowUp':
			emit('up')
			break;
		case 'ArrowDown':
			emit('down')
			break;
		case 'Enter':
			emit('enter', currentMedia.value, currentData.value, current.value, currentMedia.value.scriptId)
			break;
		case ' ':
			emit('space', currentMedia.value, currentData.value, current.value)
			break;
		case 'Escape':
			close();
			break;
	}
}


onMounted(() => {
	window.addEventListener('keydown', onKeydown)
})
onUnmounted(() => {
	window.removeEventListener('keydown', onKeydown)
})
</script>

<style scoped>
.media-viewer-overlay {
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

.media-viewer-content {
	position: relative;
	background: #222;
	padding: 16px;
	border-radius: 8px;
	box-shadow: 0 2px 16px rgba(0, 0, 0, 0.5);
	max-width: 90vw;
	max-height: 90vh;
	display: flex;
	flex-direction: column;
	align-items: center;
}

.media-viewer-media {
	max-width: 80vw;
	max-height: 70vh;
	border-radius: 4px;
	box-shadow: 0 1px 8px rgba(0, 0, 0, 0.3);
	width: 100%;
	height: 100%;
}

.media-viewer-toolbar {
	display: flex;
	align-items: center;
	gap: 12px;
	margin-top: 8px;
	color: #fff;
	font-size: 16px;
}

.media-viewer-info {
	margin-top: 12px;
	color: #eee;
	font-size: 14px;
	display: flex;
	gap: 16px;
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
</style>