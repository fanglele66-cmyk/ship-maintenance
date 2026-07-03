/**
 * 知识库 Mock 数据 - FSC/PSC 船舶安全检查缺陷知识库
 */
export const fscData = [
  {
    id: 'FSC-0402-01',
    category: '4. 消防/救生设备',
    subcategory: '4.2 消防栓与消防总管',
    component: '应急消防泵隔离阀',
    severity: 'bad',
    score: 5,
    law_basis: 'SOLAS Ch.II-2 / Reg.10：消防总管上的隔离阀应设在机舱之外的易到达且安全的位置，确保机舱着火时能隔离机舱内管路并由应急泵供水。',
    standard_description: '机舱应急消防泵隔离阀损坏，现场手动及远程均无法有效关闭，导致无法将机舱内管路与外部主消防总管进行有效隔离。',
    rectification_advice: '立即拆卸检修隔离阀传动机构，更换磨损或锈蚀的阀芯与密封圈，确保手动或远程控制能顺畅切换并严密关闭。整改后进行出水压力联动测试。'
  },
  {
    id: 'FSC-0105-02',
    category: '1. 驾驶台/甲板部',
    subcategory: '1.5 航行仪器',
    component: '雷达 / 自动雷达标绘仪 (ARPA)',
    severity: 'warn',
    score: 2,
    law_basis: 'SOLAS Ch.V / Reg.19：所有3000总吨及以上的船舶应配备一套9GHz雷达和一套独立的3GHz雷达，且两套雷达均应具备电子标绘功能。',
    standard_description: '驾驶台3GHz（S波段）雷达在航行测试中发现存在严重杂波干扰，目标捕捉与性能监测（PM）指示器读数偏低，无法正常标绘远距离物标。',
    rectification_advice: '联系通导工程师对磁控管进行寿命检查与更换，清洁波导管接口，重新校准雷达天线增益与抑制参数，确保性能完全恢复并在航行日志中记录。'
  },
  {
    id: 'FSC-0501-03',
    category: '5. 机舱/轮机部',
    subcategory: '5.1 主机及起动系统',
    component: '主机高压燃油管漏油报警',
    severity: 'bad',
    score: 5,
    law_basis: 'SOLAS Ch.II-2 / Reg.4.2.5：所有高压燃油外接管路应采用能够容纳漏泄燃油的护套管路系统加以保护，且应设有漏油集聚报警装置。',
    standard_description: '主机No.3缸高压油管外套保护管排油口至集油罐的监测管路发生机械性堵塞，导致漏油报警装置失效，存在燃油喷溅至高温表面引发火灾的重大安全隐患。',
    rectification_advice: '停机后疏通漏油集管与报警传感器的排油通路，清洗油位浮子开关，更换损坏的防护外套，确保一旦发生微量漏油能立刻触发集控室声光报警。'
  },
  {
    id: 'FSC-0101-04',
    category: '1. 驾驶台/甲板部',
    subcategory: '1.1 航行灯与信号灯',
    component: '舷灯遮光板与角度校验',
    severity: 'warn',
    score: 2,
    law_basis: 'COLREGs / Rule 21-23：航行灯应在规定水平弧度范围内显示规定颜色，左右舷灯从船首方向分别显示112.5°，遮光板须确保灯光截止精确。',
    standard_description: '左舷红灯遮光板锈蚀变形，灯光截止角度超出规定范围约8°，存在夜间被误判船舶动态的碰撞风险。',
    rectification_advice: '校正或更换左舷灯遮光板，使用角度仪在暗室或夜间实测灯光截止边界，确保112.5°内精准显示并填入航海日志灯检记录。'
  },
  {
    id: 'FSC-0401-05',
    category: '4. 消防/救生设备',
    subcategory: '4.1 固定式灭火系统',
    component: 'CO₂灭火系统释放报警',
    severity: 'bad',
    score: 5,
    law_basis: 'SOLAS Ch.II-2 / Reg.5.2：固定式气体灭火系统应在释放灭火剂之前和释放期间向被保护处所内的人员发出声光报警信号。',
    standard_description: '机舱CO₂释放预报警蜂鸣器故障，测试时声压级不足85dB(A)且闪光灯不亮，预报警延时功能失效，无法确保释放前人员安全撤离。',
    rectification_advice: '更换报警蜂鸣器与闪光灯组件，校准延时继电器设定为30秒预报警周期，完成系统联动测试并在CO₂间张贴最新的操作流程图。'
  },
  {
    id: 'FSC-0503-06',
    category: '5. 机舱/轮机部',
    subcategory: '5.3 油水分离器',
    component: '15ppm油份浓度报警装置',
    severity: 'warn',
    score: 3,
    law_basis: 'MARPOL Annex I / Reg.14：船舶应配备经认可的15ppm舱底水报警装置，当排出物含油量超过15ppm时应自动停止向舷外排放。',
    standard_description: '15ppm报警装置最近一次校准标定记录已过期超过60天，设备显示屏对比度偏低，测试纸带即将耗尽，无法确认当前排放监测精度。',
    rectification_advice: '预约厂家技术人员携带标准油样上门进行15ppm三点校准，更换打印机纸带卷，清洁光学检测池玻璃窗口，更新校准铭牌与记录日志。'
  },
  {
    id: 'FSC-0103-07',
    category: '1. 驾驶台/甲板部',
    subcategory: '1.3 电子海图与出版物',
    component: '电子海图显示与信息系统 (ECDIS)',
    severity: 'bad',
    score: 4,
    law_basis: 'SOLAS Ch.V / Reg.19 & Reg.27：船舶应配备经更新的电子海图，驾驶员应熟悉ECDIS操作，包括航线规划、安全水深设置及偏航报警。',
    standard_description: 'ECDIS系统内ENC海图许可证书已过期，部分航线区域图表仍使用未更新的RNC格式，安全等深线设置不正确，偏航报警灵敏度调至最低等级。',
    rectification_advice: '联系AVCS/ADMIRALTY更新ENC许可，导入最新周版通告校正版数据，重置安全等深线为20m，偏航报警恢复至300m标准灵敏度，甲板部全员完成ECDIS再培训。'
  },
  {
    id: 'FSC-0403-08',
    category: '4. 消防/救生设备',
    subcategory: '4.3 救生艇与释放装置',
    component: '救生艇释放钩及承载释放',
    severity: 'bad',
    score: 5,
    law_basis: 'SOLAS Ch.III / Reg.16 & LSA Code 4.4.7.6：救生艇承载释放装置应在艇完全浮于水面或艇钩无载荷时方可操作，并应设有静水压力联锁装置。',
    standard_description: '左舷救生艇承载释放钩液压联锁保护失效，静水压力联锁传感器接线端严重腐蚀，艇内遥控释放手柄固定螺栓缺失，存在意外脱钩的重大安全隐患。',
    rectification_advice: '拆检并更换静水压力联锁传感器的腐蚀接线端子，补充缺失的固定螺栓并涂抹防松胶，按照LSA Code要求进行5年一次的1.1倍满载释放钩载荷试验。'
  },
  {
    id: 'FSC-0502-09',
    category: '5. 机舱/轮机部',
    subcategory: '5.2 发电机组及配电板',
    component: '主配电板绝缘监测仪',
    severity: 'warn',
    score: 2,
    law_basis: 'SOLAS Ch.II-1 / Reg.45 & IEC 60092-202：主配电板应装设接地故障监测装置，对绝缘电阻进行连续监测并在绝缘过低时发出报警。',
    standard_description: '主配电板绝缘监测仪LCD面板显示"通信故障"且无法切换到人工测试模式，最近三个月手动绝缘记录缺失，无法核电网各支路绝缘状况。',
    rectification_advice: '重启绝缘监测仪并重新配置通信地址与波特率，逐段断开各汇流排支路进行人工500V绝缘摇表测试，建立绝缘监视台账并恢复定期自检记录制度。'
  },
  {
    id: 'FSC-0201-10',
    category: '2. 货舱/甲板及系泊',
    subcategory: '2.1 货舱通风与关闭装置',
    component: '货舱通风筒防火挡板',
    severity: 'warn',
    score: 3,
    law_basis: 'SOLAS Ch.II-2 / Reg.5.2.1.1：所有通风系统的主要进风口和出风口应能从被保护处所的外部予以关闭，关闭装置应能在起火时有效阻止空气进入。',
    standard_description: 'No.2货舱左舷通风筒防火挡板转轴严重锈蚀，手动关闭手柄无法全行程操作，挡板关闭后仍有约15mm间隙，无法达到气密要求。',
    rectification_advice: '拆下通风筒防火挡板组件，对转轴进行除锈润滑或更换不锈钢轴套，调整挡板限位螺栓确保全关后零间隙，做烟雾穿透测试验证气密性。'
  }
]

