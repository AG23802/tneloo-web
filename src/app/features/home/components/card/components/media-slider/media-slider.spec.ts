import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MediaSlider } from './media-slider';

describe('MediaSlider', () => {
  let component: MediaSlider;
  let fixture: ComponentFixture<MediaSlider>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MediaSlider],
    }).compileComponents();

    fixture = TestBed.createComponent(MediaSlider);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
