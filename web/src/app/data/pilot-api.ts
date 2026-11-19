import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
export type CorrectionReason='quantity'|'options'|'catalog'|'pricing'|'other';
export interface Correction {correctionId:string;quoteId:string;reason:CorrectionReason;reportedAt:string}
export interface PilotMetrics {
  window:{days:number;startsAt:string;endsAt:string;asOf:string};totalIssued:number;activeIssuers:number;missingIssuerCount:number;
  time:{sampleSize:number;missingCount:number;meanMs:number|null;medianMs:number|null};adjustments:{total:number;quotesWithAdjustments:number};
  corrections:{total:number;affectedQuotes:number;byReason:Record<CorrectionReason,number>};daily:{date:string;issued:number;corrections:number}[];
}
@Injectable({providedIn:'root'})
export class PilotApi {
  private readonly http=inject(HttpClient);
  metrics(days:number){return firstValueFrom(this.http.get<PilotMetrics>('/api/v1/quotes/metrics',{params:{days},transferCache:false}));}
  correction(quoteId:string,body:{correctionId:string;reason:CorrectionReason}){return firstValueFrom(this.http.post<Correction>(`/api/v1/quotes/${encodeURIComponent(quoteId)}/corrections`,body));}
}
export const correctionLabels:Record<CorrectionReason,string>={quantity:'Cantidades',options:'Opciones',catalog:'Catálogo o versión',pricing:'Reglas o importes',other:'Otro motivo'};
