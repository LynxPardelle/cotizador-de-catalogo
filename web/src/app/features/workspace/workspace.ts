import { Component, inject } from '@angular/core';
import { WorkspaceStore } from './workspace.store';

@Component({
  selector: 'app-workspace',
  templateUrl: './workspace.html',
  styleUrl: './workspace.scss',
})
export class Workspace {
  protected readonly store = inject(WorkspaceStore);
}
