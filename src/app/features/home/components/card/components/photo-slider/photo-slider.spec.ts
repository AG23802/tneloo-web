import { ComponentFixture, TestBed } from '@angular/core/testing';
import { PhotoSlider } from './photo-slider';

describe('PhotoSlider', () => {
  let component: PhotoSlider;
  let fixture: ComponentFixture<PhotoSlider>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PhotoSlider],
    }).compileComponents();

    fixture = TestBed.createComponent(PhotoSlider);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
