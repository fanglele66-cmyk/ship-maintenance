import test from 'node:test'
import assert from 'node:assert/strict'
import {appUrl,appHtml,appStyleUrl} from '../src/services/appUrl.js'
import {trustedAppRequest} from '../server/request-origin.mjs'

test('one build keeps API, image and knowledge links in root and nested application directories',()=>{
 for(const base of ['https://company.test/','https://company.test/ship/','https://company.test/apps/engine/']){
  for(const path of ['/api/auth/login','api/ai/chat','/nav-icons/situation.svg','/wiki_rt-flex50/images/图纸.jpg','/#/knowledge?doc=RTF-1']){
   assert.equal(new URL(appUrl(path),base).href,new URL(path.replace(/^\//,''),base).href)
  }
  assert.equal(appStyleUrl('/nav-icons/situation.svg',base),base+'nav-icons/situation.svg')
 }
 for(const path of ['https://example.test/file.pdf','//cdn.test/image.png','data:image/png;base64,abc','blob:https://company.test/id','#section'])assert.equal(appUrl(path),path)
 assert.equal(appUrl('/api/auth/me','/ship/'),'/ship/api/auth/me')
})

test('generated knowledge HTML rebases only local root-relative resource attributes',()=>{
 const html='<img src="/wiki_rt-flex50/images/a.jpg"><a href=\'/#/knowledge?doc=1\'>资料</a><a href="https://example.test/a">外链</a><a href="#part">章节</a><img src="//cdn.test/a.jpg">'
 const result=appHtml(html)
 assert.match(result,/src="\.\/wiki_rt-flex50\/images\/a.jpg"/)
 assert.match(result,/href='\.\/#\/knowledge\?doc=1'/)
 assert.match(result,/href="https:\/\/example.test\/a"/)
 assert.match(result,/href="#part"/)
 assert.match(result,/src="\/\/cdn.test\/a.jpg"/)
})

const request=(origin='http://localhost:5173',host='localhost:5173',remoteAddress='127.0.0.1')=>({socket:{remoteAddress},headers:{host,origin,'x-engine-room-client':'local-ui'}})
test('local mode preserves same-origin login and rejects cross-site or remote requests',()=>{
 assert.equal(trustedAppRequest(request(),''),true)
 const noOrigin=request();delete noOrigin.headers.origin
 assert.equal(trustedAppRequest(noOrigin,''),true)
 assert.equal(trustedAppRequest(request('https://untrusted.test'),''),false)
 assert.equal(trustedAppRequest(request('null'),''),false)
 assert.equal(trustedAppRequest(request('http://localhost:5173','localhost:5173','10.0.0.8'),''),false)
 const forged=request('https://untrusted.test');forged.headers['x-forwarded-host']='localhost:5173';forged.headers['x-forwarded-proto']='https'
 assert.equal(trustedAppRequest(forged,''),false)
})

test('configured HTTPS proxy origin requires exact origin, unchanged Host and loopback transport',()=>{
 const origin='https://ship.company.test',req=request(origin,'ship.company.test')
 assert.equal(trustedAppRequest(req,origin),true)
 assert.equal(trustedAppRequest({...req,headers:{...req.headers,origin:'http://ship.company.test'}},origin),false)
 assert.equal(trustedAppRequest({...req,headers:{...req.headers,host:'127.0.0.1:5173'}},origin),false)
 assert.equal(trustedAppRequest({...req,socket:{remoteAddress:'10.0.0.1'}},origin),false)
 assert.equal(trustedAppRequest({...req,headers:{host:req.headers.host,origin}},origin),false)
 for(const invalid of [origin+'/ship/',origin+'?x=1','not-a-url','ftp://ship.company.test'])assert.equal(trustedAppRequest(req,invalid),false)
})
