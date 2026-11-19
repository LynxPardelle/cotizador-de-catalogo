import { DatePipe } from '@angular/common';
import { afterNextRender, Component, computed, DestroyRef, effect, inject, signal, untracked } from '@angular/core';
import { FormField, form } from '@angular/forms/signals';
import { RouterLink } from '@angular/router';
import { Auth } from '../../core/auth';
import { UsageContext } from '../../core/usage-context';
import { WorkspaceContext } from '../../core/workspace-context';
import { correctionLabels, CorrectionReason } from '../../data/pilot-api';
import { PilotContext } from './pilot-context';
@Component({imports:[DatePipe,FormField,RouterLink],templateUrl:'./pilot.html'})
export class Pilot {
  protected readonly auth=inject(Auth);protected readonly metrics=inject(PilotContext);protected readonly usage=inject(UsageContext);private readonly workspace=inject(WorkspaceContext);
  protected readonly model=signal({days:'30'});protected readonly fields=form(this.model);private readonly ready=signal(false);
  private readonly clock=signal(Date.now());protected readonly signedIn=computed(()=>{this.clock();return this.auth.available;});
  protected readonly reasons=Object.entries(correctionLabels).map(([id,label])=>({id:id as CorrectionReason,label}));
  constructor(){const destroy=inject(DestroyRef);afterNextRender(()=>{this.ready.set(true);const timer=setInterval(()=>this.clock.set(Date.now()),1000);destroy.onDestroy(()=>clearInterval(timer));});effect(()=>{const ready=this.ready();const days=Number(this.model().days);this.workspace.activeOrganizationId();this.workspace.sessionVersion();const available=this.signedIn();const role=this.auth.role;if(ready)untracked(()=>{if(available&&role==='admin'){void this.metrics.load(days);void this.usage.load();}else this.metrics.reset();});});}
  protected duration(value:number|null){if(value===null)return 'Sin muestra';const seconds=Math.max(0,Math.round(value/1000));return seconds<60?`${seconds} s`:`${Math.floor(seconds/60)} min ${seconds%60} s`;}
}
