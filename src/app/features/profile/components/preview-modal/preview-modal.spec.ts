import { ComponentFixture, TestBed } from '@angular/core/testing';
import { PreviewModal } from './preview-modal';

describe('PreviewModal', () => {
  let component: PreviewModal;
  let fixture: ComponentFixture<PreviewModal>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PreviewModal],
    }).compileComponents();

    fixture = TestBed.createComponent(PreviewModal);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