/** 分类树结构 */
export const categoryTree = [
  {
    key: '1', label: '1. 驾驶台/甲板部',
    children: [
      { key: '1.1', label: '1.1 航行灯与信号灯' },
      { key: '1.3', label: '1.3 电子海图与出版物' },
      { key: '1.5', label: '1.5 航行仪器' }
    ]
  },
  {
    key: '2', label: '2. 货舱/甲板及系泊',
    children: [
      { key: '2.1', label: '2.1 货舱通风与关闭装置' }
    ]
  },
  {
    key: '4', label: '4. 消防/救生设备',
    children: [
      { key: '4.1', label: '4.1 固定式灭火系统' },
      { key: '4.2', label: '4.2 消防栓与消防总管' },
      { key: '4.3', label: '4.3 救生艇与释放装置' }
    ]
  },
  {
    key: '5', label: '5. 机舱/轮机部',
    children: [
      { key: '5.1', label: '5.1 主机及起动系统' },
      { key: '5.2', label: '5.2 发电机组及配电板' },
      { key: '5.3', label: '5.3 油水分离器' }
    ]
  }
]

/** 严重程度映射 */
export const severityMap = {
  bad:  { label: '严重', bg: '#ff4d4f1f', color: '#ff4d4f', cls: 'sev-bad' },
  warn: { label: '普通', bg: '#faad141f', color: '#faad14', cls: 'sev-warn' },
  ok:   { label: '轻微', bg: '#52c41a1f', color: '#52c41a', cls: 'sev-ok' }
}
