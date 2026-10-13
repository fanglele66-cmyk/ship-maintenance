import test from 'node:test'
import assert from 'node:assert/strict'
import vm from 'node:vm'
import {readFileSync} from 'node:fs'
const code=readFileSync(new URL('../index.html',import.meta.url),'utf8').match(/<script>([\s\S]*?)<\/script>/)[1]
function boot(){
 const listeners={},values=new Map(),redirects=[]
 const label={textContent:'正在加载工作台…'},button={hidden:true},document={getElementById:id=>id==='boot-label'?label:button}
 const sandbox={window:{addEventListener:(name,fn)=>listeners[name]=fn},document,location:{href:'https://example.test/#/situation/issue/fault',replace:url=>redirects.push(url)},sessionStorage:{getItem:key=>values.get(key),setItem:(key,value)=>values.set(key,value),removeItem:key=>values.delete(key)},URL,Date,setTimeout:fn=>{listeners.timeout=fn;return 1},clearTimeout:()=>{listeners.cleared=true},fetch:()=>Promise.resolve({ok:false})}
 vm.runInNewContext(code,sandbox)
 return {sandbox,listeners,redirects,label,button}
}
test('failed chunk refreshes at most once, preserves route, then exposes a retry',()=>{
 const b=boot()
 b.sandbox.window.__shipRecover(new Error('Failed to fetch dynamically imported module'))
 assert.equal(b.redirects.length,1);assert.equal(new URL(b.redirects[0]).hash,'#/situation/issue/fault');assert.ok(new URL(b.redirects[0]).searchParams.has('__refresh'))
 b.sandbox.window.__shipRecover(new Error('Failed to fetch dynamically imported module'))
 assert.equal(b.redirects.length,1);assert.equal(b.button.hidden,false)
 b.button.onclick();assert.equal(b.redirects.length,2)
})
test('initial script failure is recoverable and slow startup offers feedback',()=>{
 const b=boot();b.listeners.error({target:{tagName:'SCRIPT'}});assert.equal(b.redirects.length,1)
 b.listeners.timeout();assert.equal(b.button.hidden,false);assert.match(b.label.textContent,/请重试/)
})
test('successful startup clears the timeout; other application errors do not reload in a loop',()=>{
 const b=boot();b.listeners['ship:ready']();assert.equal(b.listeners.cleared,true)
 b.sandbox.window.__shipRecover(new Error('Unexpected state'));assert.equal(b.redirects.length,0);assert.equal(b.button.hidden,false)
})
