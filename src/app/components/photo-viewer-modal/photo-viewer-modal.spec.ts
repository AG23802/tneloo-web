import { ComponentFixture, TestBed } from '@angular/core/testing';
import { PhotoViewerModal } from './photo-viewer-modal';

describe('PhotoViewerModal', () => {
  let component: PhotoViewerModal;
  let fixture: ComponentFixture<PhotoViewerModal>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PhotoViewerModal],
    }).compileComponents();

    fixture = TestBed.createComponent(PhotoViewerModal);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
