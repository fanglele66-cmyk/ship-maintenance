// Factual overview and interpretation occupy separate existing text slots.
const copy={
 'real-alarm-0430':{phenomenon:'二缸排气温度与其余气缸分离，船端记录流量活塞报警。',judgement:'排温采样早于报警6秒；两者需按原时标对应，当前资料尚未定位故障部件。'},
 'real-warning-0523':{phenomenon:'两个主机控制空气进口压力测点同期下降，普通监测通道触发连续低压预警。',judgement:'两个测点都在主机进口，不能用它们的差值代替减压阀前后压降。'},
 'real-tracking-exhaust-baseline':{phenomenon:'一缸月度相对排温从4月开始偏高，延续至8月已覆盖样本。',judgement:'这是相对其余五缸均值的长期变化；8月数据未覆盖全月，单次绝对温度正常不能否定该变化。'},
 'real-health-c4-baseline':{phenomenon:'四缸相对其余五缸的月度排温偏差在5—6月间下移，后续月份仍偏低。',judgement:'相对偏差下移不等于绝对排温持续下降；还需区分四缸自身变化与参照气缸均值变化。'}
}
export const initialBriefText=brief=>copy[brief.id]||{phenomenon:brief.discovery?.text||'',judgement:brief.boundary||''}
