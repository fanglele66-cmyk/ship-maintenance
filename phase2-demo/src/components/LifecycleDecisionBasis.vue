<template><section class="lc-decision-basis" aria-label="本轮决策依据"><div><h3>决策要点</h3><p>{{basis.points}}</p></div><div><h3>派发依据</h3><p>{{basis.reason}}</p></div></section></template>
<script setup>
import {computed} from 'vue'
import {decisionBasis} from '../workflow/lifecycleAnalysis'
const props=defineProps({event:{type:Object,required:true},action:{type:String,default:''}})
const basis=computed(()=>decisionBasis(props.event,props.action))
</script>
<style scoped>
.lc-decision-basis h3{font-size:18px!important;font-weight:600;margin:0 0 8px!important}.lc-decision-basis p{font-size:13px!important;line-height:1.7!important}.lc-assistant .lc-decision-basis h3{font-size:15px!important}
.lc-decision-basis{display:grid;grid-template-columns:1fr 1fr;gap:25px;margin:4px 0 20px}.lc-decision-basis h3{font-size:15px;color:#665235;margin:0 0 10px}.lc-decision-basis>div+div h3{color:#3e5671}.lc-decision-basis p{font-size:14px;line-height:1.85;white-space:pre-line;margin:0;color:#5b6f86}.lc-assistant .lc-decision-basis{display:block;margin-bottom:12px}.lc-assistant .lc-decision-basis>div{margin-bottom:16px}.lc-assistant .lc-decision-basis h3{font-size:13px}.lc-assistant .lc-decision-basis p{font-size:13px}@media(max-width:800px){.lc-decision-basis{grid-template-columns:1fr}}
</style>
