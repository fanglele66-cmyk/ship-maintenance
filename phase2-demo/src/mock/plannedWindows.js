// Product fixtures, independent of live voyage planning systems.
export const plannedWindows=[
 {id:'CBY-261028-SH',voyage:'CBY2610-08',port:'上海港',start:'2026-10-28T08:00',end:'2026-10-28T18:00',conditions:'靠泊后停机，完成作业许可、燃油与伺服油隔离卸压；检修与复核人员到位。'},
 {id:'CBY-261030-NB',voyage:'CBY2610-09',port:'宁波舟山港',start:'2026-10-30T07:00',end:'2026-10-30T15:00',conditions:'靠泊待货窗口，安排仪表独立校验及接线检查；复测时间与开航准备协调。'},
 {id:'CBY-261102-GZ',voyage:'CBY2611-01',port:'广州港',start:'2026-11-02T09:00',end:'2026-11-02T21:00',conditions:'靠泊检修窗口，提前核对备件和校验设备，复装与验收在离港前完成。'},
].map(window=>({...window,label:`${window.voyage} · ${window.port} · ${window.start.replace('T',' ')}—${window.end.slice(11)}`}))
