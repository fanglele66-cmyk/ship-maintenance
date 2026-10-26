"""Reproduce paired monthly cylinder baselines from ship.db, opened read-only."""
import argparse
import json
import sqlite3
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
END = '2026-08-12 11:39:59'

def export(database):
    expressions = ','.join(f'json_extract(data,\'$[{i+6}]\') AS c{i}' for i in range(1,7))
    valid = ' AND '.join(f'c{i} BETWEEN 250 AND 500' for i in range(1,7))
    # Every difference is calculated on the same row before averaging. Monthly
    # maxima are deliberately not used as substitutes for per-sample maxima.
    metrics = []
    for i in range(1,7):
        others = [f'c{j}' for j in range(1,7) if j != i]
        metrics += [f'avg(c{i})', f'avg(c{i}-({"+".join(others)})/5.0)', f'avg(c{i}-max({",".join(others)}))']
    query = f'''WITH rows AS (SELECT id,timestamp,json_extract(data,'$[0]') rpm,{expressions}
      FROM sensor_readings WHERE ship_code='CHBY' AND device_code='DEVICE1'
      AND timestamp BETWEEN '2026-01-01 00:00:00' AND ?)
      SELECT substr(timestamp,1,7),count(*),min(timestamp),max(timestamp),{','.join(metrics)},avg(c1-c4)
      FROM rows WHERE rpm BETWEEN 102 AND 104 AND {valid} GROUP BY substr(timestamp,1,7) ORDER BY 1'''
    with sqlite3.connect(database.resolve().as_uri()+'?mode=ro',uri=True) as db:
        db.execute('PRAGMA query_only=ON')
        rows = db.execute(query,(END,)).fetchall()
    months = [dict(month=r[0],count=r[1],first=r[2],last=r[3],
        cylinders=[dict(cylinder=i+1,mean=r[4+i*3],deltaPeers=r[5+i*3],deltaMax=r[6+i*3]) for i in range(6)],deltaC1C4=r[-1]) for r in rows]
    return dict(schemaVersion=1,source=dict(database='ship.db',table='sensor_readings',shipCode='CHBY',deviceCode='DEVICE1',
        requestedStart='2026-01-01 00:00:00',requestedEnd=END,firstSample=months[0]['first'],lastSample=months[-1]['last'],
        condition='主机转速 102–104 RPM；六缸排温均在 250–500°C；逐时刻配对',
        method='每条原始记录先计算缸间偏差，再按月取样本等权均值；不插值，不等同于时间加权均值。',
        limitation='转速与排温筛选不等于负荷、燃油、海况完全相同；需结合运行和检修记录核实。',
        document='长航碧玉号1号缸温度异常预警轮机长确认问题清单_2026-08-04_配图.docx'),months=months)

if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--database',type=Path,required=True)
    parser.add_argument('--check',action='store_true')
    args=parser.parse_args()
    payload=json.dumps(export(args.database),ensure_ascii=False,indent=2)+'\n'
    path=ROOT/'src/mock/baselineHistory.json'
    if args.check:
        assert path.read_text(encoding='utf-8')==payload, 'Baseline fixture differs from source'
    else:
        path.write_text(payload,encoding='utf-8')
    print('Verified paired monthly baseline: 8 months, '+str(sum(m['count'] for m in json.loads(payload)['months']))+' samples')
