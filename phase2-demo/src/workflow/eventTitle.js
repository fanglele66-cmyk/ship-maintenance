// The title describes the signal; uncertainty stays in the analysis and records.
export function eventTitle(title,type='报警事件'){
 if(!['报警事件','预警事件'].includes(type)||typeof title!=='string')return title
 return title.replace(/待(?:核实|核查)/g,'').replace(/[（(]\s*[）)]/g,'')
  .replace(/^[\s·•—:：,，;；-]+|[\s·•—:：,，;；-]+$/g,'').trim()||'设备异常'
}
