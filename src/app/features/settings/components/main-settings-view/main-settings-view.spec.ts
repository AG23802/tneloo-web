import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MainSettingsView } from './main-settings-view';

describe('MainSettingsView', () => {
  let component: MainSettingsView;
  let fixture: ComponentFixture<MainSettingsView>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MainSettingsView],
    }).compileComponents();

    fixture = TestBed.createComponent(MainSettingsView);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
