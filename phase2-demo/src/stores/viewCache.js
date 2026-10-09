import { reactive } from 'vue'

// 页面切换时保留当前浏览上下文；这是内存缓存，刷新浏览器后会自然恢复初始状态。
export const knowledgeViewCache = reactive({
  selectedDocId: null,
  selectedDevice: '主机',
  selectedSystem: '全部系统',
  selectedDocType: '全部类型',
  searchQuery: '',
  currentPage: 1
})

export const inspectionViewCache = reactive({
  selectedReportId: null,
  dateRange: [],
  currentPage: 1
})
