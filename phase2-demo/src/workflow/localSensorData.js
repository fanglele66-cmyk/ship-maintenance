import catalog from '../../data/sensor-point-mapping.json'

const aliases={1:'s-012',9:'s-046',10:'s-005',28:'s-009',29:'s-010',41:'s-002',42:'s-001',45:'s-008',59:'s-011',6:'main-control-air-pressure',54:'main-servo-rail-pressure',56:'main-fuel-rail-pressure'}
for(const [first,topic] of [[8,'exhaust'],[22,'scavenge'],[31,'piston'],[46,'coolant']]){
 for(let n=1;n<=6;n++)aliases[first+n-1]||=`main-cyl-${n}-${topic}`
}
export const localPointIds=Object.fromEntries(catalog.pointList.map(p=>[p.pointCode,aliases[Number(p.pointCode.slice(2))]||`local-${p.pointCode}`]))
function subsystem(code){
 const n=Number(code.slice(2))
 if(n===1)return '转速监测'
 if(n>=8&&n<=21)return '排温系统'
 if(n>=22&&n<=27||n===59)return '扫气系统'
 if(n>=28&&n<=40)return '滑油系统'
 if(n>=44&&n<=53)return '冷却系统'
 if(n>=41&&n<=43||n>=54&&n<=58)return '燃油系统'
 return '其他测点'
}
export function localSensors(points=catalog.pointList){
 return points.map(p=>({id:localPointIds[p.pointCode],pointCode:p.pointCode,nameCn:p.pointName,nameEn:p.pointNameEn||'',
  device:'主机',deviceId:'main-engine-1',system:'主机系统',subsystem:subsystem(p.pointCode),
  value:Number.isFinite(p.value)?p.value:null,unit:p.unit,precision:2,status:Number.isFinite(p.value)?'normal':'unknown',sourceKind:'historical-copy-replay',range:'未配置限值'}))
}
export const isLocalSensor=s=>s.deviceId==='main-engine-1'||s.id==='ship-speed'
