<template>
  <div class="knowledge-view">
    <div class="knowledge-header">
      <h2 class="page-title">知识库</h2>
      <div class="search-box">
        <Icon icon="mdi:magnify" />
        <input
          v-model="searchText"
          type="text"
          placeholder="搜索知识库..."
        />
      </div>
    </div>

    <div class="category-tabs">
      <button
        v-for="cat in categories"
        :key="cat.value"
        class="category-tab"
        :class="{ active: selectedCategory === cat.value }"
        @click="selectedCategory = cat.value"
      >{{ cat.label }}</button>
    </div>

    <div class="knowledge-list">
      <div
        v-for="item in filteredItems"
        :key="item.id"
        class="knowledge-item"
      >
        <div class="item-header">
          <h3 class="item-title">{{ item.title }}</h3>
          <span class="item-category" :class="item.category">{{ item.categoryLabel }}</span>
        </div>
        <div class="item-meta">
          <span class="item-time">{{ item.updateTime }}</span>
          <span v-if="item.extra" class="item-extra">{{ item.extra }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { Icon } from '@iconify/vue'

const searchText = ref('')
const selectedCategory = ref('all')

const categories = [
  { label: '全部', value: 'all' },
  { label: '故障案例', value: '故障案例' },
  { label: '维修手册', value: '维修手册' },
  { label: '操作规范', value: '操作规范' },
  { label: '安全须知', value: '安全须知' },
  { label: '设备参数', value: '设备参数' }
]

const knowledgeItems = [
  {
    id: 1,
    title: '主机冷却水温异常排查 SOP',
    category: '操作规范',
    categoryLabel: '操作规范',
    updateTime: '2026-06-20',
    extra: '12 步'
  },
  {
    id: 2,
    title: '2026-05 主机冷却水系统堵塞案例',
    category: '故障案例',
    categoryLabel: '故障案例',
    updateTime: '2026-05-15',
    extra: '匹配事件1'
  },
  {
    id: 3,
    title: '辅机油压系统维护手册',
    category: '维修手册',
    categoryLabel: '维修手册',
    updateTime: '2026-06-01',
    extra: 'MAN B&W V3.2'
  },
  {
    id: 4,
    title: '舵机液压油温度过高处理流程',
    category: '操作规范',
    categoryLabel: '操作规范',
    updateTime: '2026-06-10',
    extra: '8 步'
  },
  {
    id: 5,
    title: '空压机排气压力波动分析',
    category: '故障案例',
    categoryLabel: '故障案例',
    updateTime: '2026-03-20',
    extra: '2026-03 已解决'
  },
  {
    id: 6,
    title: '机舱作业安全须知（2026版）',
    category: '安全须知',
    categoryLabel: '安全须知',
    updateTime: '2026-01-05',
    extra: '强制阅读'
  },
  {
    id: 7,
    title: '冷却水泵定期保养操作指南',
    category: '操作规范',
    categoryLabel: '操作规范',
    updateTime: '2026-06-15',
    extra: '每500小时'
  },
  {
    id: 8,
    title: '锅炉水位传感器校准规程',
    category: '设备参数',
    categoryLabel: '设备参数',
    updateTime: '2026-04-01',
    extra: '季度校准'
  }
]

const filteredItems = computed(() => {
  let items = knowledgeItems
  if (selectedCategory.value !== 'all') {
    items = items.filter(item => item.category === selectedCategory.value)
  }
  if (searchText.value.trim()) {
    const keyword = searchText.value.toLowerCase()
    items = items.filter(item =>
      item.title.toLowerCase().includes(keyword) ||
      item.categoryLabel.toLowerCase().includes(keyword)
    )
  }
  return items
})
</script>

<style scoped>
.knowledge-view {
  height: 100%;
  display: flex;
  flex-direction: column;
  background: #0A1628;
  padding: 20px;
}

.knowledge-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
}

.page-title {
  font-size: 16px;
  font-weight: 700;
  color: #E8F0FF;
  margin: 0;
}

.search-box {
  display: flex;
  align-items: center;
  gap: 8px;
  background: #0F1F38;
  border: 1px solid #1E3A5F;
  border-radius: 6px;
  padding: 8px 12px;
  width: 240px;
}

.search-box svg {
  color: #5A7A92;
  font-size: 16px;
}

.search-box input {
  flex: 1;
  background: transparent;
  border: none;
  outline: none;
  color: #E8F0FF;
  font-size: 12px;
}

.category-tabs {
  display: flex;
  gap: 6px;
  margin-bottom: 16px;
  flex-wrap: wrap;
}

.category-tab {
  padding: 6px 14px;
  font-size: 12px;
  color: #5A7A92;
  background: transparent;
  border: 1px solid #1E3A5F;
  border-radius: 16px;
  cursor: pointer;
  transition: all 0.15s;
}

.category-tab:hover {
  color: #8BAAC0;
  border-color: #2A4566;
}

.category-tab.active {
  color: #fff;
  background: #1890FF;
  border-color: #1890FF;
}

.knowledge-list {
  flex: 1;
  overflow-y: auto;
}

.knowledge-item {
  background: #0F1F38;
  border: 1px solid #1E3A5F;
  border-radius: 8px;
  padding: 14px 16px;
  margin-bottom: 10px;
  cursor: pointer;
  transition: all 0.15s;
}

.knowledge-item:hover {
  border-color: #1890FF;
  background: rgba(24,144,255,0.05);
}

.item-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
}

.item-title {
  font-size: 13px;
  font-weight: 600;
  color: #E8F0FF;
  margin: 0;
}

.item-category {
  font-size: 10px;
  padding: 2px 8px;
  border-radius: 10px;
}

.item-category.故障案例 {
  color: #FAAD14;
  background: rgba(250,173,20,0.1);
}

.item-category.维修手册 {
  color: #1890FF;
  background: rgba(24,144,255,0.1);
}

.item-category.操作规范 {
  color: #52C41A;
  background: rgba(82,196,26,0.1);
}

.item-category.安全须知 {
  color: #FF4D4F;
  background: rgba(255,77,79,0.1);
}

.item-category.设备参数 {
  color: #00BCD4;
  background: rgba(0,188,212,0.1);
}

.item-meta {
  display: flex;
  gap: 12px;
}

.item-time,
.item-extra {
  font-size: 10px;
  color: #5A7A92;
}
</style>
