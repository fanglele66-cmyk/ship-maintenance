import {defineAsyncComponent} from 'vue'
import AsyncPaneState from './AsyncPaneState.vue'
export function lazyPane(loader){return defineAsyncComponent({loader,loadingComponent:AsyncPaneState,errorComponent:AsyncPaneState,delay:120,timeout:15000,onError(error,retry,fail,attempts){if(attempts<2){retry();return}if(typeof window!=='undefined')window.__shipRecover?.(error);fail()}})}
