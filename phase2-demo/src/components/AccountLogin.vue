<template>
 <main class="login-page"><form class="login-card" @submit.prevent="submit">
  <div class="login-brand">智能机舱 · 船端 2.0</div><h1>登录工作空间</h1><p>使用个人账号查看事件、执行任务与跟进设备健康。</p>
  <label>账号<input v-model="username" name="username" autocomplete="username" required placeholder="请输入账号" :disabled="busy"/></label>
  <label>密码<input v-model="password" name="password" type="password" autocomplete="current-password" required placeholder="请输入密码" :disabled="busy"/></label>
  <p v-if="error||auth.error" class="login-error" role="alert">{{error||auth.error}}</p>
  <button type="submit" :disabled="busy">{{busy?'正在登录…':'登录'}}</button><small>切换账号前，请先退出当前登录。</small>
 </form></main>
</template>
<script setup>
import {ref} from 'vue'
import {auth,login} from '../services/auth'
const username=ref(''),password=ref(''),error=ref(''),busy=ref(false)
async function submit(){busy.value=true;error.value='';try{await login(username.value.trim(),password.value)}catch(e){error.value=e.message;busy.value=false}}
</script>
<style scoped>
.login-page{height:100%;width:100%;display:grid;place-items:center;background:#f4f5f2;color:#30372f}.login-card{width:min(420px,calc(100vw - 48px));padding:38px;background:white;border:1px solid #e2e6de;border-radius:12px;box-sizing:border-box;box-shadow:0 18px 50px #28302608}.login-brand{font-size:13px;color:#9b7b47;letter-spacing:1px}.login-card h1{font-size:25px;margin:20px 0 12px}.login-card p{font-size:13px;line-height:1.8;color:#788174}.login-card label{display:grid;gap:9px;font-size:13px;margin-top:22px}.login-card input{padding:12px;border:1px solid #d7ded3;border-radius:6px;font:inherit}.login-card input:focus{outline:2px solid #b39b6d;outline-offset:2px}.login-card button{margin-top:26px;padding:12px;width:100%;border:0;border-radius:6px;background:#343a2e;color:white;cursor:pointer;font:inherit}.login-card button:disabled{opacity:.6}.login-card small{display:block;text-align:center;margin-top:17px;color:#87907f;font-size:12px}.login-card .login-error{color:#b53931}
</style>
