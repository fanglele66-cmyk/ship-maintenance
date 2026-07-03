<template>
  <div class="knowledge-view">
    <!-- Search bar -->
    <div class="kv-search">
      <input
        v-model="searchQuery"
        type="text"
        class="search-input"
        placeholder="搜索知识条目..."
      />
    </div>

    <!-- Category tabs -->
    <div class="kv-categories">
      <button
        v-for="cat in categories"
        :key="cat"
        class="cat-tag"
        :class="{ active: currentCategory === cat }"
        @click="currentCategory = cat"
      >
        {{ cat }}
      </button>
    </div>

    <!-- Knowledge list -->
    <div class="kv-list">
      <div
        v-for="item in filteredKnowledge"
        :key="item.id"
        class="knowledge-card"
        @click="selectedItem = selectedItem?.id === item.id ? null : item"
      >
        <div class="kc-icon">📄</div>
        <div class="kc-body">
          <div class="kc-title">{{ item.title }}</div>
          <div class="kc-meta">
            <span class="kc-category">{{ item.category }}</span>
            <span class="kc-date">{{ item.updatedAt }}</span>
          </div>
          <div class="kc-tags">
            <span v-for="tag in item.tags" :key="tag" class="kc-tag">{{ tag }}</span>
          </div>
        </div>

        <!-- Expanded content -->
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
import { mockKnowledge, categories } from '@/mock/knowledge'

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
      k.tags.some(t => t.toLowerCase().includes(q))
    )
  }
  return list
})
</script>

<style scoped>
.knowledge-view {
  flex: 1;
  height: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.kv-search {
  padding: 14px 18px 8px;
  flex-shrink: 0;
}

.search-input {
  width: 100%;
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: 6px;
  padding: 8px 14px;
  color: var(--text-primary);
  font-size: 13px;
  outline: none;
  transition: border-color 0.2s;
}
.search-input::placeholder {
  color: var(--text-muted);
}
.search-input:focus {
  border-color: var(--accent);
}

.kv-categories {
  display: flex;
  gap: 6px;
  padding: 6px 18px;
  flex-shrink: 0;
  overflow-x: auto;
  border-bottom: 1px solid var(--border-color);
}

.cat-tag {
  font-size: 12px;
  padding: 4px 14px;
  border-radius: 4px;
  border: none;
  background: transparent;
  color: var(--text-muted);
  cursor: pointer;
  white-space: nowrap;
  transition: all 0.2s;
  flex-shrink: 0;
}
.cat-tag:hover {
  color: var(--text-secondary);
  background: rgba(24,144,255,0.05);
}
.cat-tag.active {
  background: var(--accent);
  color: white;
}

.kv-list {
  flex: 1;
  overflow-y: auto;
  padding: 10px 18px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.knowledge-card {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  gap: 10px;
  padding: 12px 14px;
  background: var(--bg-card);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;
}
.knowledge-card:hover {
  border-color: var(--accent);
}

.kc-icon {
  font-size: 20px;
  flex-shrink: 0;
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.kc-body {
  flex: 1;
  min-width: 0;
}

.kc-title {
  font-size: 13px;
  font-weight: 500;
  color: var(--text-primary);
  line-height: 1.4;
}

.kc-meta {
  display: flex;
  gap: 10px;
  margin-top: 3px;
}

.kc-category {
  font-size: 10px;
  color: var(--accent);
  background: rgba(24,144,255,0.1);
  padding: 1px 6px;
  border-radius: 3px;
}

.kc-date {
  font-size: 10px;
  color: var(--text-muted);
}

.kc-tags {
  display: flex;
  gap: 4px;
  margin-top: 4px;
}

.kc-tag {
  font-size: 9px;
  padding: 1px 6px;
  border-radius: 3px;
  background: rgba(90,122,146,0.15);
  color: var(--offline);
}

/* Expanded detail */
.kc-detail {
  width: 100%;
  margin-top: 8px;
  padding-top: 8px;
  border-top: 1px solid var(--border-color);
}

.kc-summary {
  font-size: 11px;
  color: var(--text-secondary);
  line-height: 1.6;
  margin-bottom: 8px;
  padding: 8px 10px;
  background: var(--bg-secondary);
  border-radius: 6px;
}

.kc-content {
  font-size: 12px;
  color: var(--text-secondary);
  line-height: 1.7;
  white-space: pre-wrap;
}

/* Expand transition */
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
