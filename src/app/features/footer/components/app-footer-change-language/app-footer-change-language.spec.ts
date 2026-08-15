import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AppFooterChangeLanguage } from './app-footer-change-language';

describe('AppFooterChangeLanguage', () => {
  let component: AppFooterChangeLanguage;
  let fixture: ComponentFixture<AppFooterChangeLanguage>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AppFooterChangeLanguage],
    }).compileComponents();

    fixture = TestBed.createComponent(AppFooterChangeLanguage);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
