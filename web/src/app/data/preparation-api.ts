import {HttpClient,HttpParams} from '@angular/common/http';
import {inject,Injectable} from '@angular/core';
import {firstValueFrom} from 'rxjs';

export interface PreparationAgreements {participants:boolean;references:boolean;sessions:boolean;support:boolean;evidence:boolean}
export type AgreementKey=keyof PreparationAgreements;
export interface PreparationRecord {version:number;workspaceId:string|null;linkedAt:string|null;catalog:{catalogId:string;version:number}|null;agreements:PreparationAgreements;plannedStartDate:string;updatedAt:string}
export interface PreparationReadiness {state:'awaiting_link'|'preparing'|'ready'|'blocked';checkedAt:string;access:{adminReady:boolean;sellerReady:boolean;verifiedMembers:number};catalog:{ready:boolean;catalogId?:string;version?:number;name?:string;validUntil?:string;productCount?:number};pending:string[]}
export interface PreparationView {reference:string;organizationName:string;expiresAt:number;preparation:PreparationRecord;readiness:PreparationReadiness;adminWorkspaces?:{workspaceId:string;label:string}[]}
export interface PreparationHistory {mutationId:string;version:number;kind:'link'|'catalog'|'agreements';actorKey:string;createdAt:string;workspaceId?:string;catalog?:{catalogId:string;version:number};agreements?:PreparationAgreements;plannedStartDate?:string;consentVersion?:string}
interface MutationBase {mutationId:string;expectedVersion:number}
export interface PreparationLink extends MutationBase {workspaceId:string;participationConsent:true;sharingConsent:true;consentVersion:string}
export interface PreparationCatalog extends MutationBase {catalogId:string;version:number;catalogAuthorized:true;consentVersion:string}
export interface PreparationAgreementUpdate extends MutationBase {agreements:PreparationAgreements;plannedStartDate:string}
export type PreparationMutation=PreparationLink|PreparationCatalog|PreparationAgreementUpdate;
export type PreparationMutationKind='link'|'catalog'|'agreements';

@Injectable({providedIn:'root'})
export class PreparationApi {
 private readonly http=inject(HttpClient);
 private operator(reference:string){return `/api/v1/pilot-applications/${encodeURIComponent(reference)}/preparation`;}
 private contact(reference:string){return `/api/v1/pilot-onboarding/${encodeURIComponent(reference)}`;}
 view(reference:string,operator:boolean){return firstValueFrom(this.http.get<PreparationView>(operator?this.operator(reference):this.contact(reference),{transferCache:false}));}
 history(reference:string,cursor=''){const params=cursor?new HttpParams().set('cursor',cursor):new HttpParams();return firstValueFrom(this.http.get<{items:PreparationHistory[];nextCursor:string|null}>(`${this.operator(reference)}/history`,{params,transferCache:false}));}
 update(reference:string,kind:PreparationMutationKind,body:Readonly<PreparationMutation>){return firstValueFrom(kind==='agreements'?this.http.patch<PreparationView>(this.operator(reference),body,{transferCache:false}):this.http.post<PreparationView>(`${this.contact(reference)}/${kind}`,body,{transferCache:false}));}
}
