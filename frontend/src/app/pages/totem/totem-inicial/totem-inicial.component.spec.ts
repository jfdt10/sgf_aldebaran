import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { vi } from 'vitest';

import { TotemInicialComponent } from './totem-inicial.component';

describe('TotemInicial', () => {
  let component: TotemInicialComponent;
  let fixture: ComponentFixture<TotemInicialComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TotemInicialComponent],
      providers: [
        provideRouter([]),
      ],
    })
    .compileComponents();

    vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    fixture = TestBed.createComponent(TotemInicialComponent);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
