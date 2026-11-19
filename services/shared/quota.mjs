import catalog from './plans.json' with {type:'json'};
import { HttpError } from './errors.mjs';

export function planFor(id='esencial') {
  const plan=catalog.plans.find(plan=>plan.id===id);
  if(!plan || Object.values(plan.limits).some(limit=>!Number.isSafeInteger(limit) || limit<1)) throw new HttpError(503,'PLAN_UNAVAILABLE','No pudimos validar los límites del espacio de trabajo.');
  return {id:plan.id,name:plan.name,limits:structuredClone(plan.limits)};
}
export function usageMetric(used,limit) {
  if(!Number.isSafeInteger(used) || used<0 || !Number.isSafeInteger(limit) || limit<1) throw new Error('Invalid quota metric');
  const state=used>limit ? 'over' : used===limit ? 'limit' : used*100>=limit*80 ? 'warning' : 'normal';
  return {used,limit,remaining:Math.max(0,limit-used),state};
}
export function quotaExceeded(metric) {
  const error=new HttpError(409,'PLAN_LIMIT_REACHED','Este espacio alcanzó el límite del plan. Revisa el consumo; el piloto no realiza cobros ni ampliaciones automáticas.');
  if(metric) error.metric=metric;
  return error;
}
export function monthlyPeriod(date=new Date()) {
  if(!(date instanceof Date) || !Number.isFinite(date.getTime())) throw new Error('Invalid quota period');
  const year=date.getUTCFullYear(),month=date.getUTCMonth();
  return {key:`${year}-${String(month+1).padStart(2,'0')}`,startsAt:new Date(Date.UTC(year,month,1)).toISOString(),resetsAt:new Date(Date.UTC(year,month+1,1)).toISOString()};
}
