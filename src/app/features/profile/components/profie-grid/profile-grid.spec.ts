import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ProfileGrid } from './profile-grid';

describe('ProfileGrid', () => {
  let component: ProfileGrid;
  let fixture: ComponentFixture<ProfileGrid>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ProfileGrid],
    }).compileComponents();

    fixture = TestBed.createComponent(ProfileGrid);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
