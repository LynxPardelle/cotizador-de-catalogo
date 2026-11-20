import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { InterestRequest } from './interest-api';

export interface ApplicationReview { status:string;version:number;updatedAt:string;nextActionDate:string }
export interface ApplicationSummary { reference:string;organizationName:string;sector:string;createdAt:string;expiresAt:number;review:ApplicationReview }
export interface ApplicationDetail { reference:string;application:InterestRequest & {createdAt:string;expiresAt:number;status:string};review:ApplicationReview }
export interface ApplicationHistory { mutationId:string;version:number;previousStatus:string;status:string;previousNextActionDate:string;nextActionDate:string;note:string;actorKey:string;createdAt:string }
export interface ReviewUpdate { mutationId:string;expectedVersion:number;status:string;nextActionDate:string;note:string }
export interface Page<T> { items:T[];nextCursor:string|null }

@Injectable({providedIn:'root'})
export class ApplicationsApi {
  private readonly http=inject(HttpClient);private readonly base='/api/v1/pilot-applications';
  context(){return firstValueFrom(this.http.get<{allowed:true}>(`${this.base}/context`,{transferCache:false}));}
  list(status:string,cursor=''){
    let params=new HttpParams().set('status',status);if(cursor)params=params.set('cursor',cursor);
    return firstValueFrom(this.http.get<Page<ApplicationSummary>&{scannedCount:number}>(this.base,{params,transferCache:false}));
  }
  detail(reference:string){return firstValueFrom(this.http.get<ApplicationDetail>(`${this.base}/${encodeURIComponent(reference)}`,{transferCache:false}));}
  history(reference:string,cursor=''){
    const params=cursor?new HttpParams().set('cursor',cursor):new HttpParams();
    return firstValueFrom(this.http.get<Page<ApplicationHistory>>(`${this.base}/${encodeURIComponent(reference)}/history`,{params,transferCache:false}));
  }
  update(reference:string,body:Readonly<ReviewUpdate>){return firstValueFrom(this.http.patch<{reference:string;review:ApplicationReview}>(`${this.base}/${encodeURIComponent(reference)}`,body,{transferCache:false}));}
}
