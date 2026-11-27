import {readFile} from 'node:fs/promises'
import {join} from 'node:path'
const names=new Set([
 'ship-manual-anomaly-analysis','ship-anomaly-detection','ship-effect-observation',
 'ship-event-assistant','ship-task-assistant','ship-situation-assistant','ship-knowledge-assistant',
 'ship-event-workflow','ship-report-generation',
])
export async function skillInstruction(root,name){
 if(!names.has(name))throw Error('未知 Skill')
 return readFile(join(root,'.claude/skills',name,'SKILL.md'),'utf8')
}
// The host chooses the skill and authenticates the actor. Tags are context, never permissions.
export function hiddenContext(data){return '<yincang>'+JSON.stringify(data).replace(/</g,'\\u003c').replace(/>/g,'\\u003e')+'</yincang>'}
export function visibleText(text){return String(text||'').replace(/<yincang\b[^>]*(?:>|$)[\s\S]*?(?:<\/yincang>|$)/gi,'').replace(/<(?:y|yi|yin|yinc|yinca|yincan|yincang)?$/gi,'').trim()}
