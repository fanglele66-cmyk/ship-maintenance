import { createApp } from 'vue'
import { createPinia } from 'pinia'
import 'element-plus/es/components/message/style/css'
import App from './App.vue'
import {useMaintenanceAdviceStore} from './stores/maintenanceAdviceStore'
import router from './router'
import './styles/global.css'
import './styles/phase2.css'
import './styles/workbench.css'
import './styles/hierarchy.css'
import './styles/conversation.css'
import './styles/situation-adaptation.css'
import './styles/todo-adaptation.css'

const app = createApp(App)
const pinia=createPinia()
app.use(pinia)
useMaintenanceAdviceStore(pinia).enableExample()
app.use(router)

router.onError(error=>window.__shipRecover?.(error))
router.isReady().then(()=>{app.mount('#app');window.dispatchEvent(new Event('ship:ready'))}).catch(error=>window.__shipRecover?.(error))
