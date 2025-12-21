<template>
	<div v-if="visible" class="img-viewer-overlay">
		<div class="img-viewer-content">
			<img :src="currentImage?.url" class="img-viewer-tag" />
			<div class="img-viewer-info" v-if="currentData">
				<!-- <span>ID: {{ data.id }}</span> -->
				<!-- <span>活动名称{{ data.activityTitle }}</span> -->
				<span class="fs-16">第 {{ current + 1 }}/{{ data.images.length }} 张</span>
				<span class="fs-16">{{ currentImage?.itemTitle }}</span>
				<a-tag class="large-tag" :color="getImageStatusColor">{{ currentImage.auditStatusName
				}}</a-tag>
			</div>
			<div class="img-viewer-toolbar">
				<a-form-item label="不通过原因">
					<a-select style="width: 220px;" placeholder="不通过原因" :dropdownMatchSelectWidth="false"
						v-model:value="currentImage.scriptId"
						:options="options.map(o => ({ label: o.title, value: o.id }))" />
				</a-form-item>
			</div>
		</div>
	</div>
</template>

<script setup lang="ts">

import { ref, watch, onMounted, onUnmounted, computed } from 'vue'
import { ReviewItem, ScriptOptions } from '../services';

const props = defineProps<{ modelValue?: boolean, data: ReviewItem, options: ScriptOptions[] }>()
const emit = defineEmits(['update:modelValue', 'enter', 'space', 'up', 'down'])

const current = ref(0)
const visible = ref(props.modelValue ?? true)
const currentData = computed(() => {
	return props.data
})
const currentImage = computed(() => {
	return images.value[current.value]
})
const getImageStatusColor = computed(() => {
	if (!currentImage.value) return 'default'
	if (['未审核', '未通过', '不通过'].includes(currentImage.value?.auditStatusName!)) return 'blue'
	if (currentImage.value.auditStatusName === '通过') return 'green'
	return 'blue'
})
const images = computed(() => {
	return props.data.images
})
watch(() => props.modelValue, v => visible.value = v)
watch(currentData, (newData) => {
	// 默认尝试从'未审核','待审核'的第一条数据开始
	const list = images.value || []
	if (!list.length) {
		current.value = 0
		return
	}
	
	const targetStatuses = ['未审核', '待审核']
	let idx = list.findIndex((it: any) => targetStatuses.includes(it?.auditStatusName))
	current.value = idx >= 0 ? idx : 0
}, { immediate: true })

function findNextIndex(direction: 1 | -1, skipApproved: boolean) {
	const list = images.value || []
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
function close() {
	visible.value = false
	emit('update:modelValue', false)
}
function prev(skipApprovedNow = false) {
	if (!images.value || !images.value.length) return
	current.value = findNextIndex(-1, skipApprovedNow)
}
function next(skipApprovedNow = false) {
	if (!images.value || !images.value.length) return
	current.value = findNextIndex(1, skipApprovedNow)
}

function onKeydown(e: KeyboardEvent) {
	if (!visible.value) return

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
			emit('enter', currentImage.value, currentData.value, current.value, currentImage.value.scriptId)
			break;
		case ' ':
			emit('space', currentImage.value, currentData.value, current.value)
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
	max-height: 80vh;
	border-radius: 4px;
	box-shadow: 0 1px 8px rgba(0, 0, 0, 0.3);
}

.img-viewer-toolbar {
	display: flex;
	align-items: center;
	gap: 12px;
	margin-top: 8px;
	color: #fff;
	font-size: 16px;
}

.img-viewer-info {
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