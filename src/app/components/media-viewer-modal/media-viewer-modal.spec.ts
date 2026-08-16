import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MediaViewerModal } from './media-viewer-modal';

describe('MediaViewerModal', () => {
  let component: MediaViewerModal;
  let fixture: ComponentFixture<MediaViewerModal>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MediaViewerModal],
    }).compileComponents();

    fixture = TestBed.createComponent(MediaViewerModal);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
