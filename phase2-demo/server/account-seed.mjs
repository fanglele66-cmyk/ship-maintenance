import {readFile} from 'node:fs/promises'
import {join} from 'node:path'

export const identities=[['chief','captain','陈志远','轮机长'],['engineer1','engineer','李建国','大管轮'],['engineer2','secondEngineer','王海','二管轮'],['admin','admin','超级管理员','超级管理员']]

export function validateAccountSeed(value){
 if(value?.version!==1||!Array.isArray(value.accounts)||value.accounts.length!==identities.length)throw Error('固定账号初始化文件格式不正确。')
 const result=new Map()
 for(const row of value.accounts){
  const identity=identities.find(([username])=>username===row.username)
  if(!identity||result.has(row.username)||row.role!==identity[1]||typeof row.name!=='string'||!row.name.trim()||typeof row.label!=='string'||!row.label.trim()||!/^[a-f0-9]{32}$/i.test(row.salt||'')||!/^[a-f0-9]{128}$/i.test(row.hash||'')||Object.keys(row).some(key=>!['username','role','name','label','salt','hash'].includes(key)))throw Error('固定账号初始化文件包含无效账号或字段。')
  result.set(row.username,row)
 }
 return result
}

export async function readAccountSeed(root){
 try{return validateAccountSeed(JSON.parse(await readFile(join(root,'data/accounts-seed.json'),'utf8')))}
 catch(error){if(error.code==='ENOENT')throw Error('缺少 data/accounts-seed.json，无法初始化固定账号；请使用完整发布版本。');throw error}
}
