import { computed, inject, Injectable, signal } from '@angular/core';
import { Auth } from './auth';
import { RuntimeConfig } from './runtime-config';
import { WorkspaceContext } from './workspace-context';
import { ApplicationsApi } from '../data/applications-api';

@Injectable({providedIn:'root'})
export class ApplicationsAccess {
  private readonly auth=inject(Auth);private readonly config=inject(RuntimeConfig);private readonly workspace=inject(WorkspaceContext);private readonly api=inject(ApplicationsApi);
  private generation=0;private readonly grantedSession=signal(-1);
  readonly state=signal<'unknown'|'allowed'|'denied'|'error'>('unknown');readonly busy=signal(false);
  readonly allowed=computed(()=>this.auth.available&&this.grantedSession()===this.workspace.sessionVersion()&&this.state()==='allowed');
  reset(){this.generation++;this.grantedSession.set(-1);this.state.set('unknown');this.busy.set(false);}
  deny(){this.reset();this.state.set('denied');}
  async check(){
    if(!this.config.browser||!this.auth.available){this.reset();return false;}
    const generation=++this.generation;const session=this.workspace.sessionVersion();this.busy.set(true);
    try{
      const response=await this.api.context();if(generation!==this.generation||session!==this.workspace.sessionVersion()||!this.auth.available)return false;
      this.grantedSession.set(response?.allowed===true?session:-1);this.state.set(response?.allowed===true?'allowed':'denied');return response?.allowed===true;
    }catch(error){
      if(generation!==this.generation||session!==this.workspace.sessionVersion()||!this.auth.available)return false;
      const status=(error as {status?:number}).status;this.grantedSession.set(-1);this.state.set(status===401||status===403?'denied':'error');return false;
    }finally{if(generation===this.generation)this.busy.set(false);}
  }
}
