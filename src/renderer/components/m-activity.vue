<template>
  <ActivityReviewList
	:formState="formState"
	:activityList="activityList"
	:tableData="tableData"
	:loading="loading"
	:total="total"
	:scriptOptions="scriptOptions"
	:auditStatuses="auditStatuses"
	:showViewImage="showViewImage"
	:showViewVideo="showViewVideo"
	:currentIndex="currentIndex"
	:startReviewImg="startReviewImg"
	:startReviewVideo="startReviewVideo"
	:handleEnter="handleEnter"
	:handleSpace="handleSpace"
	:handleUp="handleUp"
	:handleDown="handleDown"
	:handlePageChange="handlePageChange"
	:getList="getList"
	:rowClassName="rowClassName"
  >
	<template #extra-filters>
	  <a-input style="width: 200px;" v-model:value="formState.phone" placeholder="手机号"></a-input>
	</template>
  </ActivityReviewList>
</template>

<script setup lang="ts">
function rowClassName(record: ReviewItem) {
	if (record._success === 2) return 'row-success';
	if (record._success === 1) return 'row-fail';
	return '';
}
import { ref, computed, onMounted } from 'vue'
import ActivityReviewList from './ActivityReviewList.vue'
import { message } from 'ant-design-vue'
import { ReviewItem, ActivityItem, ParsedImage, ScriptOptions } from '../services';
import useActivityReview from '../hooks/useActivityReview'
import parseTemplateData from '../services/m-activity-parse'

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
	scriptOptions,
	token,
	auditStatuses,
	getList,
	startReviewImg,
	startReviewVideo,
	showViewImage,
	showViewVideo,
	currentIndex,
	handleEnter: genericHandleEnter,
	handleSpace: genericHandleSpace,
	handleUp,
	handleDown,
	handlePageChange
} = useActivityReview({
	apis,
	parseListHtml: (html: string) => {
		const { token: _token, user, filterOptions, auditData } = parseTemplateData(html)
		const { activities, items, auditStatuses, scriptOptions: _scriptOptions } = filterOptions
		return { tableData: auditData.records, total: auditData.total, activityList: activities, scriptOptions: _scriptOptions, token: _token, auditStatuses }
	}
})

const selectedRowRecord = computed(() => {
	return tableData.value[currentIndex.value] || {}
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