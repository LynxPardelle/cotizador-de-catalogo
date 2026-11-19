import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';

export interface InterestRequest {
  requestId:string;organizationName:string;contactEmail:string;sector:string;
  currentMethod:string;monthlyQuotes:string;twoParticipants:string;timeAvailability:string;
  contactConsent:true;privacyVersion:string;
}
export interface InterestReceipt {reference:string;status:'received'}
@Injectable({providedIn:'root'})
export class InterestApi {
  private readonly http=inject(HttpClient);
  submit(body:InterestRequest){return firstValueFrom(this.http.post<InterestReceipt>('/api/v1/pilot-interest',body,{transferCache:false}));}
}
