<template>
	<ActivityReviewList :formState="formState" :activityList="activityList" :tableData="tableData" :loading="loading"
		:total="total" :scriptOptions="scriptOptions" :auditStatuses="auditStatuses" :showViewImage="showViewImage"
		:showViewVideo="showViewVideo" :startReviewImg="startReviewImg" :startReviewVideo="startReviewVideo"
		:handleEnter="handleEnter" :handleSpace="handleSpace" :handleUp="handleUp" :handleDown="handleDown"
		:handlePageChange="handlePageChange" :getList="getList" :rowClassName="rowClassName"
		:selectedRowRecord="selectedRowRecord" @update:showViewImage="showViewImage = $event"
		@update:showViewVideo="showViewVideo = $event">
		<template #extra-filters>
			<a-input style="width: 200px;" v-model:value="formState.phone" placeholder="手机号"></a-input>
		</template>
	</ActivityReviewList>
</template>

<script setup lang="ts">

import { message } from 'ant-design-vue';
import { computed, onMounted } from 'vue';
import useActivityReview from '../hooks/useActivityReview';
import { ParsedImage, ReviewItem } from '../services';
import parseTemplateData from '../services/m-activity-parse';
import ActivityReviewList from './ActivityReviewList.vue';

const apis = {
	list: 'https://sxzy.chasinggroup.com/admin/marketing/pxhd/audit',
	set: 'https://sxzy.chasinggroup.com/admin/marketing/pxhd/auditset',
}

const {
	formState,
	loading,
	tableData,
	total,
	activityList,
	token,
	selectedRowRecord,
	scriptOptions,
	auditStatuses,
	getList,
	startReviewImg,
	startReviewVideo,
	showViewImage,
	showViewVideo,
	handleEnter: genericHandleEnter,
	handleSpace: genericHandleSpace,
	rowClassName,
	handleUp,
	handleDown,
	handlePageChange
} = useActivityReview({
	cacheKey: 'm-activity-review-list',
	apis,
	parseListHtml: (html: string) => {
		const { token, user, filterOptions, auditData } = parseTemplateData(html)
		const { activities, items, auditStatuses, scriptOptions } = filterOptions
		return { tableData: auditData.records, total: auditData.total, activityList: activities, scriptOptions, token: token, auditStatuses }
	}
})

async function handleEnter(parsedImage: ParsedImage, record: ReviewItem, imageIndex: number | string) {
	const params = new FormData()
	params.append('_token', token.value || '')
	params.append(`ids[${imageIndex}][script_id]`, parsedImage.scriptId || '0')
	params.append(`ids[${imageIndex}][id]`, parsedImage.uploadId || '')
	params.append(`ids[${imageIndex}][state]`, '2')
	params.append('created_by', '贺小娜')
	message.loading('审批中')
	try {
		const res = await genericHandleEnter(params, 2)
		if (res?.status) {
			message.destroy()
			message.success('审批不通过')
			handleDown()
			record._success = 2
		} else {
			message.destroy()
			message.info('审批不通过失败')
			record._success = 1
		}
	} catch (error) {
		message.destroy()
		message.info('审批不通过失败')
	}
}

async function handleSpace(parsedImage: ParsedImage, record: ReviewItem, imageIndex: number | string) {
	const params = new FormData()
	params.append('_token', token.value || '')
	params.append(`ids[${imageIndex}][script_id]`, '')
	params.append(`ids[${imageIndex}][id]`, parsedImage.uploadId || '')
	params.append(`ids[${imageIndex}][state]`, '1')
	params.append('created_by', '贺小娜')
	message.destroy()
	message.loading('审批中')
	try {
		const res = await genericHandleSpace(params)
		if (res?.status) {
			message.destroy()
			message.success('审批通过')
			handleDown()
			record._success = 2
		} else {
			message.destroy()
			message.info('审批通过失败')
			record._success = 1
		}
	} catch (error) {
		message.destroy()
		message.info('审批通过失败')
	}
}
onMounted(() => {
	getList()
})
</script>


<style scoped>
.layout {
	width: 100%;
	height: 100%;
	justify-self: center;
	display: flex;
	flex-direction: column;
	overflow: hidden;
	gap: 16px;
}

.image {
	min-height: 32px;
	max-height: 32px;
	cursor: pointer;
}

:deep(.row-success) {
	background: #1b7333 !important;
}

:deep(.row-fail) {
	background: #8d332d !important;
}
</style>