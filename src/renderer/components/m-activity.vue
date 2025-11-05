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
				<a-select-option value="1">审核通过</a-select-option>
				<a-select-option value="2">审核未通过</a-select-option>
				<a-select-option value="0">未审核</a-select-option>
			</a-select>
			<a-input style="width: 200px;" v-model:value="formState.phone" placeholder="手机号"></a-input>
			<a-button type="primary" @click="getList">查询</a-button>
		</div>
		<a-table :loading="loading" style="flex: 1; overflow: auto;" :dataSource="tableData" :pagination="false"
			:rowClassName="rowClassName">
			<a-table-column key="id" title="ID" data-index="id" />
			<a-table-column key="activityTitle" title="活动名称" data-index="activityTitle"></a-table-column>
			<a-table-column key="itemTitle" title="明细活动" data-index="itemTitle" />
			<a-table-column key="uid" title="用户UID" data-index="uid" />
			<a-table-column key="phone" title="手机号" data-index="phone" />
			<a-table-column key="uploadTime" title="上传时间" data-index="uploadTime" />
			<a-table-column key="auditor" title="审核人" data-index="auditor" />
			<a-table-column key="auditTime" title="审核时间" data-index="auditTime" />
			<a-table-column key="auditResult" title="审核结果" data-index="auditResult" />
			<a-table-column key="image" title="图片">
				<template #default="{ record, index }">
					<img class="image"
						:src="(record.images && record.images[0]) ? record.images[0].url : (record.image || '')"
						@click="startReview(index)"></img>
				</template>
			</a-table-column>
		</a-table>
		<div style="display:flex; gap: 16px; align-items: center; justify-content: space-between;">
			<span>共 {{ total || 0 }} 条</span>
			<a-pagination :pageSizeOptions="[10, 20, 50, 100, 1000, 2000, 9999]" :current="formState.page"
				show-quick-jumper :pageSize="formState.per_page" :total="total" @change="handlePageChange"
				show-size-changer responsive />
		</div>
		<SimpleImgViewer v-if="showViewImage" ref="viewerRef" v-model="showViewImage" :data="viewImageRecord"
			:options="scriptOptions" @enter="handleEnter" @space="handleSpace" @up="handleUp" @down="handleDown">
		</SimpleImgViewer>
	</div>
</template>

<script setup lang="ts">
function rowClassName(record: ReviewItem) {
	if (record._success === 2) return 'row-success';
	if (record._success === 1) return 'row-fail';
	return '';
}
import { ref, reactive, computed, onMounted, } from 'vue'
import axios from 'axios'
import SimpleImgViewer from './simpleImg-viewer.vue'
import { message } from 'ant-design-vue'
import parseTemplateData from '../services/m-activity-parse';
import { ReviewItem, ActivityItem, ParsedImage, ScriptOptions } from '../services';

const formState = reactive<Record<string, any>>({
	page: 1,
	per_page: 10,
	auditResult: '',
	activityId: '',
})
const showViewImage = ref(false)
const viewImageIndex = ref(0)
const viewImageRecord = computed(() => {
	return tableData.value[viewImageIndex.value] || {}
})
const token = ref<string>()
const scriptOptions = ref<ScriptOptions[]>([])
const activityList = ref<ActivityItem[]>([])
const viewerRef = ref<typeof SimpleImgViewer>()
const tableData = ref<ReviewItem[]>([])
const total = ref<number>(0)
const loading = ref(false)
const apis = {
	list: 'https://sxzy.chasinggroup.com/admin/marketing/pxhd/audit',
	set: 'https://sxzy.chasinggroup.com/admin/marketing/pxhd/auditset',
}
const getList = async () => {
	const searchParam = new URLSearchParams({
		page: formState.page,
		per_page: formState.per_page,
		audit_status: formState.auditResult,
		activity_id: formState.activityId,
		'user[phone]': formState.phone || '',
		_pjax: '#pjax-container'
	})
	loading.value = true
	try {
		const res = await axios.get(apis.list + '?' + searchParam)

		if (res && res.data) {
			const { token: _token, user, filterOptions, auditData } = parseTemplateData(res.data)
			token.value = _token
			const { activities, items, auditStatuses, scriptOptions: _scriptOptions } = filterOptions
			tableData.value = auditData.records
			scriptOptions.value = _scriptOptions
			total.value = auditData.total
			activityList.value = activities.map((item) => ({ ...item, _success: 0 }))
			console.log(tableData.value);
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
	showViewImage.value = true
}

async function handleEnter(parsedImage: ParsedImage, record: ReviewItem, imageIndex: number | string) {
	const params = new FormData()
	params.append('_token', token.value || '')
	params.append(`ids[${imageIndex}][script_id]`, parsedImage.scriptId || '0')
	params.append(`ids[${imageIndex}][id]`, parsedImage.uploadId || '')
	params.append(`ids[${imageIndex}][state]`, '2')
	params.append('created_by', '贺小娜')
	message.loading('审批中')
	try {
		const res = await axios.post(apis.set, params)
		if (res && res.data.status) {
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
		const res = await axios.post(apis.set, params)
		if (res && res.data.status) {
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
	if (viewImageIndex.value) {
		viewImageIndex.value -= 1
	} else {
		message.destroy()
		message.info('不要介样子按辣，它已经到顶了诶')
	}
}
function handleDown() {
	if (viewImageIndex.value < tableData.value.length - 1) {
		viewImageIndex.value += 1
	} else {
		message.destroy()
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