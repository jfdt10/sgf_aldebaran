import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SuporteComponent } from './suporte';

describe('SuporteComponent', () => {
  let component: SuporteComponent;
  let fixture: ComponentFixture<SuporteComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SuporteComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(SuporteComponent);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
