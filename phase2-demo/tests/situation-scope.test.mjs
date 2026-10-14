import test from 'node:test'
import assert from 'node:assert/strict'
import {situationDeviceIds,situationDeviceOptions,inSituationScope,situationPositions,matchesSituationDevice} from '../src/mock/situationScope.js'
import {captainAnalysis} from '../src/mock/captainWorkbench.js'

test('situation groups three auxiliaries under one system entry',()=>{
 assert.deepEqual(situationDeviceOptions.map(d=>d.label),['主机','辅机'])
 assert.equal(inSituationScope({id:'steering-gear'}),false)
 assert.equal(inSituationScope({deviceId:'air-compressor'}),false)
 assert.equal(inSituationScope({id:'aux-engine-1'}),true)
 assert.equal(inSituationScope({id:'aux-engine-2'}),true)
 assert.equal(inSituationScope({id:'aux-engine-3'}),true)
 assert.equal(matchesSituationDevice({deviceId:'aux-engine-3'},'aux-system'),true)
 assert.equal(matchesSituationDevice({deviceId:'main-engine-1'},'aux-system'),false)
 assert.deepEqual(Object.keys(situationPositions),['main-engine-1','aux-system'])
})
test('scoped analysis does not refer to hidden equipment',()=>{
 const text=captainAnalysis({todoCreated:{},ignoredSuggestions:{},assignments:{},cases:{},progress:{},eventStatus:{}},situationDeviceIds)
 assert.match(text,/辅机/)
 assert.doesNotMatch(text,/舵机|空压机|锅炉/)
})
