import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { vi } from 'vitest';

import { TotemSenhaComponent } from './totem-senha.component';

describe('TotemSenha', () => {
  let component: TotemSenhaComponent;
  let fixture: ComponentFixture<TotemSenhaComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TotemSenhaComponent],
      providers: [
        provideRouter([]),
      ],
    })
    .compileComponents();

    vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    fixture = TestBed.createComponent(TotemSenhaComponent);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
