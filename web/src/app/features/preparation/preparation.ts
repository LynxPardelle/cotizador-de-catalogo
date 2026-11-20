import {afterNextRender,ChangeDetectionStrategy,Component,computed,DestroyRef,effect,inject,signal,untracked} from '@angular/core';
import {DatePipe,DOCUMENT} from '@angular/common';
import {disabled,FormField,form,min,required} from '@angular/forms/signals';
import {ActivatedRoute,RouterLink} from '@angular/router';
import {toSignal} from '@angular/core/rxjs-interop';
import {Auth} from '../../core/auth';
import {WorkspaceContext} from '../../core/workspace-context';
import {RuntimeConfig} from '../../core/runtime-config';
import {ApplicationsAccess} from '../../core/applications-access';
import {AgreementKey,PreparationAgreements,PreparationApi,PreparationHistory,PreparationMutation,PreparationMutationKind,PreparationView} from '../../data/preparation-api';
import contract from '../../../../../services/preparation/contract.json';

const emptyAgreements=():PreparationAgreements=>({participants:false,references:false,sessions:false,support:false,evidence:false});
const emptyLink=()=>({workspaceId:'',participationConsent:false,sharingConsent:false});
const emptyCatalog=()=>({catalogId:'',version:1,catalogAuthorized:false});
const emptyAgreementModel=()=>({agreements:emptyAgreements(),plannedStartDate:''});
const uuid=(value:string)=>/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
const validDate=(value:string)=>value===''||(/^\d{4}-\d{2}-\d{2}$/.test(value)&&Number(value.slice(0,4))>=1&&Number.isFinite(Date.parse(value))&&new Date(value).toISOString().slice(0,10)===value);
type Scope={epoch:number;session:number;reference:string;operator:boolean};
type Pending={kind:PreparationMutationKind;body:Readonly<PreparationMutation>};

