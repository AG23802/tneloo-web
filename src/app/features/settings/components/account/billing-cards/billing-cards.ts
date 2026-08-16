import { Component, ElementRef, effect, inject, output, signal, viewChild } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import type { StripeElements } from '@stripe/stripe-js';
import { IconComponent } from '../../../../../components/icon/icon';
import { SavedPaymentMethod, StripeService } from '../../../../../core/services/stripe.service';

@Component({
  selector: 'app-billing-cards',
  imports: [IconComponent, TranslatePipe],
  templateUrl: './billing-cards.html',
  styleUrl: './billing-cards.css',
})
export class BillingCards {
  private readonly stripeService = inject(StripeService);
  private readonly paymentElementContainer = viewChild<ElementRef<HTMLDivElement>>('paymentElement');

  navigateBack = output<void>();

  readonly paymentMethods = signal<SavedPaymentMethod[]>([]);
  readonly isLoading = signal(true);
  readonly isAddingCard = signal(false);
  readonly isSavingCard = signal(false);
  readonly errorMessage = signal<string | null>(null);
  readonly cardPendingDeletion = signal<SavedPaymentMethod | null>(null);
  readonly mutatingId = signal<string | null>(null);

  private readonly clientSecret = signal<string | null>(null);
  private elements: StripeElements | null = null;
  private mountedFor: string | null = null;

  // Mounts the Payment Element as soon as both its container and the
  // SetupIntent's clientSecret are available - order between the two
  // isn't guaranteed (the container only exists once isAddingCard's @if
  // renders it), so this reacts to whichever arrives last.
  private readonly mountEffect = effect(() => {
    const container = this.paymentElementContainer()?.nativeElement;
    const secret = this.clientSecret();
    if (!container || !secret || this.mountedFor === secret) return;
    this.mountedFor = secret;
    void this.mountPaymentElement(container, secret);
  });

  constructor() {
    void this.loadPaymentMethods();
  }

  goBack(): void {
    this.navigateBack.emit();
  }

  private async loadPaymentMethods(): Promise<void> {
    this.isLoading.set(true);
    try {
      this.paymentMethods.set(await this.stripeService.listPaymentMethods());
    } catch (error) {
      console.error('Error loading payment methods:', error);
      this.errorMessage.set('Could not load your saved cards.');
    } finally {
      this.isLoading.set(false);
    }
  }

  async showAddCardForm(): Promise<void> {
    this.errorMessage.set(null);
    this.isAddingCard.set(true);
    try {
      const { clientSecret } = await this.stripeService.createSetupIntent();
      this.clientSecret.set(clientSecret);
    } catch (error) {
      console.error('Error creating setup intent:', error);
      this.errorMessage.set('Could not start adding a card.');
      this.isAddingCard.set(false);
    }
  }

  cancelAddCard(): void {
    this.isAddingCard.set(false);
    this.clientSecret.set(null);
    this.elements = null;
    this.mountedFor = null;
  }

  private async mountPaymentElement(container: HTMLDivElement, secret: string): Promise<void> {
    const stripe = await this.stripeService.getStripe();
    if (!stripe) return;
    this.elements = stripe.elements({ clientSecret: secret });
    this.elements.create('payment').mount(container);
  }

  async saveCard(): Promise<void> {
    if (!this.elements || this.isSavingCard()) return;
    const stripe = await this.stripeService.getStripe();
    if (!stripe) return;

    this.isSavingCard.set(true);
    this.errorMessage.set(null);
    try {
      const { error, setupIntent } = await stripe.confirmSetup({
        elements: this.elements,
        redirect: 'if_required',
      });
      if (error) {
        this.errorMessage.set(error.message ?? 'Could not save this card.');
        return;
      }
      if (setupIntent?.status === 'succeeded') {
        this.cancelAddCard();
        await this.loadPaymentMethods();
      }
    } finally {
      this.isSavingCard.set(false);
    }
  }

  startDeleteCard(pm: SavedPaymentMethod): void {
    this.cardPendingDeletion.set(pm);
  }

  cancelDeleteCard(): void {
    this.cardPendingDeletion.set(null);
  }

  async confirmDeleteCard(): Promise<void> {
    const pm = this.cardPendingDeletion();
    if (!pm || this.mutatingId()) return;
    this.mutatingId.set(pm.id);
    try {
      await this.stripeService.deletePaymentMethod(pm.id);
      this.cardPendingDeletion.set(null);
      await this.loadPaymentMethods();
    } catch (error) {
      console.error('Error deleting card:', error);
      this.errorMessage.set('Could not delete this card.');
    } finally {
      this.mutatingId.set(null);
    }
  }

  async makeDefault(pm: SavedPaymentMethod): Promise<void> {
    if (pm.isDefault || this.mutatingId()) return;
    this.mutatingId.set(pm.id);
    try {
      await this.stripeService.setDefaultPaymentMethod(pm.id);
      await this.loadPaymentMethods();
    } catch (error) {
      console.error('Error setting default card:', error);
      this.errorMessage.set('Could not update your default card.');
    } finally {
      this.mutatingId.set(null);
    }
  }
}
