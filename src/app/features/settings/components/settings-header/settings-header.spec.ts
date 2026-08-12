import { ComponentFixture, TestBed } from '@angular/core/testing';
import { SettingsHeader } from './settings-header';

describe('SettingsHeader', () => {
  let component: SettingsHeader;
  let fixture: ComponentFixture<SettingsHeader>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SettingsHeader],
    }).compileComponents();

    fixture = TestBed.createComponent(SettingsHeader);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
