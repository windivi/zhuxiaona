import { ref } from 'vue'
import httpClient from '../services/http-client'

export type ParseResult = {
  tableData: any[]
  total?: number
  activityList?: any[]
  scriptOptions?: any[]
  auditStatuses?: any[]
  token?: string
}

export type UseActivityReviewOptions = {
  storageKey?: string
  apis: {
    list: string
    set: string
  }
  parseListHtml: (html: string) => ParseResult
}

export function useActivityReview(options: UseActivityReviewOptions) {
  const formState = ref({ page: 1, per_page: 10, auditResult: '', activityId: '', phone: '' })
  const loading = ref(false)
  const tableData = ref<any[]>([])
  const total = ref<number>(0)
  const activityList = ref<any[]>([])
  const scriptOptions = ref<any[]>([])
  const token = ref<string>('')
  const auditStatuses = ref<any[]>([])

  async function getList() {
    const params = new URLSearchParams({
      page: String((formState.value as any).page),
      per_page: String((formState.value as any).per_page),
      audit_status: (formState.value as any).auditResult || '',
      activity_id: (formState.value as any).activityId || '',
      _pjax: '#pjax-container'
    })

    loading.value = true
    try {
      const res = await httpClient.get(options.apis.list + '?' + params.toString())
      if (res) {
        const parsed = options.parseListHtml(res)
        tableData.value = parsed.tableData || []
        total.value = parsed.total || 0
        activityList.value = (parsed.activityList || (parsed as any).activities || []).map((i: any) => ({ ...i, _success: 0 }))
        scriptOptions.value = parsed.scriptOptions || []
        token.value = parsed.token || ''
        // 如果解析器提供了 auditStatuses（筛选项），一并暴露
        if ((parsed as any).auditStatuses) {
          auditStatuses.value = (parsed as any).auditStatuses
        } else if ((parsed as any).filterOptions && (parsed as any).filterOptions.auditStatuses) {
          // 有些解析器将筛选项放在 filterOptions 下
          auditStatuses.value = (parsed as any).filterOptions.auditStatuses
        } else {
          auditStatuses.value = []
        }
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

  function startReviewImg(index = 0) {
    currentIndex.value = index
    showViewImage.value = true
  }

  function startReviewVideo(index = 0) {
    currentIndex.value = index
    showViewVideo.value = true
  }

  const showViewImage = ref(false)
  const showViewVideo = ref(false)
  const currentIndex = ref(0)

  function handleUp() {
    if (currentIndex.value) currentIndex.value -= 1
  }

  function handleDown() {
    if (currentIndex.value < tableData.value.length - 1) currentIndex.value += 1
  }

  async function handleEnter(formData: FormData, successValue: number, failValue = 1) {
    try {
      const res = await httpClient.post(options.apis.set, formData)
      return res
    } catch (err) {
      throw err
    }
  }

  async function handleSpace(formData: FormData) {
    return handleEnter(formData, 3, 1)
  }

  function handlePageChange(page: number, size: number) {
    ;(formState.value as any).page = page
    ;(formState.value as any).per_page = size
    getList()
  }

  return {
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
    handleEnter,
    handleSpace,
    handleUp,
    handleDown,
    handlePageChange
  }
}

export default useActivityReview
