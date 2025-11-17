<template>
  <div class="layout">
    <div style="display:flex;gap:16px;">
      <slot name="extra-filters"></slot>

      <a-select v-model:value="formState.activityId" @change="getList" placeholder="筛选活动">
        <a-select-option value="">全部活动</a-select-option>
        <a-select-option v-for="act in activityList" :key="act.id" :value="act.id">{{ act.title }}</a-select-option>
      </a-select>
      <a-select style="width: 160px" v-model:value="formState.auditResult" @change="getList" placeholder="筛选审核结果">
        <a-select-option value="">全部</a-select-option>
        <template v-if="(props as any).auditStatuses && (props as any).auditStatuses.length">
          <a-select-option v-for="s in (props as any).auditStatuses" :key="s.value" :value="String(s.value)">{{ s.label }}</a-select-option>
        </template>
        <template v-else>
          <a-select-option value="3">审核通过</a-select-option>
          <a-select-option value="2">审核未通过</a-select-option>
          <a-select-option value="1">未审核</a-select-option>
        </template>
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
        :pageSize="pageSize" :total="total" @change="handlePageChange" show-size-changer
        show-quick-jumper responsive />
    </div>

    <SimpleImgViewer v-if="showViewImage" ref="viewerRef" v-model="showViewImage" :data="selectedRowRecord"
      :options="(scriptOptions || [])" @enter="onEnter" @space="onSpace" @up="handleUp" @down="handleDown" />
    <SimpleVideoViewer v-if="showViewVideo" ref="playerRef" v-model="showViewVideo" :data="selectedRowRecord"
      :options="(scriptOptions || [])" @enter="onEnter" @space="onSpace" @up="handleUp" @down="handleDown" />

  </div>
</template>

<script setup lang="ts">
import { computed, toRefs, PropType } from 'vue'
import SimpleImgViewer from './simple-img-viewer.vue'
import SimpleVideoViewer from './simple-video-viewer.vue'

type Row = any

const props = defineProps({
  formState: { type: Object as PropType<Record<string, any>>, required: true },
  activityList: { type: Array as PropType<any[]>, required: true },
  tableData: { type: Array as PropType<any[]>, required: true },
  loading: { type: Boolean, required: true },
  total: { type: [Number] as PropType<number>, required: true },
  scriptOptions: { type: Array as PropType<any[]>, required: false },
  auditStatuses: { type: Array as PropType<any[]>, required: false },
  showViewImage: { type: Boolean, required: true },
  showViewVideo: { type: Boolean, required: true },
  currentIndex: { type: Number, required: true },
  startReviewImg: { type: Function as PropType<(...args: any[]) => any>, required: true },
  startReviewVideo: { type: Function as PropType<(...args: any[]) => any>, required: true },
  handleEnter: { type: Function as PropType<(parsed: any, record: Row, ...args: any[]) => any>, required: true },
  handleSpace: { type: Function as PropType<(parsed: any, record: Row, ...args: any[]) => any>, required: true },
  handleUp: { type: Function as PropType<() => void>, required: true },
  handleDown: { type: Function as PropType<() => void>, required: true },
  handlePageChange: { type: Function as PropType<(page: number, pageSize: number) => void>, required: true },
  getList: { type: Function as PropType<(...args: any[]) => any>, required: true },
  rowClassName: { type: Function as PropType<(record: Row) => string>, required: false }
} as const)

const { formState, activityList, tableData, loading, total, scriptOptions, showViewImage, showViewVideo, currentIndex } = toRefs(props)

const selectedRowRecord = computed(() => tableData.value?.[currentIndex.value] || {})
// pageSize computed and cast to `number` to satisfy template prop typing
const _pageSizeComputed = computed(() => Number((props as any).formState?.per_page || 0))
const pageSize = (_pageSizeComputed as unknown) as number

function onEnter(parsed: any, record: any) {
  props.handleEnter(parsed, record)
}

function onSpace(parsed: any, record: any) {
  props.handleSpace(parsed, record)
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
  background: #1b7333 !important;
}

:deep(.row-fail) {
  background: #8d332d !important;
}
</style>
