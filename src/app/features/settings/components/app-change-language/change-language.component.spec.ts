import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ChangeLanguage } from './change-language.component';

describe('AppChangeLanguage', () => {
  let component: ChangeLanguage;
  let fixture: ComponentFixture<ChangeLanguage>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ChangeLanguage],
    }).compileComponents();

    fixture = TestBed.createComponent(ChangeLanguage);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
