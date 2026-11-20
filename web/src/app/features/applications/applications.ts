import { afterNextRender, ChangeDetectionStrategy, Component, computed, DestroyRef, effect, inject, signal, untracked } from '@angular/core';
import { DatePipe } from '@angular/common';
import { disabled, FormField, form, maxLength, required } from '@angular/forms/signals';
import { RouterLink } from '@angular/router';
import { Auth } from '../../core/auth';
import { RuntimeConfig } from '../../core/runtime-config';
import { WorkspaceContext } from '../../core/workspace-context';
import { ApplicationsAccess } from '../../core/applications-access';
import { ApplicationDetail, ApplicationHistory, ApplicationsApi, ApplicationSummary, ReviewUpdate } from '../../data/applications-api';
import contract from '../../../../../services/applications/contract.json';
import interest from '../../../../../services/interest/contract.json';

const emptyModel=()=>({status:'received',nextActionDate:'',note:''});
const validDate=(value:string)=>!value||(/^\d{4}-\d{2}-\d{2}$/.test(value)&&Number(value.slice(0,4))>=1&&new Date(`${value}T00:00:00.000Z`).toISOString().slice(0,10)===value);
const validNote=(value:string)=>!/[\p{Cf}\x00-\x08\x0b-\x1f\x7f-\x9f]/u.test(value);
type Scope={epoch:number;session:number};

@Component({imports:[RouterLink,FormField,DatePipe],templateUrl:'./applications.html',changeDetection:ChangeDetectionStrategy.OnPush})
export class Applications {
  protected readonly auth=inject(Auth);protected readonly config=inject(RuntimeConfig);protected readonly access=inject(ApplicationsAccess);
  private readonly api=inject(ApplicationsApi);private readonly workspace=inject(WorkspaceContext);
  protected readonly ready=signal(false);private readonly clock=signal(Date.now());
  protected readonly signedIn=computed(()=>{this.clock();return this.auth.available;});
  protected readonly contract=contract;protected readonly filter=signal('all');
  protected readonly items=signal<ApplicationSummary[]>([]);protected readonly nextCursor=signal('');protected readonly listBusy=signal(false);protected readonly listError=signal('');
  protected readonly detail=signal<ApplicationDetail|undefined>(undefined);protected readonly detailBusy=signal(false);protected readonly detailError=signal('');
  protected readonly history=signal<ApplicationHistory[]>([]);protected readonly historyCursor=signal('');protected readonly historyBusy=signal(false);protected readonly historyError=signal('');
  protected readonly model=signal(emptyModel());protected readonly saving=signal(false);protected readonly saveError=signal('');protected readonly success=signal('');
  protected readonly pending=signal<Readonly<ReviewUpdate>|undefined>(undefined);protected readonly conflict=signal(false);
  protected readonly fields=form(this.model,path=>{disabled(path,()=>this.saving()||!!this.pending()||this.conflict()||this.detailBusy());required(path.status);maxLength(path.note,contract.maxNoteLength);});
  private epoch=0;private listGeneration=0;private detailGeneration=0;private saveGeneration=0;private historyGeneration=0;private uncertain=false;

