<template>
  <div class="knowledge-view">
    <!-- Header: 标题 + 搜索框（V1.0 布局） -->
    <div class="kv-header">
      <h2 class="kv-title">知识库</h2>
      <div class="kv-search">
        <svg class="search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="11" cy="11" r="8"/>
          <path d="M21 21l-4.35-4.35"/>
        </svg>
        <input
          v-model="searchQuery"
          type="text"
          placeholder="搜索知识库..."
        />
      </div>
    </div>

    <!-- 分类标签（V1.0 圆角药丸形） -->
    <div class="kv-categories">
      <button
        v-for="cat in categories"
        :key="cat"
        class="cat-tab"
        :class="{ active: currentCategory === cat }"
        @click="currentCategory = cat"
      >{{ cat }}</button>
    </div>

    <!-- 知识列表 -->
    <div class="kv-list">
      <div
        v-for="item in filteredKnowledge"
        :key="item.id"
        class="knowledge-card"
        :class="{ expanded: selectedItem?.id === item.id }"
        @click="selectedItem = selectedItem?.id === item.id ? null : item"
      >
        <!-- 主体行（V1.0 布局） -->
        <div class="kc-main">
          <div class="kc-body">
            <h3 class="kc-title">{{ item.title }}</h3>
            <div class="kc-meta">
              <span class="kc-time">{{ item.updatedAt }}</span>
              <span v-if="item.extra" class="kc-extra">{{ item.extra }}</span>
            </div>
          </div>
          <span
            class="kc-category"
            :style="getCategoryStyle(item.category)"
          >{{ item.category }}</span>
        </div>

        <!-- 展开详情（V2.0 功能保留） -->
        <transition name="expand">
          <div v-if="selectedItem?.id === item.id" class="kc-detail">
            <div class="kc-summary">{{ item.summary }}</div>
            <div class="kc-content" v-html="item.content"></div>
          </div>
        </transition>
      </div>

      <div v-if="filteredKnowledge.length === 0" class="empty-state">
        未找到匹配的知识条目
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { mockKnowledge, categories, categoryColors } from '@/mock/knowledge'

const searchQuery = ref('')
const currentCategory = ref('全部')
const selectedItem = ref(null)

const filteredKnowledge = computed(() => {
  let list = [...mockKnowledge]
  if (currentCategory.value !== '全部') {
    list = list.filter(k => k.category === currentCategory.value)
  }
  if (searchQuery.value.trim()) {
    const q = searchQuery.value.toLowerCase()
    list = list.filter(k =>
      k.title.toLowerCase().includes(q) ||
      k.category.includes(q) ||
      (k.tags && k.tags.some(t => t.toLowerCase().includes(q)))
    )
  }
  return list
})

function getCategoryStyle(cat) {
  const c = categoryColors[cat]
  if (c) return { color: c.color, background: c.bg }
  return {}
}
</script>

<style scoped>
.knowledge-view {
  flex: 1;
  height: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  padding: 20px;
}

/* Header（V1.0 风格） */
.kv-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
  flex-shrink: 0;
}

.kv-title {
  font-size: 16px;
  font-weight: 700;
  color: var(--text-primary);
  margin: 0;
}

.kv-search {
  display: flex;
  align-items: center;
  gap: 8px;
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: 6px;
  padding: 8px 12px;
  width: 240px;
}

.search-icon {
  width: 16px;
  height: 16px;
  color: var(--text-muted);
  flex-shrink: 0;
}

.kv-search input {
  flex: 1;
  background: transparent;
  border: none;
  outline: none;
  color: var(--text-primary);
  font-size: 12px;
}

.kv-search input::placeholder {
  color: var(--text-muted);
}

/* 分类标签（V1.0 药丸风格） */
.kv-categories {
  display: flex;
  gap: 6px;
  margin-bottom: 16px;
  flex-wrap: wrap;
  flex-shrink: 0;
}

.cat-tab {
  padding: 6px 14px;
  font-size: 12px;
  color: var(--text-muted);
  background: transparent;
  border: 1px solid var(--border-color);
  border-radius: 16px;
  cursor: pointer;
  transition: all 0.15s;
  white-space: nowrap;
}

.cat-tab:hover {
  color: var(--text-secondary);
  border-color: #2A4566;
}

.cat-tab.active {
  color: #fff;
  background: var(--accent);
  border-color: var(--accent);
}

/* 知识列表 */
.kv-list {
  flex: 1;
  overflow-y: auto;
}

/* 卡片（V1.0 布局 + V2.0 展开功能） */
.knowledge-card {
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  padding: 14px 16px;
  margin-bottom: 10px;
  cursor: pointer;
  transition: all 0.15s;
}

.knowledge-card:hover {
  border-color: var(--accent);
  background: rgba(24,144,255,0.05);
}

.knowledge-card.expanded {
  border-color: var(--accent);
}

/* 主体行（V1.0 风格） */
.kc-main {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.kc-body {
  flex: 1;
  min-width: 0;
}

.kc-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0 0 8px 0;
  line-height: 1.4;
}

.kc-meta {
  display: flex;
  gap: 12px;
}

.kc-time,
.kc-extra {
  font-size: 10px;
  color: var(--text-muted);
}

.kc-extra {
  padding-left: 12px;
  border-left: 1px solid var(--border-color);
}

/* 分类色块（V1.0 风格，每种分类不同颜色） */
.kc-category {
  font-size: 10px;
  padding: 2px 8px;
  border-radius: 10px;
  white-space: nowrap;
  flex-shrink: 0;
  font-weight: 500;
}

/* 展开详情（V2.0 功能） */
.kc-detail {
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid var(--border-color);
}

.kc-summary {
  font-size: 11px;
  color: var(--text-secondary);
  line-height: 1.6;
  margin-bottom: 10px;
  padding: 8px 10px;
  background: var(--bg-card);
  border-radius: 6px;
}

.kc-content {
  font-size: 12px;
  color: var(--text-secondary);
  line-height: 1.7;
  white-space: pre-wrap;
}

/* 展开动画 */
.expand-enter-active,
.expand-leave-active {
  transition: all 0.25s ease;
  overflow: hidden;
}
.expand-enter-from,
.expand-leave-to {
  opacity: 0;
  max-height: 0;
}
.expand-enter-to,
.expand-leave-from {
  opacity: 1;
  max-height: 1000px;
}

.empty-state {
  padding: 40px;
  text-align: center;
  font-size: 13px;
  color: var(--text-muted);
}
</style>
