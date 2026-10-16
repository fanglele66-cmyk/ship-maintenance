import test from 'node:test'
import assert from 'node:assert/strict'
import {businessCopy,businessMessage} from '../src/utils/businessCopy.js'

test('prototype qualifiers become business copy without losing uncertainty or readings',()=>{
 const text=businessCopy('演示场景 · 持续关注：已确认的演示检查记录显示排温371.8°C，尚不能确认故障。')
 assert.equal(text,'持续关注：已确认的检查记录显示排温371.8°C，尚不能确认故障。')
 assert.equal(businessCopy('船管接口（演示返回）'),'船管接口')
 assert.equal(businessCopy('前置派工 · 演示'),'前置派工')
})
test('cached assistant messages are presented cleanly without modifying original evidence',()=>{
 const source={role:'assistant',id:'injector-demo-evidence',kind:'feedbackRecord',title:'演示检查记录',records:[{label:'部件取证',note:'模拟检查报告；未编造校验压力及厂家限值。'}]}
 const clean=businessMessage(source)
 assert.doesNotMatch(clean.title,/演示/)
 assert.equal(clean.id,source.id)
 assert.equal(source.title,'演示检查记录')
 assert.equal(clean.records[0].note,'检查报告；校验压力及厂家限值尚未取得。')
})
test('actual user messages, field drafts and action IDs are not rewritten',()=>{
 const user={role:'user',text:'正在进行模拟测试'}
 assert.equal(businessMessage(user),user)
 const values={note:'本次模拟信号测试已完成'}
 assert.equal(businessMessage({role:'assistant',values}).values,values)
 assert.equal(businessMessage({role:'assistant',actions:[{id:'演示-action',label:'查看演示记录'}]}).actions[0].id,'演示-action')
})
