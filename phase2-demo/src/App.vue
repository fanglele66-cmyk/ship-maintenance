<template>
 <ElConfigProvider size="small">
  <AccountLogin v-if="auth.ready&&!auth.user"/>
  <div v-else-if="!auth.ready" class="login-loading">正在连接工作空间…</div>
  <div v-else class="app-container">
    <AppNav />
    <div class="app-main">
      <AppHeader />
      <div v-if="workflowStatus.error" class="workflow-sync-error" role="alert">{{workflowStatus.error}} <button @click="reloadWorkflow">重新载入服务器记录</button></div>
      <div class="app-content">
        <router-view v-slot="{ Component, route }">
          <transition name="fade-slide" mode="out-in">
            <KeepAlive :key="viewRevision">
              <component :is="Component" :key="route.name" />
            </KeepAlive>
          </transition>
        </router-view>
      </div>
    </div>
  </div>
 </ElConfigProvider>
</template>

<script setup>
import {workflowStatus} from './services/workflowStatus.js'
const reloadWorkflow=()=>location.reload()
import AccountLogin from './components/AccountLogin.vue'
import {auth,loadAccount} from './services/auth'
import { ref, onBeforeUnmount } from 'vue'
import {ElConfigProvider} from 'element-plus'
import AppNav from '@/components/AppNav.vue'
import AppHeader from '@/components/AppHeader.vue'
import { installDevViewRecovery } from '@/utils/devViewRecovery'

void loadAccount()
const authTimer=setInterval(async()=>{const before=auth.user?.username;await loadAccount();if(before!==auth.user?.username)location.reload()},15000)
onBeforeUnmount(()=>clearInterval(authTimer))
const viewRevision=ref(0)
if(import.meta.hot){
  const stopRecovery=installDevViewRecovery(import.meta.hot,()=>{viewRevision.value++})
  onBeforeUnmount(stopRecovery)
}
</script>

<style scoped>
.workflow-sync-error{background:#fff3db;color:#855719;padding:8px 16px;font-size:13px}.workflow-sync-error button{margin-left:12px;border:1px solid #d8c29b;border-radius:4px;padding:4px 8px;background:white;cursor:pointer}
.app-container {
  width: 100%;
  height: 100%;
  display: flex;
  overflow: hidden;
}

.app-main {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.app-content {
  flex: 1;
  display: flex;
  overflow: hidden;
  min-height: 0;
}

/* Page transition */
.fade-slide-enter-active,
.fade-slide-leave-active {
  transition: all 0.25s ease;
}
.fade-slide-enter-from {
  opacity: 0;
  transform: translateX(16px);
}
.fade-slide-leave-to {
  opacity: 0;
  transform: translateX(-16px);
}
</style>
