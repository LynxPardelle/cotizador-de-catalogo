import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { Auth } from '../../core/auth';
import { QuoteStore } from './quote.store';
import { SavedQuote } from './saved-quote';

describe('Saved proposal access',()=>{
  it('removes a previously loaded private proposal when authentication ends',()=>{
    const signedIn=signal(true);const clock=signal(Date.now());
    const quote={quoteId:'private-reference',issuedAt:'2026-11-19T00:00:00Z',catalogId:'private-catalog',version:1,currency:'MXN',currencyExponent:2,validUntil:'2099-01-01T00:00:00Z',subtotalMinor:'100',totalMinor:'100',lines:[],appliedRules:[],items:[]};
    TestBed.configureTestingModule({providers:[provideRouter([]),{provide:Auth,useValue:{get available(){return signedIn();},login:vi.fn()}},{provide:QuoteStore,useValue:{quote:()=>quote,busy:()=>false,error:()=>'',open:vi.fn(),clock}},{provide:ActivatedRoute,useValue:{snapshot:{paramMap:convertToParamMap({quoteId:'private-reference'})}}}]});
    const fixture=TestBed.createComponent(SavedQuote);fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('private-reference');
    signedIn.set(false);clock.update(value=>value+1000);fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Inicia sesión');
    expect(fixture.nativeElement.textContent).not.toContain('private-reference');
    expect(fixture.nativeElement.textContent).not.toContain('private-catalog');
    expect(fixture.nativeElement.querySelector('.saved-proposal')).toBeNull();
  });
});