@Component({
  imports: [RouterLink,DatePipe,FormField],
  selector: 'app-preparation',
  styleUrl: './preparation.scss',
  templateUrl: './preparation.html',
  changeDetection:ChangeDetectionStrategy.OnPush,
})
export class Preparation {
 protected readonly auth=inject(Auth);protected readonly access=inject(ApplicationsAccess);private readonly config=inject(RuntimeConfig);private readonly api=inject(PreparationApi);private readonly workspace=inject(WorkspaceContext);private readonly document=inject(DOCUMENT);
 private readonly route=inject(ActivatedRoute);private readonly params=toSignal(this.route.paramMap);private readonly data=toSignal(this.route.data);
 protected readonly reference=computed(()=>this.params()?.get('reference')??'');protected readonly operator=computed(()=>this.data()?.['mode']==='operator');
 protected readonly ready=signal(false);private readonly clock=signal(Date.now());protected readonly signedIn=computed(()=>{this.clock();return this.auth.available;});
 protected readonly view=signal<PreparationView|undefined>(undefined);protected readonly history=signal<PreparationHistory[]>([]);protected readonly nextCursor=signal('');protected readonly busy=signal(false);protected readonly historyBusy=signal(false);protected readonly saving=signal(false);protected readonly error=signal('');protected readonly historyError=signal('');protected readonly success=signal('');protected readonly conflict=signal(false);protected readonly unavailable=signal(false);protected readonly paused=signal(false);protected readonly pending=signal<Pending|undefined>(undefined);
 protected readonly linkModel=signal(emptyLink());protected readonly catalogModel=signal(emptyCatalog());protected readonly agreementModel=signal(emptyAgreementModel());
 protected readonly linkFields=form(this.linkModel,path=>{disabled(path,()=>this.locked());required(path.workspaceId);});
 protected readonly catalogFields=form(this.catalogModel,path=>{disabled(path,()=>this.locked());required(path.catalogId);required(path.version);min(path.version,1);});
 protected readonly agreementFields=form(this.agreementModel,path=>disabled(path,()=>this.locked()));
 protected readonly agreementItems=contract.agreements as {id:AgreementKey;label:string}[];
 protected readonly statusLabel=computed(()=>({awaiting_link:'Pendiente de vincular el espacio',preparing:'Preparación en curso',ready:'Lista para coordinar el inicio',blocked:'Preparación bloqueada'}[this.view()?.readiness.state??'preparing']));
 protected readonly contactPath=computed(()=>`/piloto/incorporacion/${encodeURIComponent(this.reference())}`);
 private epoch=0;private historyGeneration=0;private uncertain=false;
 constructor(){
  const destroy=inject(DestroyRef);afterNextRender(()=>{if(this.config.browser){this.ready.set(true);const timer=setInterval(()=>this.clock.set(Date.now()),1000);destroy.onDestroy(()=>clearInterval(timer));}});
  effect(()=>{const ready=this.ready(),signedIn=this.signedIn();this.reference();this.operator();this.workspace.sessionVersion();untracked(()=>{this.clear();if(ready&&signedIn)void this.refresh();else if(this.operator())this.access.reset();});});
  destroy.onDestroy(()=>this.clear());
 }
 protected locked(){return this.busy()||this.saving()||!!this.pending()||this.conflict()||this.paused();}
 private scope():Scope{return {epoch:this.epoch,session:this.workspace.sessionVersion(),reference:this.reference(),operator:this.operator()};}
 private same(scope:Scope){return scope.epoch===this.epoch&&scope.session===this.workspace.sessionVersion()&&scope.reference===this.reference()&&scope.operator===this.operator();}
 private valid(scope:Scope){return this.same(scope)&&this.config.browser&&this.ready()&&this.auth.available&&(!scope.operator||this.access.allowed());}
 private clear(preserve=false){this.epoch++;this.historyGeneration++;this.view.set(undefined);this.history.set([]);this.nextCursor.set('');this.historyBusy.set(false);this.busy.set(false);this.saving.set(false);this.pending.set(undefined);this.uncertain=false;this.error.set('');this.historyError.set('');this.success.set('');this.unavailable.set(false);this.paused.set(false);if(!preserve){this.linkModel.set(emptyLink());this.catalogModel.set(emptyCatalog());this.agreementModel.set(emptyAgreementModel());this.conflict.set(false);}}
 private denied(error:unknown,scope:Scope){const status=(error as {status?:number}).status;if(scope.session!==this.workspace.sessionVersion()||!(status===401||status===403))return false;this.clear();if(scope.operator)this.access.deny();this.error.set(status===401?'Tu sesión ha terminado. Inicia sesión para continuar.':'Tu cuenta no tiene permiso para preparar esta organización.');this.unavailable.set(true);return true;}
 private terminal(error:unknown){const status=(error as {status?:number}).status;const code=this.code(error);if(status!==404&&code!=='PREPARATION_PAUSED')return false;this.clear();this.unavailable.set(status===404);this.paused.set(code==='PREPARATION_PAUSED');this.error.set(status===404?'Esta incorporación no está disponible para tu cuenta o ya ha caducado.':'La preparación está pausada porque la solicitud dejó de estar preseleccionada. Consulta con la operación del piloto.');return true;}
 private read<T>(operation:Promise<T>,scope:Scope){return operation.catch(error=>{this.denied(error,scope);throw error;});}
 protected async refresh(preserve=false){
  if(!this.config.browser||!this.ready()||!this.auth.available||this.saving()||this.pending())return;
  this.clear(preserve);const scope=this.scope();if(!uuid(scope.reference)){this.unavailable.set(true);this.error.set('Esta referencia de incorporación no está disponible.');return;}this.busy.set(true);
  if(scope.operator){const allowed=await this.access.check();if(!allowed||!this.valid(scope)){if(this.same(scope))this.busy.set(false);return;}}
  try{
   const [view,history]=await Promise.all([this.read(this.api.view(scope.reference,scope.operator),scope),scope.operator?this.read(this.api.history(scope.reference),scope):Promise.resolve({items:[],nextCursor:null})]);
   if(!this.valid(scope))return;this.install(view,!preserve);this.history.set(history.items);this.nextCursor.set(history.nextCursor??'');
  }catch(error){if(this.denied(error,scope)||!this.valid(scope))return;if(!this.terminal(error))this.error.set('No pudimos comprobar la preparación. Reintenta cuando la conexión esté disponible.');}
  finally{if(this.valid(scope))this.busy.set(false);}
 }
 private install(view:PreparationView,reset:boolean){this.view.set(view);if(reset){this.linkModel.set(emptyLink());this.catalogModel.set({catalogId:view.preparation.catalog?.catalogId??'',version:view.preparation.catalog?.version??1,catalogAuthorized:false});this.agreementModel.set({agreements:{...view.preparation.agreements},plannedStartDate:view.preparation.plannedStartDate});}}
 protected login(){return this.auth.login(this.operator()?`/piloto/preparacion/${encodeURIComponent(this.reference())}`:this.contactPath());}
 protected signup(){return this.auth.signup(this.contactPath());}
 protected async submitLink(event:Event){event.preventDefault();const view=this.view();if(!view||this.operator()||view.preparation.workspaceId||this.saving()||this.busy()||this.conflict())return;if(!this.pending()){const model=this.linkModel();if(!model.participationConsent||!model.sharingConsent||!view.adminWorkspaces?.some(item=>item.workspaceId===model.workspaceId)){this.error.set('Selecciona el espacio que administras y confirma los dos acuerdos antes de vincularlo.');return;}this.prepare('link',{mutationId:crypto.randomUUID(),expectedVersion:view.preparation.version,workspaceId:model.workspaceId,participationConsent:true,sharingConsent:true,consentVersion:contract.consentVersion});}await this.mutate('link');}
 protected async submitCatalog(event:Event){event.preventDefault();const view=this.view();if(!view||this.operator()||!view.preparation.workspaceId||this.saving()||this.busy()||this.conflict())return;if(!this.pending()){const model=this.catalogModel();const catalogId=model.catalogId.trim();if(!model.catalogAuthorized||!/^[a-zA-Z0-9_-]{1,64}$/.test(catalogId)||!Number.isSafeInteger(model.version)||model.version<1||model.version>999999999){this.error.set('Indica un catálogo publicado, su versión entera y confirma la autorización para el piloto.');return;}this.prepare('catalog',{mutationId:crypto.randomUUID(),expectedVersion:view.preparation.version,catalogId,version:model.version,catalogAuthorized:true,consentVersion:contract.consentVersion});}await this.mutate('catalog');}
 protected async submitAgreements(event:Event){event.preventDefault();const view=this.view();if(!view||!this.operator()||this.saving()||this.busy()||this.conflict())return;if(!this.pending()){const model=this.agreementModel();if(!validDate(model.plannedStartDate)){this.error.set('Usa una fecha de calendario UTC válida o déjala vacía.');return;}this.prepare('agreements',{mutationId:crypto.randomUUID(),expectedVersion:view.preparation.version,agreements:{...model.agreements},plannedStartDate:model.plannedStartDate});}await this.mutate('agreements');}
 private prepare(kind:PreparationMutationKind,body:PreparationMutation){const cloned=structuredClone(body);if('agreements'in cloned)Object.freeze(cloned.agreements);this.pending.set({kind,body:Object.freeze(cloned)});this.uncertain=false;}
 private code(error:unknown){return (error as {error?:{error?:{code?:string}}}).error?.error?.code;}
 private async mutate(kind:PreparationMutationKind){
  const intention=this.pending();if(!intention||intention.kind!==kind||!this.auth.available||!this.config.browser||this.paused())return;const scope=this.scope();if(!this.valid(scope))return;this.saving.set(true);this.error.set('');this.success.set('');
  try{
   const result=await this.api.update(scope.reference,kind,intention.body);if(!this.valid(scope))return;if(result.reference!==scope.reference||result.preparation.version<=intention.body.expectedVersion)throw new Error('Unconfirmed preparation');
   this.pending.set(undefined);this.saving.set(false);await this.refresh();if(this.view())this.success.set('Preparación guardada.');
  }catch(error){
   if(this.denied(error,scope)||!this.valid(scope))return;if(this.terminal(error))return;const status=(error as {status?:number}).status;const code=this.code(error);
   if(status===409){this.pending.set(undefined);this.conflict.set(true);this.error.set(code==='CATALOG_NOT_READY'?'Ese catálogo no está disponible, activo y vigente para el piloto. Conservamos tu edición; recarga la preparación antes de corregir la referencia.':code==='WORKSPACE_ALREADY_LINKED'?'Otra revisión ya vinculó un espacio. Conservamos tu selección; recarga la versión vigente para comprobarlo.':'Otra persona modificó la preparación. Conservamos tu edición. Recarga la versión vigente antes de decidir si la guardas.');}
   else if((status===400||status===413)&&!this.uncertain){this.pending.set(undefined);this.error.set('La preparación fue rechazada. Revisa los campos antes de volver a guardar.');}
   else{this.uncertain=true;this.error.set('No pudimos confirmar el guardado. Conserva esta página y reintenta; enviaremos exactamente la misma intención.');}
  }finally{if(this.valid(scope))this.saving.set(false);}
 }
 protected async retry(){const intention=this.pending();if(intention)await this.mutate(intention.kind);}
 protected async reloadConflict(){if(!this.conflict()||this.busy())return;await this.refresh(true);if(this.view()&&!this.error()&&!this.paused()){this.conflict.set(false);this.success.set('Versión vigente cargada. Revisa tu edición antes de guardar.');}}
 protected async moreHistory(){
  if(!this.operator()||!this.nextCursor()||this.historyBusy()||this.locked())return;const scope=this.scope(),generation=++this.historyGeneration;this.historyBusy.set(true);this.historyError.set('');
  try{const page=await this.api.history(scope.reference,this.nextCursor());if(!this.valid(scope)||generation!==this.historyGeneration)return;this.history.update(items=>[...new Map([...items,...page.items].map(item=>[item.mutationId,item])).values()]);this.nextCursor.set(page.nextCursor??'');}
  catch(error){if(this.denied(error,scope)||!this.valid(scope)||generation!==this.historyGeneration)return;if(!this.terminal(error))this.historyError.set('No pudimos cargar más movimientos. Reintenta desde la misma página.');}
  finally{if(this.valid(scope)&&generation===this.historyGeneration)this.historyBusy.set(false);}
 }
 protected async openWorkspace(path:'/equipo'|'/catalogos'){
  const workspaceId=this.view()?.preparation.workspaceId;if(this.operator()||!workspaceId||this.locked()||!this.auth.available)return;const scope=this.scope();this.busy.set(true);this.error.set('');
  try{await this.workspace.load(workspaceId);if(!this.valid(scope))return;if(!this.workspace.select(workspaceId)){this.error.set('Ya no tienes acceso a ese espacio. Vuelve a comprobar la preparación.');return;}this.document.location.assign(path);}
  finally{if(this.valid(scope))this.busy.set(false);}
 }
 protected async copyLink(){if(!this.operator()||!this.view()||!this.config.browser)return;try{await navigator.clipboard.writeText(new URL(this.contactPath(),this.document.location.origin).toString());this.success.set('Enlace copiado. Compártelo manualmente con el contacto de la solicitud.');}catch{this.error.set('No pudimos copiar el enlace. Puedes seleccionar la dirección visible y copiarla.');}}
 protected contactUrl(){return new URL(this.contactPath(),this.document.location.origin).toString();}
 protected pendingLabel(id:string){const labels:Record<string,string>={workspace:'Espacio vinculado con autorización',admin_access:'Administrador con acceso vigente',seller_access:'Segundo participante con acceso de vendedor',catalog:'Catálogo autorizado, activo y vigente',planned_start_date:'Fecha prevista actual o futura (UTC)',...Object.fromEntries(this.agreementItems.map(item=>[item.id,item.label]))};return labels[id]??'Comprobación pendiente';}
 protected historyLabel(kind:string){return {link:'Espacio vinculado',catalog:'Catálogo autorizado',agreements:'Acuerdos de preparación actualizados'}[kind]??'Preparación actualizada';}
}
