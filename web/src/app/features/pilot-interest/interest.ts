import { afterNextRender, ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { disabled, email, FormField, form, maxLength, minLength, pattern, required, validate } from '@angular/forms/signals';
import { RouterLink } from '@angular/router';
import { RuntimeConfig } from '../../core/runtime-config';
import { InterestApi, InterestRequest } from '../../data/interest-api';
import contract from '../../../../../services/interest/contract.json';

const emptyModel=()=>({organizationName:'',contactEmail:'',sector:'',currentMethod:'',monthlyQuotes:'',twoParticipants:'',timeAvailability:'',contactConsent:false});
const plainText=/^[^\p{Cc}\p{Cf}]+$/u;
@Component({imports:[FormField,RouterLink],templateUrl:'./interest.html',changeDetection:ChangeDetectionStrategy.OnPush})
export class Interest {
  private readonly api=inject(InterestApi);private readonly config=inject(RuntimeConfig);private generation=0;private uncertain=false;
  protected readonly contract=contract;protected readonly model=signal(emptyModel());protected readonly busy=signal(false);protected readonly ready=signal(false);
  protected readonly error=signal('');protected readonly attempted=signal(false);protected readonly pending=signal<InterestRequest|undefined>(undefined);protected readonly receipt=signal('');
  protected readonly fields=form(this.model,path=>{
    disabled(path,()=>this.busy()||!!this.pending()||!this.ready());
    required(path.organizationName);minLength(path.organizationName,2);maxLength(path.organizationName,contract.limits.organizationName);pattern(path.organizationName,plainText);
    required(path.contactEmail);email(path.contactEmail);pattern(path.contactEmail,/^[^\s@]+@[^\s@]+\.[^\s@]+$/);maxLength(path.contactEmail,contract.limits.contactEmail);
    required(path.sector);minLength(path.sector,2);maxLength(path.sector,contract.limits.sector);pattern(path.sector,plainText);
    required(path.currentMethod);required(path.monthlyQuotes);required(path.twoParticipants);required(path.timeAvailability);
    validate(path.contactConsent,({value})=>value()?null:{kind:'required',message:'Autoriza el contacto sobre este piloto para enviar tu interés.'});
  });
  constructor(){afterNextRender(()=>this.ready.set(true));inject(DestroyRef).onDestroy(()=>{this.generation++;this.pending.set(undefined);this.model.set(emptyModel());});}
  protected async submit(event:Event){
    event.preventDefault();if(this.busy()||!this.config.browser||!this.ready()||this.receipt())return;
    this.attempted.set(true);this.error.set('');
    if(!this.pending()){
      const value=this.model();const normalized={...value,organizationName:value.organizationName.trim().normalize('NFC'),contactEmail:value.contactEmail.trim().toLowerCase(),sector:value.sector.trim().normalize('NFC')};
      this.model.set(normalized);
      const valid=normalized.organizationName.length>=2&&normalized.sector.length>=2&&plainText.test(normalized.organizationName)&&plainText.test(normalized.sector)
        &&contract.currentMethods.some(option=>option.id===normalized.currentMethod)&&contract.monthlyQuoteRanges.some(option=>option.id===normalized.monthlyQuotes)
        &&contract.availabilityOptions.some(option=>option.id===normalized.twoParticipants)&&contract.availabilityOptions.some(option=>option.id===normalized.timeAvailability)&&normalized.contactConsent;
      if(this.fields().invalid()||!valid){this.error.set('Revisa los datos obligatorios y confirma la autorización de contacto.');return;}
      this.uncertain=false;this.pending.set(Object.freeze({...normalized,contactConsent:true,requestId:crypto.randomUUID(),privacyVersion:contract.privacyVersion}));
    }
    const body=this.pending()!;const current=++this.generation;this.busy.set(true);
    try{
      const response=await this.api.submit(body);
      if(response?.reference!==body.requestId||response?.status!=='received')throw new Error('Unconfirmed receipt');
      if(current===this.generation){this.receipt.set(response.reference);this.model.set(emptyModel());this.pending.set(undefined);}
    }catch(error){
      if(current!==this.generation)return;
      const status=(error as {status?:number}).status;
      if((status===400||status===413)&&!this.uncertain){this.pending.set(undefined);this.error.set('El envío fue rechazado antes de registrarse. Revisa los datos y vuelve a enviar.');}
      else{
        if(status===undefined||status===0||status>=500||status===409)this.uncertain=true;
        this.error.set(status===429?'Hay un límite temporal de recepción. Conserva esta página y reintenta más tarde con el mismo envío.':'No pudimos confirmar la recepción. Conserva esta página y usa Reintentar envío; mantendremos la misma solicitud.');
      }
    }finally{if(current===this.generation)this.busy.set(false);}
  }
}
