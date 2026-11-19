import { HttpError, badRequest } from '../../shared/errors.mjs';
import { validPilot } from '../../shared/http.mjs';

export const correctionReasons=['quantity','options','catalog','pricing','other'];
export function pilotWindow(days,now=new Date()) {
  if(![7,30,90].includes(days) || !(now instanceof Date) || !Number.isFinite(now.getTime())) throw badRequest('Selecciona un período de 7, 30 o 90 días.');
  const today=Date.UTC(now.getUTCFullYear(),now.getUTCMonth(),now.getUTCDate());
  return {days,startsAt:new Date(today-(days-1)*86400000).toISOString(),endsAt:new Date(today+86400000).toISOString(),asOf:now.toISOString()};
}
export function metricsDays(event) {
  const query=new URLSearchParams(event.rawQueryString ?? '');
  if(query.getAll('days').length>1) throw badRequest('Indica un solo período.');
  const supplied=event.queryStringParameters?.days ?? query.get('days');
  if(supplied===null || supplied===undefined) return 30;
  if(!['7','30','90'].includes(supplied)) throw badRequest('Selecciona un período de 7, 30 o 90 días.');
  return Number(supplied);
}
function timestamp(value) {
  const result=typeof value==='string' ? Date.parse(value) : NaN;
  if(!Number.isFinite(result)) throw new HttpError(503,'METRICS_UNAVAILABLE','No pudimos comprobar las fechas del histórico del piloto.');
  return result;
}
export function summarizePilotMetrics(quoteRecords,correctionEvents,window) {
  const start=Date.parse(window.startsAt),end=Date.parse(window.endsAt);
  const daily=Array.from({length:window.days},(_,index)=>({date:new Date(start+index*86400000).toISOString().slice(0,10),issued:0,corrections:0}));
  const byDay=new Map(daily.map(day=>[day.date,day]));
  let totalIssued=0,missingIssuerCount=0,adjustments=0,quotesWithAdjustments=0;
  const issuers=new Set();const durations=[];
  for(const record of quoteRecords) {
    const quote=record.quote;const issuedAt=timestamp(quote?.issuedAt);if(issuedAt<start || issuedAt>=end) continue;
    totalIssued++;byDay.get(new Date(issuedAt).toISOString().slice(0,10)).issued++;
    if(typeof record.actorKey==='string' && /^[0-9a-f]{64}$/i.test(record.actorKey)) issuers.add(record.actorKey);else missingIssuerCount++;
    if(validPilot(quote.pilot)) {
      durations.push(quote.pilot.activeDurationMs);adjustments+=quote.pilot.adjustments;if(quote.pilot.adjustments>0) quotesWithAdjustments++;
    }
  }
  durations.sort((a,b)=>a-b);
  const sampleSize=durations.length;const middle=Math.floor(sampleSize/2);
  const byReason=Object.fromEntries(correctionReasons.map(reason=>[reason,0]));const affected=new Set();let corrections=0;
  for(const correction of correctionEvents) {
    const reportedAt=timestamp(correction?.reportedAt);if(reportedAt<start || reportedAt>=end) continue;
    corrections++;affected.add(correction.quoteId);
    byReason[correctionReasons.includes(correction.reason) ? correction.reason : 'other']++;
    byDay.get(new Date(reportedAt).toISOString().slice(0,10)).corrections++;
  }
  return {window,totalIssued,activeIssuers:issuers.size,missingIssuerCount,
    time:{sampleSize,missingCount:totalIssued-sampleSize,meanMs:sampleSize ? durations.reduce((sum,value)=>sum+value,0)/sampleSize : null,medianMs:sampleSize ? sampleSize%2 ? durations[middle] : (durations[middle-1]+durations[middle])/2 : null},
    adjustments:{total:adjustments,quotesWithAdjustments},corrections:{total:corrections,affectedQuotes:affected.size,byReason},daily};
}