  constructor(){
    const destroy=inject(DestroyRef);
    afterNextRender(()=>{if(this.config.browser){this.ready.set(true);const timer=setInterval(()=>this.clock.set(Date.now()),1000);destroy.onDestroy(()=>clearInterval(timer));}});
    effect(()=>{const ready=this.ready();const signedIn=this.signedIn();this.workspace.sessionVersion();untracked(()=>{if(ready&&signedIn)void this.refresh();else{this.clearPrivate();this.access.reset();}});});
    destroy.onDestroy(()=>this.clearPrivate());
  }
  private scope():Scope{return {epoch:this.epoch,session:this.workspace.sessionVersion()};}
  private valid(scope:Scope){return scope.epoch===this.epoch&&scope.session===this.workspace.sessionVersion()&&this.config.browser&&this.ready()&&this.auth.available&&this.access.allowed();}
  private clearPrivate(){
    this.epoch++;this.listGeneration++;this.detailGeneration++;this.saveGeneration++;this.historyGeneration++;
    this.items.set([]);this.nextCursor.set('');this.detail.set(undefined);this.history.set([]);this.historyCursor.set('');this.model.set(emptyModel());this.pending.set(undefined);this.conflict.set(false);this.uncertain=false;
    this.listBusy.set(false);this.detailBusy.set(false);this.historyBusy.set(false);this.saving.set(false);this.listError.set('');this.detailError.set('');this.historyError.set('');this.saveError.set('');this.success.set('');
  }
  private denied(error:unknown){const status=(error as {status?:number}).status;if(status===401||status===403){this.clearPrivate();this.access.deny();return true;}return false;}
  private read<T>(operation:Promise<T>,scope:Scope){return operation.catch(error=>{if(scope.session===this.workspace.sessionVersion())this.denied(error);throw error;});}
  private unavailable(reference:string){
    this.detailGeneration++;this.historyGeneration++;this.saveGeneration++;this.detail.set(undefined);this.history.set([]);this.historyCursor.set('');this.model.set(emptyModel());this.pending.set(undefined);this.conflict.set(false);this.uncertain=false;
    this.detailBusy.set(false);this.historyBusy.set(false);this.saving.set(false);this.saveError.set('');this.success.set('');this.historyError.set('');this.items.update(items=>items.filter(item=>item.reference!==reference));this.detailError.set('Esta solicitud ya no está disponible. Actualiza la lista para continuar.');
  }
  protected async refresh(){
    if(!this.config.browser||!this.ready()||!this.auth.available||this.saving()||this.pending())return;
    this.clearPrivate();const scope=this.scope();
    if(await this.access.check()){if(this.valid(scope))await this.loadList(false);}
  }
  protected async changeFilter(value:string){
    if(this.listBusy()||this.pending()||this.saving()||!(value==='all'||contract.statuses.some(item=>item.id===value)))return;
    this.filter.set(value);this.detailGeneration++;this.historyGeneration++;this.detailBusy.set(false);this.historyBusy.set(false);this.detailError.set('');this.historyError.set('');this.detail.set(undefined);this.history.set([]);this.historyCursor.set('');this.model.set(emptyModel());this.conflict.set(false);this.saveError.set('');this.success.set('');await this.loadList(false);
  }
  protected more(){return this.loadList(true);}
  private async loadList(append:boolean){
    if(!this.access.allowed()||!this.auth.available||this.listBusy()||this.pending())return;
    const cursor=append?this.nextCursor():'';if(append&&!cursor)return;
    const generation=++this.listGeneration;const scope=this.scope();this.listBusy.set(true);this.listError.set('');
    if(!append){this.items.set([]);this.nextCursor.set('');}
    try{
      const response=await this.api.list(this.filter(),cursor);if(generation!==this.listGeneration||!this.valid(scope))return;
      const all=append?[...this.items(),...response.items]:response.items;this.items.set([...new Map(all.map(item=>[item.reference,item])).values()]);this.nextCursor.set(response.nextCursor??'');
    }catch(error){if(scope.session===this.workspace.sessionVersion()&&this.denied(error))return;if(generation===this.listGeneration&&this.valid(scope))this.listError.set('No pudimos cargar esta página de solicitudes. Puedes volver a intentar.');}
    finally{if(generation===this.listGeneration&&this.valid(scope))this.listBusy.set(false);}
  }
  protected async open(reference:string,preserveEdit=false){
    if(!this.access.allowed()||!this.auth.available||this.saving()||this.pending())return;
    const generation=++this.detailGeneration;this.historyGeneration++;const scope=this.scope();this.detailBusy.set(true);this.detailError.set('');this.historyError.set('');this.success.set('');
    if(!preserveEdit){this.detail.set(undefined);this.model.set(emptyModel());this.conflict.set(false);this.saveError.set('');}
    this.history.set([]);this.historyCursor.set('');this.historyBusy.set(false);
    try{
      const [detail,history]=await Promise.all([this.read(this.api.detail(reference),scope),this.read(this.api.history(reference),scope)]);
      if(generation!==this.detailGeneration||!this.valid(scope))return;
      this.detail.set(detail);this.history.set(history.items);this.historyCursor.set(history.nextCursor??'');
      if(!preserveEdit)this.model.set({status:detail.review.status,nextActionDate:detail.review.nextActionDate,note:''});
      this.items.update(items=>items.map(item=>item.reference===reference?{...item,review:detail.review}:item));
    }catch(error){
      if(scope.session===this.workspace.sessionVersion()&&this.denied(error))return;
      if(generation!==this.detailGeneration||!this.valid(scope))return;
      if((error as {status?:number}).status===404){this.unavailable(reference);return;}
      this.detailError.set('No pudimos cargar el detalle y su historial. Vuelve a seleccionar la solicitud.');if(!preserveEdit)this.detail.set(undefined);
    }finally{if(generation===this.detailGeneration&&this.valid(scope))this.detailBusy.set(false);}
  }
  protected async moreHistory(){
    const detail=this.detail();if(!detail||!this.historyCursor()||this.historyBusy()||this.pending()||!this.access.allowed()||!this.auth.available)return;
    const generation=++this.historyGeneration;const selectedGeneration=this.detailGeneration;const scope=this.scope();this.historyBusy.set(true);this.historyError.set('');
    try{const response=await this.api.history(detail.reference,this.historyCursor());if(generation!==this.historyGeneration||selectedGeneration!==this.detailGeneration||!this.valid(scope))return;this.history.update(items=>[...new Map([...items,...response.items].map(item=>[item.mutationId,item])).values()]);this.historyCursor.set(response.nextCursor??'');}
    catch(error){if(scope.session===this.workspace.sessionVersion()&&this.denied(error))return;if(generation!==this.historyGeneration||selectedGeneration!==this.detailGeneration||!this.valid(scope))return;if((error as {status?:number}).status===404){this.unavailable(detail.reference);return;}this.historyError.set('No pudimos cargar más movimientos. Reintenta para continuar desde la misma página.');}
    finally{if(generation===this.historyGeneration&&selectedGeneration===this.detailGeneration&&this.valid(scope))this.historyBusy.set(false);}
  }
  protected async save(event:Event){
    event.preventDefault();const detail=this.detail();if(!detail||!this.access.allowed()||!this.auth.available||this.saving()||this.detailBusy()||this.conflict())return;
    this.saveError.set('');this.success.set('');
    if(!this.pending()){
      const value=this.model();const normalized={...value,note:value.note.trim().normalize('NFC')};this.model.set(normalized);
      let dateOK=false;try{dateOK=validDate(normalized.nextActionDate);}catch{dateOK=false;}
      if(!contract.statuses.some(status=>status.id===normalized.status)||!dateOK||!validNote(normalized.note)||normalized.note.length>contract.maxNoteLength){this.saveError.set('Revisa el estado, la fecha y la nota de hasta 500 caracteres. Usa texto simple, sin caracteres de control.');return;}
      if(normalized.status===detail.review.status&&normalized.nextActionDate===detail.review.nextActionDate&&!normalized.note){this.saveError.set('Cambia el estado o la fecha, o agrega una nota para registrar un seguimiento.');return;}
      this.uncertain=false;this.pending.set(Object.freeze({mutationId:crypto.randomUUID(),expectedVersion:detail.review.version,...normalized}));
    }
    const body=this.pending()!;const scope=this.scope();const generation=++this.saveGeneration;this.saving.set(true);
    try{
      const response=await this.api.update(detail.reference,body);if(generation!==this.saveGeneration||!this.valid(scope))return;
      if(response.reference!==detail.reference||!response.review||response.review.version<=body.expectedVersion)throw new Error('Unconfirmed review');
      this.pending.set(undefined);this.saving.set(false);this.uncertain=false;await this.open(detail.reference);
      if(generation===this.saveGeneration&&this.valid(scope))this.success.set(this.detailError()?'Seguimiento guardado. Vuelve a cargar el detalle para ver la versión vigente.':'Seguimiento guardado.');
    }catch(error){
      if(scope.session===this.workspace.sessionVersion()&&this.denied(error))return;if(generation!==this.saveGeneration||!this.valid(scope))return;
      const status=(error as {status?:number}).status;const code=(error as {error?:{error?:{code?:string}}}).error?.error?.code;
      if(status===404){this.unavailable(detail.reference);return;}
      if(status===409){this.pending.set(undefined);this.conflict.set(true);this.saveError.set(code==='REVIEW_CONFLICT'?'Otra persona actualizó el seguimiento. Conservamos tu edición. Recarga la versión vigente antes de decidir si la guardas.':'No pudimos aplicar esta intención de guardado. Conservamos tu edición. Recarga la versión vigente antes de volver a guardar.');}
      else if((status===400||status===413)&&!this.uncertain){this.pending.set(undefined);this.saveError.set('El seguimiento fue rechazado. Revisa los datos antes de volver a guardar.');}
      else{this.uncertain=true;this.saveError.set('No pudimos confirmar el guardado. Conserva esta página y usa Reintentar guardado; enviaremos exactamente la misma intención.');}
    }finally{if(generation===this.saveGeneration&&this.valid(scope))this.saving.set(false);}
  }
  protected async reloadConflict(){
    const detail=this.detail();if(!detail||!this.conflict()||this.detailBusy())return;
    await this.open(detail.reference,true);if(this.access.allowed()&&!this.detailError()&&this.detail()){this.conflict.set(false);this.saveError.set('');this.success.set('Versión vigente cargada. Revisa tu edición antes de guardar.');}
  }
  protected statusLabel(status:string){return contract.statuses.find(item=>item.id===status)?.label??status;}
  protected choiceLabel(group:'currentMethods'|'monthlyQuoteRanges'|'availabilityOptions',value:string){return interest[group].find(item=>item.id===value)?.label??value;}
  protected overdue(date:string){this.clock();return !!date&&date<new Date().toISOString().slice(0,10);}
}
