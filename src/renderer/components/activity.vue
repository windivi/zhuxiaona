<template>
	<ActivityReviewList :formState="formState" :activityList="activityList" :tableData="tableData" :loading="loading"
		:total="total" :scriptOptions="scriptOptions" :auditStatuses="auditStatuses" :showViewImage="showViewImage"
		:showViewVideo="showViewVideo" :startReviewImg="startReviewImg" :startReviewVideo="startReviewVideo"
		:handleEnter="handleEnter" :handleSpace="handleSpace" :handleUp="handleUp" :handleDown="handleDown"
		:handlePageChange="handlePageChange" :getList="getList" :rowClassName="rowClassName"
		:selectedRowRecord="selectedRowRecord" @update:showViewImage="showViewImage = $event"
		@update:showViewVideo="showViewVideo = $event" />
</template>

<script setup lang="ts">
import { message } from 'ant-design-vue';
import { onMounted } from 'vue';
import useActivityReview from '../hooks/useActivityReview';
import { ParsedImage, ReviewItem } from '../services';
import * as activityParser from '../services/activity-parse';
import ActivityReviewList from './ActivityReviewList.vue';

const apis = {
	list: 'https://sxzy.chasinggroup.com/admin/marketing/display/audit',
	set: 'https://sxzy.chasinggroup.com/admin/marketing/display/auditset',
}

const {
	formState,
	loading,
	tableData,
	total,
	activityList,
	scriptOptions,
	token,
	auditStatuses,
	selectedRowRecord,
	getList,
	startReviewImg,
	startReviewVideo,
	rowClassName,
	showViewImage,
	showViewVideo,
	handleEnter: genericHandleEnter,
	handleSpace: genericHandleSpace,
	handleUp,
	handleDown,
	handlePageChange
} = useActivityReview({
	cacheKey: 'activity-review-list',
	apis,
	parseListHtml: (html: string) => {
		const { list, total: resTotal } = activityParser.parseReviewListFromHtml(html)
		const tokenValue = activityParser.extractTokenFromLoginHtml(html)
		const activityParse = activityParser.parseActivityListFromHtml(html)
		const auditStatuses = (activityParse as any).filterOptions?.auditStatuses || (activityParse as any).auditStatuses || []
		return { tableData: list, total: resTotal, activityList: activityParse.activities, scriptOptions: activityParse.scriptOptions, token: tokenValue, auditStatuses }
	}
})


async function handleEnter(parsedImage: ParsedImage, record: ReviewItem, index?: any, scriptId?: string) {
	const params = new FormData()
	params.append('token', token.value || '')
	params.append('script_id', scriptId || '')
	params.append('upload_id', record.id)
	params.append('created_by', '贺小娜')
	params.append('audit_status', '2')
	message.loading('审批中')
	try {
		const res = await genericHandleEnter(params)
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

async function handleSpace(parsedImage: ParsedImage, record: ReviewItem) {
	const params = new FormData()
	params.append('token', token.value || '')
	params.append('script_id', '')
	params.append('upload_id', record.id)
	params.append('created_by', '贺小娜')
	params.append('audit_status', '3')
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