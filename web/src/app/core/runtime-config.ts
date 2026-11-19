import { HttpClient } from '@angular/common/http';
import { inject, Injectable, PLATFORM_ID, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { firstValueFrom } from 'rxjs';

export interface RuntimeSettings {
  productName: string;
  environment?: string;
  demo: boolean;
  auth?: { domain: string; clientId: string; redirectUri: string; logoutUri: string };
}

@Injectable({ providedIn: 'root' })
export class RuntimeConfig {
  private readonly http = inject(HttpClient);
  readonly browser = isPlatformBrowser(inject(PLATFORM_ID));
  readonly settings = signal<RuntimeSettings>({ productName: 'CotiTrama', demo: false });
  readonly error = signal('');
  async load() {
    if (!this.browser) return;
    try { this.settings.set(await firstValueFrom(this.http.get<RuntimeSettings>('/config.json', { transferCache: false }))); }
    catch { this.error.set('No pudimos cargar la aplicación. Actualiza la página para volver a intentarlo.'); }
  }
}
