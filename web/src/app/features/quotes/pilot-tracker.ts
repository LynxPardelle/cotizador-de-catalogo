import { isPlatformBrowser } from '@angular/common';
import { effect, inject, Injectable, InjectionToken, PLATFORM_ID, untracked } from '@angular/core';
import { Auth } from '../../core/auth';
import { WorkspaceContext } from '../../core/workspace-context';
import { QuoteRequest } from '../../data/contracts';
export interface PilotMeasurement { flowId: string; activeDurationMs: number; adjustments: number }
export class FlowMeasurement {
  private started=false;private active=true;private cursor=0;private lastInteraction=0;private elapsed=0;private flowId='';private adjustments=0;private lastPreview='';private frozen:PilotMeasurement|undefined;
  constructor(private readonly now:()=>number,private readonly newId:()=>string){}
  private accrue(now:number){if(this.started&&this.active&&!this.frozen)this.elapsed+=Math.max(0,Math.min(now,this.lastInteraction+60000)-this.cursor);this.cursor=now;}
  interact(){const now=this.now();if(!this.started){this.started=true;this.flowId=this.newId();this.cursor=now;}else this.accrue(now);this.lastInteraction=now;}
  setActive(active:boolean){this.accrue(this.now());this.active=active;}
  previewSucceeded(configuration:string){if(this.lastPreview&&this.lastPreview!==configuration)this.adjustments=Math.min(1000,this.adjustments+1);this.lastPreview=configuration;}
  configurationEdited(configuration:string){if(this.frozen&&configuration!==this.lastPreview)this.reset();this.interact();}
  freeze():PilotMeasurement{if(this.frozen)return this.frozen;if(!this.started)this.interact();this.accrue(this.now());return this.frozen=Object.freeze({flowId:this.flowId,activeDurationMs:Math.min(28800000,Math.max(0,Math.floor(this.elapsed))),adjustments:this.adjustments});}
  reset(){this.started=false;this.cursor=0;this.lastInteraction=0;this.elapsed=0;this.flowId='';this.adjustments=0;this.lastPreview='';this.frozen=undefined;}
}

export const PILOT_CLOCK=new InjectionToken<()=>number>('Monotonic pilot clock',{providedIn:'root',factory:()=>()=>performance.now()});
export const configurationKey=(request:QuoteRequest)=>JSON.stringify({catalogId:request.catalogId,version:request.version,currency:request.currency,items:request.items.map(item=>({...item,optionIds:[...item.optionIds].sort()})).sort((a,b)=>a.productId.localeCompare(b.productId))});
@Injectable({providedIn:'root'})
export class PilotTracker {
  private readonly browser=isPlatformBrowser(inject(PLATFORM_ID));private readonly auth=inject(Auth);private readonly workspace=inject(WorkspaceContext);
  private readonly measurement=new FlowMeasurement(inject(PILOT_CLOCK),()=>crypto.randomUUID());private scope=this.scopeKey();
  constructor(){effect(()=>{const scope=this.scopeKey();const available=this.auth.available;untracked(()=>{if(scope!==this.scope||!available){this.measurement.reset();this.scope=scope;}});});}
  private scopeKey(){return `${this.workspace.sessionVersion()}:${this.workspace.activeOrganizationId()}`;}
  private allowed(){const current=this.scopeKey();if(current!==this.scope){this.measurement.reset();this.scope=current;}if(!this.browser||!this.auth.available){this.measurement.reset();return false;}return true;}
  interact(){if(this.allowed())this.measurement.interact();}
  configurationEdited(request:QuoteRequest){if(this.allowed())this.measurement.configurationEdited(configurationKey(request));}
  setActive(active:boolean){if(this.browser)this.measurement.setActive(active);}
  previewSucceeded(request:QuoteRequest){if(this.allowed())this.measurement.previewSucceeded(configurationKey(request));}
  freeze(){return this.allowed()?this.measurement.freeze():undefined;}
  reset(){this.measurement.reset();this.scope=this.scopeKey();}
}
