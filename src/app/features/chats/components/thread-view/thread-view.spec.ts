import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ThreadView } from './thread-view';

describe('ThreadView', () => {
  let component: ThreadView;
  let fixture: ComponentFixture<ThreadView>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ThreadView],
    }).compileComponents();

    fixture = TestBed.createComponent(ThreadView);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
