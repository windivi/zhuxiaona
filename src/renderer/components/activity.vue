<template>
	<div class="layout">
		<div style="display:flex;gap:16px;">

			<a-select v-model:value="formState.activityId" @change="getList" placeholder="筛选活动" style="width:180px;">
				<a-select-option value="">全部活动</a-select-option>
				<a-select-option v-for="act in activityList" :key="act.id" :value="act.id">{{ act.title
					}}</a-select-option>
			</a-select>
			<a-select style="width: 120px" v-model:value="formState.auditResult" @change="getList" placeholder="筛选审核结果">
				<a-select-option value="">全部</a-select-option>
				<a-select-option value="3">审核通过</a-select-option>
				<a-select-option value="2">审核未通过</a-select-option>
				<a-select-option value="1">未审核</a-select-option>
			</a-select>
			<a-button type="primary" @click="getList">查询</a-button>
			<a-input style="width: 200px;align-self: flex-end;" placeholder="默认不通过原因ID" v-model="scriptId"></a-input>
		</div>
		<a-table :loading="loading" style="flex: 1; overflow: auto;" :dataSource="tableData" :pagination="false"
			:rowClassName="rowClassName">
			<a-table-column key="id" title="ID" data-index="id" />
			<a-table-column key="activityTitle" title="活动名称" data-index="activityTitle"></a-table-column>
			<a-table-column key="itemTitle" title="明细活动" data-index="itemTitle" />
			<a-table-column key="platformName" title="平台名称" data-index="platformName" />
			<a-table-column key="groupName" title="群组名称" data-index="groupName" />
			<a-table-column key="nickname" title="昵称" data-index="nickname" />
			<a-table-column key="uid" title="用户UID" data-index="uid" />
			<a-table-column key="phone" title="手机号" data-index="phone" />
			<a-table-column key="uploadTime" title="上传时间" data-index="uploadTime" />
			<a-table-column key="votes" title="投票数量" data-index="votes" />
			<a-table-column key="auditor" title="审核人" data-index="auditor" />
			<a-table-column key="auditTime" title="审核时间" data-index="auditTime" />
			<a-table-column key="auditResult" title="审核结果" data-index="auditResult" />
			<a-table-column key="image" title="图片">
				<template #default="{ record, index }">
					<img class="image" :src="record.image" @click="startReview(index)"></img>
				</template>
			</a-table-column>
		</a-table>
		<div style="display:flex; gap: 16px; align-items: center; justify-content: space-between;">
			<span>共 {{ total || 0 }} 条</span>
			<a-pagination :pageSizeOptions="[10, 20, 50, 100, 1000, 2000, 9999]" :current="formState.page"
				:pageSize="formState.per_page" :total="total" @change="handlePageChange" show-size-changer
				show-quick-jumper responsive />
		</div>
		<SimpleImgViewer v-if="showViewImage" ref="viewerRef" :start="viewImageIndex" v-model="showViewImage"
			:datas="viewImageRecords" @enter="handleEnter" @space="handleSpace"></SimpleImgViewer>
	</div>
</template>

<script setup lang="ts">
function rowClassName(record: ReviewItem) {
	if (record._success === 2) return 'row-success';
	if (record._success === 1) return 'row-fail';
	return '';
}
import { ref, reactive, } from 'vue'
import parseReviewListFromHtml, { ActivityItem, parseActivityListFromHtml, ReviewItem } from '../services/postmanParser'
import axios from 'axios'
import SimpleImgViewer from './simpleImg-viewer.vue'
import { message } from 'ant-design-vue'

const formState = reactive<Record<string, any>>({
	page: 1,
	per_page: 10,
	auditResult: '',
	activityId: '',
})
const scriptId = ref(undefined)
const showViewImage = ref(false)
const viewImageIndex = ref(0)
const viewImageRecords = ref<ReviewItem[]>([])
const activityList = ref<ActivityItem[]>()
const viewerRef = ref<typeof SimpleImgViewer>()
const tableData = ref<ReviewItem[]>([])
const total = ref()
const loading = ref(false)
const apis = {
	list: 'https://sxzy.chasinggroup.com/admin/marketing/display/audit',
	set: 'https://sxzy.chasinggroup.com/admin/marketing/display/auditset',
}
const getList = async () => {
	const searchParam = new URLSearchParams({
		page: formState.page,
		per_page: formState.per_page,
		audit_status: formState.auditResult,
		activity_id: formState.activityId,
		_pjax: '#pjax-container'
	})
	loading.value = true
	try {
		const res = await axios.get(apis.list + '?' + searchParam)


		if (res && res.data) {
			const { list, total: resTotal } = parseReviewListFromHtml(res.data)
			tableData.value = list
			total.value = resTotal
			const { activities, details, platforms } = parseActivityListFromHtml(res.data)
			activityList.value = activities.map((item) => ({ ...item, _success: 0 }))
		} else {
			tableData.value = []
			activityList.value = []
		}

	} catch (err) {
		console.error('请求失败', err)
		tableData.value = []
	} finally {
		loading.value = false
	}
}

const startReview = (index: number = 0) => {
	viewImageIndex.value = index
	showImgs(tableData.value)
}

function showImgs(records: ReviewItem[]) {
	viewImageRecords.value = records
	showViewImage.value = true
}

async function handleEnter(imgUrl: string, record: ReviewItem) {
	const params = new FormData()
	params.append('script_id', scriptId.value || '')
	params.append('upload_id', record.id)
	params.append('created_by', '贺小娜')
	params.append('audit_status', '2')
	message.loading('审批中')
	try {
		const res = await axios.post(apis.set, params)
		if (res && res.data.status) {
			message.destroy()
			message.success('审批不通过')
			viewerRef.value?.next()
			record._success = 2
		} else {
			message.destroy()
			message.info('审批不通过失败')
			record._success = 1
		}
	} catch (error) {
		message.destroy()
		message.info('审批不通过失败')
	} finally {
	}
}
async function handleSpace(imgUrl: string, record: ReviewItem) {
	const params = new FormData()
	params.append('upload_id', record.id)
	params.append('created_by', '贺小娜')
	params.append('audit_status', '3')
	message.loading('审批中')
	try {
		const res = await axios.post(apis.set, params)
		if (res && res.data.status) {
			message.destroy()
			message.success('审批通过')
			viewerRef.value?.next()
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
function handlePageChange(page: number, size: number) {
	formState.page = page
	formState.per_page = size
	getList()
}
function handleArrow(direction: 'up' | 'down' | 'left' | 'right') {
	// 这里写方向键逻辑
	switch (direction) {
		case 'up':
		case 'left':
			break;
		case 'down':
		case 'right':
			break;
	}
}

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
	background: #e6ffed !important;
}

:deep(.row-fail) {
	background: #fff1f0 !important;
}
</style>