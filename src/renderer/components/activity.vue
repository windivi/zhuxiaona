<template>
	<div class="layout">
		<div style="display:flex;gap:16px;">

			<a-select v-model:value="formState.activityId" @change="getList" placeholder="筛选活动">
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
			<a-table-column key="action" title="操作列">
				<template #default="{ record, index }">
					<a-button v-if="record.images?.length" type="link" @click="startReviewImg(index)">图片</a-button>
					<a-button v-if="record.medias?.length" type="link" @click="startReviewVideo(index)">视频</a-button>
				</template>
			</a-table-column>
		</a-table>
		<div style="display:flex; gap: 16px; align-items: center; justify-content: space-between;">
			<span>共 {{ total || 0 }} 条</span>
			<a-pagination :pageSizeOptions="[10, 20, 50, 100, 1000, 2000, 9999]" :current="formState.page"
				:pageSize="formState.per_page" :total="total" @change="handlePageChange" show-size-changer
				show-quick-jumper responsive />
		</div>
		<SimpleImgViewer v-if="showViewImage" ref="viewerRef" v-model="showViewImage" :data="selectedRowRecord"
			:options="scriptOptions" @enter="handleEnter" @space="handleSpace" @up="handleUp" @down="handleDown" />
		<SimpleVideoViewer v-if="showViewVideo" ref="playerRef" v-model="showViewVideo" :data="selectedRowRecord"
			:options="scriptOptions" @enter="handleEnter" @space="handleSpace" @up="handleUp" @down="handleDown" />
	</div>
</template>

<script setup lang="ts">
function rowClassName(record: ReviewItem) {
	if (record._success === 2) return 'row-success';
	if (record._success === 1) return 'row-fail';
	return '';
}
import { ref, reactive, computed, onMounted, } from 'vue'
import { extractTokenFromLoginHtml, parseActivityListFromHtml, parseReviewListFromHtml } from '../services/activity-parse'
import SimpleImgViewer from './simple-img-viewer.vue'
import SimpleVideoViewer from './simple-video-viewer.vue'
import { message } from 'ant-design-vue'
import { ActivityItem, ParsedImage, ReviewItem, ScriptOptions } from '../services';
import { useAuthenticatedRequest } from '../hooks/useAuthenticatedRequest';
const { get, post } = useAuthenticatedRequest()
const formState = reactive<Record<string, any>>({
	page: 1,
	per_page: 10,
	auditResult: '',
	activityId: '',
})
const playerRef = ref<any>()
const showViewVideo = ref(false)
const showViewImage = ref(false)
const scriptOptions = ref<ScriptOptions[]>([])
const selectedRowIndex = ref(0)
const selectedRowRecord = computed(() => {
	return tableData.value[selectedRowIndex.value] || {}
})
const token = ref<string>()
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
		const res = await get(apis.list + '?' + searchParam)


		if (res) {
			const { list, total: resTotal } = parseReviewListFromHtml(res)
			token.value = extractTokenFromLoginHtml(res)
			tableData.value = list
			total.value = resTotal
			const { activities, details, platforms, scriptOptions: _scriptOptions } = parseActivityListFromHtml(res)
			scriptOptions.value = _scriptOptions
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

const startReviewImg = (index: number = 0) => {
	selectedRowIndex.value = index
	showViewImage.value = true
}

const startReviewVideo = (index: number = 0) => {
	selectedRowIndex.value = index
	showViewVideo.value = true
}

async function handleEnter(parsedImage: ParsedImage, record: ReviewItem, scriptId: string) {
	const params = new FormData()
	params.append('token', token.value || '')
	params.append('script_id', scriptId || '')
	params.append('upload_id', record.id)
	params.append('created_by', '贺小娜')
	params.append('audit_status', '2')
	message.loading('审批中')
	try {
		const res = await post(apis.set, params)
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
	} finally {
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
		const res = await post(apis.set, params)
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
function handlePageChange(page: number, size: number) {
	formState.page = page
	formState.per_page = size
	getList()
}
function handleUp() {
	if (selectedRowIndex.value) {
		selectedRowIndex.value -= 1
	} else {
		message.info('不要介样子按辣，它已经到顶了诶')
	}
}
function handleDown() {
	if (selectedRowIndex.value < tableData.value.length - 1) {
		selectedRowIndex.value += 1
	} else {
		message.info('不要介样子按辣，它已经到底了诶')
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