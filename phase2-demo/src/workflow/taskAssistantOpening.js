// Opening choices describe how the operator wants to start, never a work result.
export function taskAssistantOpening(task){
 const repair=task?.kind==='repair'
 if(!repair&&task?.kind!=='investigation')return null
 return {title:repair?'这项维修，你想先从哪里开始？':'这项排查，你想先从哪里开始？',choices:repair?[
  {id:'record',label:'记录作业情况',prompt:'我想先记录这次维修已经做的作业。'},
  {id:'guidance',label:'先看作业要点',prompt:'我想先看看这次维修需要注意什么。'},
 ]:[
  {id:'record',label:'记录检查情况',prompt:'我想先记录这次排查已经检查的情况。'},
  {id:'guidance',label:'先看检查要点',prompt:'我想先看看这次排查需要核对什么。'},
 ]}
}

export function taskAssistantOpeningReply(task,text){
 const choice=taskAssistantOpening(task)?.choices.find(item=>item.prompt===text?.trim())
 if(!choice)return null
 if(choice.id==='guidance')return {kind:'question',text:task.kind==='repair'
  ?'这次维修先核对批准范围、许可和隔离要求，再记录实际做了什么。你想先了解哪一项？'
  :'这次排查按左侧任务要求核对现场部位、时间和实际结果。你想先了解哪一项？'}
 return {kind:'question',text:task.kind==='repair'
  ?'好，先说说这次维修做了什么、结果怎样；有照片或读数也可以一起发来。'
  :'好，先说说检查了哪些部位、有什么发现；时间或读数记得的话也一起说。'}
}
