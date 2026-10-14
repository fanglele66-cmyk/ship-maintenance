// Only controls the situation surface; other equipment and historical records remain intact.
export const situationDeviceOptions = [
  {value:'main-engine-1',label:'主机'},
  {value:'aux-system',label:'辅机'},
]
export const situationDeviceIds = ['main-engine-1','aux-system','aux-engine-1','aux-engine-2','aux-engine-3']
export const matchesSituationDevice = (item,deviceId) => !deviceId || (deviceId==='aux-system'?String(item.deviceId||item.id).startsWith('aux-engine-'): (item.deviceId||item.id)===deviceId)
export const inSituationScope = item => situationDeviceIds.includes(item.deviceId || item.id)
// Schematic entry points, not surveyed physical installation coordinates.
export const situationPositions = {
  'main-engine-1':{x:'50%',y:'80%'},
  'aux-system':{x:'50%',y:'68%'},
}
