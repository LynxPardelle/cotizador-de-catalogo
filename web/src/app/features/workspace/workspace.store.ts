import { signalStore, withState } from '@ngrx/signals';

interface WorkspaceArea {
  readonly id: string;
  readonly label: string;
  readonly description: string;
}

interface WorkspaceState {
  readonly title: string;
  readonly description: string;
  readonly areas: readonly WorkspaceArea[];
}

const initialState: WorkspaceState = {
  title: 'Cotizador de Catálogo',
  description: 'Configura productos y registra propuestas con precios reproducibles.',
  areas: [
    { id: 'catalogs', label: 'Catálogos', description: 'Productos, opciones, reglas comerciales y versiones publicadas.' },
    { id: 'quotes', label: 'Cotizaciones', description: 'Desglose, vigencia y versión de catálogo de cada propuesta.' },
  ],
};

export const WorkspaceStore = signalStore(withState(initialState));
