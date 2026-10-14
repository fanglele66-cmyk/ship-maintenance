"""Read-only source analysis. Emit statistics and a bounded cruise motion profile.

Uses the existing DC mapping. Exported values are centered deviations, not live
telemetry or OEM thresholds. Original ZIP/CSV files are never modified.
"""
import sys, zipfile, json
import pandas as pd
import numpy as np

archive=sys.argv[1]
channels=['DC0001','DC0008','DC0009','DC0010','DC0028','DC0029','DC0041','DC0042','DC0045','DC0046','DC0059']
with zipfile.ZipFile(archive) as z:
    member='sensor_csv_202603_to_202610/sensor_readings_2026-10.csv'
    with z.open(member) as f:
        df=pd.read_csv(f,usecols=['timestamp']+channels)
df['timestamp']=pd.to_datetime(df.timestamp)
df=df.sort_values('timestamp').drop_duplicates('timestamp').set_index('timestamp')
cruise=df[(df.DC0001>=85)&(df.DC0001<=110)]
stats={'rows':len(df),'start':str(df.index[0]),'end':str(df.index[-1]),'intervalMedianSeconds':float(df.index.to_series().diff().dt.total_seconds().median()),'cruiseRows':len(cruise),'channels':{}}
for key in channels:
    a=cruise[key]
    stats['channels'][key]={'p05':round(float(a.quantile(.05)),4),'p50':round(float(a.median()),4),'p95':round(float(a.quantile(.95)),4),'unchangedFraction':round(float((a.diff()==0).mean()),3)}
# Resample using within-bucket medians, retaining missing data as missing.
grid=df.resample('30s').median()
valid=grid.notna().all(axis=1)&grid.DC0001.between(85,110)
groups=(~valid).cumsum()
runs=[block for _,block in grid[valid].groupby(groups[valid]) if len(block)>=240]
if not runs:raise ValueError('No continuous >=2h cruise interval found; do not silently interpolate port/stop gaps.')
# Prefer a genuinely varying but bounded cruise block; no startup/stop replay.
run=max(runs,key=lambda b:len(b))
window=run.iloc[:min(2880,len(run))]
stats['selected']={'start':str(window.index[0]),'end':str(window.index[-1]),'samples':len(window),'rpmRange':[float(window.DC0001.min()),float(window.DC0001.max())]}
matrix=window[channels].to_numpy()
centers=np.median(matrix,axis=0)
# Preserve channel timing, pauses, nonuniform increments and inter-channel links.
deviations=matrix-centers
scale=np.quantile(np.abs(deviations),.95,axis=0)
denominator=np.where(scale>1e-9,scale,1.)
normalized=np.clip(deviations/denominator,-2.5,2.5)
profile={'stepSeconds':30,'channels':channels,'sourcePeriod':stats['selected'],'sourceCenters':centers.tolist(),'sourceP95Deviation':scale.tolist(),'frames':np.round(normalized,4).tolist()}
print(json.dumps({'statistics':stats,'profile':profile},ensure_ascii=False))
