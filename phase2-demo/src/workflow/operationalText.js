// Presentation-only cleanup of legacy script framing. Raw conversations,
// attachments and submitted versions retain their original provenance.
const imageFraming=/(?:附图|所述图片|照片|图片)(?:标注为|仅为|只是|是|为)?\s*AI\s*(?:生成(?:的)?)?(?:示意样例|示意图|演示图|样例)(?:[，,]\s*(?:仅供参考|仅供识别|仅练习上传|仅供练习上传|不作本轮现场证据|不作为本轮现场证据|不能作为现场证据))*[。]?/gu
export function operationalText(value){
 if(typeof value!=='string')return ''
 return value.replace(/^(?:【虚构演示】|\[虚构演示\]|(?:练习记录|演示记录)[：:])\s*/u,'').replace(imageFraming,'').trim().replace(/^[；;，,]\s*/u,'')
}
