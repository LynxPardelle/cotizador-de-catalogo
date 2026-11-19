import { computed, inject, Injectable, signal } from '@angular/core';
import { Auth } from '../../core/auth';
import { RuntimeConfig } from '../../core/runtime-config';
import { WorkspaceContext } from '../../core/workspace-context';
import { apiMessage } from '../../data/catalog-api';
import { PilotApi, PilotMetrics } from '../../data/pilot-api';
@Injectable({providedIn:'root'})
export class PilotContext {
  private readonly api=inject(PilotApi);private readonly auth=inject(Auth);private readonly workspace=inject(WorkspaceContext);private readonly config=inject(RuntimeConfig);
  private generation=0;private readonly snapshot=signal<{scope:string;value:PilotMetrics}|undefined>(undefined);
  readonly busy=signal(false);readonly error=signal('');readonly days=signal(30);
  private scope(){return `${this.workspace.sessionVersion()}:${this.workspace.activeOrganizationId()}`;}
  readonly data=computed(()=>{const saved=this.snapshot();return this.auth.available&&this.auth.role==='admin'&&saved?.scope===this.scope()?saved.value:undefined;});
  async load(days=this.days()){
    if(!this.config.browser||!this.auth.available||this.auth.role!=='admin'||!this.workspace.activeOrganizationId()){this.reset();return;}
    if(![7,30,90].includes(days))return;
    const current=++this.generation;const scope=this.scope();this.days.set(days);this.busy.set(true);this.error.set('');this.snapshot.set(undefined);
    try{const data=await this.api.metrics(days);if(current===this.generation&&scope===this.scope()&&this.auth.available&&this.auth.role==='admin')this.snapshot.set({scope,value:data});}
    catch(error){if(current===this.generation&&scope===this.scope()&&this.auth.available&&this.auth.role==='admin')this.error.set(apiMessage(error));}
    finally{if(current===this.generation)this.busy.set(false);}
  }
  reset(){this.generation++;this.snapshot.set(undefined);this.busy.set(false);this.error.set('');}
}
