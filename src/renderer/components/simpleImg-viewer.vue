<template>
	<div v-if="visible" class="img-viewer-overlay">
		<div class="img-viewer-content">
			<img :src="images?.[current]" class="img-viewer-img" />
			<div class="img-viewer-toolbar">
				<span>{{ current + 1 }} / {{ images?.length }}</span>
			</div>
			<div class="img-viewer-info" v-if="currentData">
				<span>ID: {{ currentData.id }}</span>
				<span>活动: {{ currentData.activityTitle }}</span>
				<span>明细: {{ currentData.itemTitle }}</span>
				<span>UID: {{ currentData.uid }}</span>
			</div>
		</div>
	</div>
</template>

<script setup lang="ts">

import { ref, watch, onMounted, onUnmounted, computed } from 'vue'
import { ReviewItem } from '../services/postmanParser';

const props = defineProps<{ start?: number, modelValue?: boolean, datas: any[] }>()
const emit = defineEmits(['update:modelValue', 'enter', 'space'])

const current = ref(props.start ?? 0)
const visible = ref(props.modelValue ?? true)
const currentData = computed(() => {
	return props.datas[current.value]
})
const images = computed(() => {
	return props.datas.map(item => item.image)
})
watch(() => props.modelValue, v => visible.value = v)
watch(() => props.start, v => {
	if (typeof v === 'number') {
		current.value = v
	}
}, { immediate: true })

function close() {
	visible.value = false
	emit('update:modelValue', false)
}
function prev() {
	if (current.value > 0) {
		current.value -= 1
	}
}
function next() {
	if (current.value < images.value?.length - 1) {
		current.value += 1
	}
}
function onKeydown(e: KeyboardEvent) {
	if (!visible.value) return
	switch (e.key) {
		case 'ArrowLeft':
		case 'ArrowUp':
			prev();
			break;
		case 'ArrowRight':
		case 'ArrowDown':
			next();
			break;
		case 'Enter':
			emit('enter', current.value, currentData.value)
			break;
		case ' ':
			emit('space', current.value, currentData.value)
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
defineExpose(
	{
		next,
		prev
	}
)
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

.img-viewer-img {
	max-width: 80vw;
	max-height: 80vh;
	border-radius: 4px;
	box-shadow: 0 1px 8px rgba(0, 0, 0, 0.3);
}

.img-viewer-toolbar {
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
	flex-wrap: wrap;
}
</style>