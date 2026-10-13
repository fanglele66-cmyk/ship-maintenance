<template><div class="issues-toolbar"><slot /></div></template>
<style scoped>
.issues-toolbar{display:flex;align-items:center;justify-content:flex-start;gap:16px 28px;flex-wrap:wrap;padding:16px 24px;border-bottom:1px solid #e6ebf2;flex-shrink:0}
.issues-toolbar :deep(label){display:flex;align-items:center;gap:10px;font-size:13px;color:#627188;white-space:nowrap}
.issues-toolbar :deep(select){width:160px}
@media(max-width:900px){.issues-toolbar{gap:12px 20px;padding:14px 16px}.issues-toolbar :deep(select){width:140px}}
@media(max-width:560px){.issues-toolbar :deep(label){width:100%;justify-content:space-between}.issues-toolbar :deep(select){width:calc(100% - 75px)}}
</style>
