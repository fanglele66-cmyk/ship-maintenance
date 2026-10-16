import test from 'node:test'
import assert from 'node:assert/strict'
import { shouldCollapseTodoAssistant } from '../src/utils/todoLayout.js'

test('Pad portrait preserves task width by collapsing the assistant',()=>{
  assert.equal(shouldCollapseTodoAssistant(750),true)
  assert.equal(shouldCollapseTodoAssistant(680),true)
})
test('Pad landscape, 1080p and 2K retain side-by-side assistant',()=>{
  for(const width of [814,1092,1832,2472])assert.equal(shouldCollapseTodoAssistant(width),false)
})
test('unmeasured container does not force compact mode',()=>{
  assert.equal(shouldCollapseTodoAssistant(0),false)
})
