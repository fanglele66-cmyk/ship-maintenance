const recognitionError=code=>({
 'not-allowed':'未获得麦克风权限，请允许后重试。',
 'service-not-allowed':'当前浏览器未允许语音识别，请检查权限后重试。',
 'audio-capture':'未检测到可用麦克风。',
 network:'语音识别连接失败，请检查网络后重试。',
 'no-speech':'未识别到语音，请重试。'
})[code]||'语音识别暂不可用，请重试或直接输入文字。'

// Keep only finalized speech in the draft. Read its latest value for each result
// so text typed while recognition is running is never replaced by a stale copy.
export function createSpeechDraftInput({readDraft,writeDraft,onChange=()=>{},disabled=()=>false,getRecognition=()=>globalThis.window?.SpeechRecognition||globalThis.window?.webkitSpeechRecognition}){
 const state={listening:false,stopping:false,interim:'',error:''}
 let session=null,disposed=false
 const update=patch=>{Object.assign(state,patch);if(!disposed)onChange({...state})}
 function detach(current){current.recognition.onresult=null;current.recognition.onerror=null;current.recognition.onend=null}
 function cancel(){
  const current=session;session=null
  if(current){detach(current);try{current.recognition.abort()}catch{}}
  update({listening:false,stopping:false,interim:'',error:''})
 }
 function stop(){
  if(!session||state.stopping)return
  update({stopping:true})
  try{session.recognition.stop()}catch{cancel();update({error:'无法结束语音识别，请重试。'})}
 }
 function start(){
  if(disposed||disabled()||session)return
  update({error:'',interim:''})
  const Recognition=getRecognition()
  if(!Recognition){update({error:'当前浏览器不支持语音识别，请直接输入文字或更换浏览器。'});return}
  let recognition
  try{recognition=new Recognition()}catch{update({error:'无法开始语音输入，请检查麦克风权限。'});return}
  const current={recognition,committed:new Set()};session=current
  recognition.lang='zh-CN';recognition.continuous=true;recognition.interimResults=true
  recognition.onresult=event=>{
   if(disposed||session!==current)return
   if(disabled()){cancel();return}
   let final='',preview=''
   for(let i=0;i<event.results.length;i++){
    const result=event.results[i],text=result[0]?.transcript||''
    if(result.isFinal){if(!current.committed.has(i)){current.committed.add(i);final+=text}}
    else preview+=text
   }
   if(final.trim()){
    const draft=String(readDraft()||'')
    writeDraft(draft+(draft&&!draft.endsWith('\n')?'\n':'')+final.trim())
   }
   update({interim:preview})
  }
  recognition.onerror=event=>{
   if(disposed||session!==current)return
   cancel()
   if(event.error!=='aborted')update({error:recognitionError(event.error)})
  }
  recognition.onend=()=>{
   if(disposed||session!==current)return
   detach(current);session=null;update({listening:false,stopping:false,interim:''})
  }
  update({listening:true,stopping:false})
  try{recognition.start()}catch{cancel();update({error:'无法开始语音输入，请检查麦克风权限。'})}
 }
 return {
  start,stop,cancel,
  toggle(){if(disabled()||disposed)return;if(session)stop();else start()},
  dispose(){if(disposed)return;cancel();disposed=true},
  get state(){return {...state}}
 }
}
