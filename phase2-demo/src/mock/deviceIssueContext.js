import {workbenchIssues} from './captainWorkbench.js'
import {matchesSituationDevice} from './situationScope.js'
export const deviceIssueStates=['待决策','已派发','已结束']
export function deviceIssueState(item){return ['已闭环','已记录决定'].includes(item.state)?'已结束':item.state==='已派发'?'已派发':'待决策'}
export function deviceIssueRows(store,deviceId,type,state){return workbenchIssues(store).filter(item=>matchesSituationDevice(item,deviceId)&&(!type||item.type===type)&&deviceIssueState(item)===state)}
