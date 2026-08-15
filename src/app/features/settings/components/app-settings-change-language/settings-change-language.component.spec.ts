import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SettingsChangeLanguage } from './settings-change-language.component';

describe('AppChangeLanguage', () => {
  let component: SettingsChangeLanguage;
  let fixture: ComponentFixture<SettingsChangeLanguage>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SettingsChangeLanguage],
    }).compileComponents();

    fixture = TestBed.createComponent(SettingsChangeLanguage);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
