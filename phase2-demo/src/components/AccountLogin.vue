<template>
 <main class="login-page">
 <div class="login-backdrop" aria-hidden="true"></div>
 <div class="login-layout">
 <section class="login-visual" aria-label="船舶设备健康示意">
  <div class="visual-heading"><span class="visual-mark"></span><span>长航碧玉</span><small>设备健康管理</small></div>
  <img src="/ship-situation-engines.png" alt="航行中的船舶与设备结构示意" width="941" height="1672"/>
  <div class="visual-caption"><span>工况监测</span><i></i><span>健康研判</span><i></i><span>协同处置</span></div>
 </section>
 <form class="login-card" @submit.prevent="submit">
  <div class="login-brand">船舶设备健康管理助手</div><h1>登录工作空间</h1><p>使用个人账号查看事件、执行任务与跟进设备健康。</p>
  <label>账号<input v-model="username" name="username" autocomplete="username" required placeholder="请输入账号" :disabled="busy"/></label>
  <label>密码<input v-model="password" name="password" type="password" autocomplete="current-password" required placeholder="请输入密码" :disabled="busy"/></label>
  <p v-if="error||auth.error" class="login-error" role="alert">{{error||auth.error}}</p>
  <button type="submit" :disabled="busy">{{busy?'正在登录…':'登录'}}</button>
 </form></div></main>
</template>
<script setup>
import {ref} from 'vue'
import {auth,login} from '../services/auth'
const username=ref(''),password=ref(''),error=ref(''),busy=ref(false)
async function submit(){busy.value=true;error.value='';try{await login(username.value.trim(),password.value)}catch(e){error.value=e.message;busy.value=false}}
</script>
<style scoped>
.login-page{position:relative;isolation:isolate;min-height:100%;width:100%;display:grid;place-items:center;background:#eef2f1;color:#30372f;overflow:auto;padding:40px 24px;box-sizing:border-box}.login-backdrop{position:absolute;inset:0;z-index:-1;background:linear-gradient(105deg,#dce5eacc,#f3f5f0f2 64%),url('/ship-situation-engines.png') left 40%/58% auto no-repeat;opacity:.9}.login-layout{display:grid;grid-template-columns:minmax(0,1.05fr) minmax(380px,1fr);width:min(990px,100%);min-height:580px;border:1px solid #dce3de;border-radius:16px;overflow:hidden;box-shadow:0 24px 70px #1e35441b;background:#fff}.login-visual{position:relative;min-height:580px;background:#052438;overflow:hidden}.login-visual>img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;object-position:center 43%}.visual-heading{position:absolute;z-index:1;top:28px;left:30px;right:30px;display:flex;gap:10px;align-items:center;color:#e3eef0;font-size:15px}.visual-heading small{margin-left:auto;color:#b1c4ca;font-size:12px}.visual-mark{width:7px;height:7px;border-radius:50%;background:#75bcaa;box-shadow:0 0 0 4px #75bcaa22}.visual-caption{position:absolute;bottom:0;inset-inline:0;display:flex;justify-content:center;align-items:center;gap:16px;padding:60px 16px 27px;background:linear-gradient(transparent,#031f31e6);font-size:12px;letter-spacing:1px;color:#c3d7dc}.visual-caption i{height:3px;width:3px;background:#809ea8;border-radius:50%}.login-card{align-self:center;padding:50px 48px;box-sizing:border-box}.login-brand{font-size:16px;color:#9b7b47;letter-spacing:1px}.login-card h1{font-size:28px;margin:25px 0 12px}.login-card p{font-size:13px;line-height:1.8;color:#788174}.login-card label{display:grid;gap:9px;font-size:13px;margin-top:25px}.login-card input{min-width:0;padding:13px;border:1px solid #d7ded3;border-radius:6px;font:inherit;background:#fcfdfb}.login-card input:focus{outline:2px solid #b39b6d;outline-offset:2px}.login-card button{margin-top:30px;padding:13px;width:100%;border:0;border-radius:6px;background:#343a2e;color:white;cursor:pointer;font:inherit}.login-card button:hover{background:#48503f}.login-card button:disabled{opacity:.6}.login-card .login-error{color:#b53931}
@media(min-width:1800px){.login-layout{width:1120px;min-height:650px}.login-visual{min-height:650px}.login-card{padding:55px 65px}}
@media(max-width:760px){.login-page{padding:24px 18px}.login-layout{grid-template-columns:1fr;max-width:440px;min-height:0}.login-visual{min-height:160px}.login-visual>img{object-position:center 31%}.visual-heading{top:20px;left:24px;right:24px}.visual-caption{display:none}.login-card{padding:30px 28px 36px}.login-card h1{font-size:25px;margin-top:18px}.login-brand{font-size:15px}.login-backdrop{background:linear-gradient(120deg,#dce5ea,#f3f5f0)}}
</style>
