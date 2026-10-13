<template><select v-model="value" :multiple="multiple" class="standard-select"><option v-if="placeholder" value="" disabled>{{placeholder}}</option><option v-for="option in options" :key="String(option.value)" :value="option.value" :disabled="option.disabled">{{option.label}}</option></select></template>
<script setup>
import {computed} from 'vue'
const props=defineProps({modelValue:[String,Number,Boolean,Array],options:{type:Array,default:()=>[]},multiple:Boolean,placeholder:{type:String,default:'请选择'}})
const emit=defineEmits(['update:modelValue'])
const value=computed({get:()=>props.modelValue,set:value=>emit('update:modelValue',value)})
</script>
<style scoped>.standard-select{max-width:100%;box-sizing:border-box;border:1px solid #d3dce8;border-radius:5px;background:#fff;color:#445870;padding:8px 10px;min-height:34px;font:inherit;font-size:13px;line-height:1.4}.standard-select:focus-visible{outline:2px solid #b4935966;outline-offset:1px;border-color:#b49359}.standard-select:disabled{background:#f4f6f8;color:#8792a1}</style>
