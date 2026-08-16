import { Component, ElementRef, effect, inject, output, signal, viewChild } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { TranslatePipe } from '@ngx-translate/core';
import type { StripeElements } from '@stripe/stripe-js';
import { IconComponent } from '../../../../../components/icon/icon';
import { UserService } from '../../../../../core/services/user.service';
import { SavedPaymentMethod, StripeService, TokenPack } from '../../../../../core/services/stripe.service';

const NEW_CARD = 'new' as const;

@Component({
  selector: 'app-tokens-purchase',
  imports: [IconComponent, TranslatePipe, DecimalPipe],
  templateUrl: './tokens.html',
  styleUrl: './tokens.css',
})
export class TokensPurchase {
  private readonly stripeService = inject(StripeService);
  private readonly userService = inject(UserService);
  private readonly paymentElementContainer = viewChild<ElementRef<HTMLDivElement>>('paymentElement');

  navigateBack = output<void>();

  readonly currentUser = this.userService.currentUser;
  readonly packs = signal<TokenPack[]>([]);
  readonly paymentMethods = signal<SavedPaymentMethod[]>([]);
  readonly isLoading = signal(true);
  readonly selectedPack = signal<TokenPack | null>(null);
  readonly selectedMethod = signal<string | null>(null);
  readonly saveNewCard = signal(false);
  readonly isPurchasing = signal(false);
  readonly errorMessage = signal<string | null>(null);
  readonly successMessage = signal<string | null>(null);

  private readonly clientSecret = signal<string | null>(null);
  private elements: StripeElements | null = null;
  private mountedFor: string | null = null;
  private intentKey: string | null = null;

  // Whenever "pay with a new card" is selected, make sure there's a
  // PaymentIntent (and thus a clientSecret) to mount the Payment Element
  // against - re-runs if the pack or the "save this card" choice changes,
  // since both are baked into the PaymentIntent at creation time.
  private readonly ensureIntentEffect = effect(() => {
    const pack = this.selectedPack();
    const method = this.selectedMethod();
    const save = this.saveNewCard();
    if (!pack || method !== NEW_CARD) return;
    const key = `${pack.priceId}:${save}`;
    if (this.intentKey === key) return;
    this.intentKey = key;
    void this.createNewCardIntent(pack.priceId, save);
  });

  private readonly mountEffect = effect(() => {
    const container = this.paymentElementContainer()?.nativeElement;
    const secret = this.clientSecret();
    if (!container || !secret || this.mountedFor === secret) return;
    this.mountedFor = secret;
    void this.mountPaymentElement(container, secret);
  });

  constructor() {
    void this.loadData();
  }

  goBack(): void {
    this.navigateBack.emit();
  }

  private async loadData(): Promise<void> {
    this.isLoading.set(true);
    try {
      const [packs, paymentMethods] = await Promise.all([
        this.stripeService.listTokenPacks(),
        this.stripeService.listPaymentMethods(),
      ]);
      this.packs.set(packs);
      this.paymentMethods.set(paymentMethods);
    } catch (error) {
      console.error('Error loading token packs:', error);
      this.errorMessage.set('Could not load token packs.');
    } finally {
      this.isLoading.set(false);
    }
  }

  selectPack(pack: TokenPack): void {
    this.errorMessage.set(null);
    this.successMessage.set(null);
    this.selectedPack.set(pack);
    const defaultMethod = this.paymentMethods().find((pm) => pm.isDefault);
    this.selectedMethod.set(defaultMethod?.id ?? (this.paymentMethods()[0]?.id || NEW_CARD));
  }

  cancelPurchase(): void {
    this.selectedPack.set(null);
    this.selectedMethod.set(null);
    this.saveNewCard.set(false);
    this.clientSecret.set(null);
    this.elements = null;
    this.mountedFor = null;
    this.intentKey = null;
  }

  selectMethod(id: string): void {
    this.selectedMethod.set(id);
  }

  private async createNewCardIntent(priceId: string, save: boolean): Promise<void> {
    this.clientSecret.set(null);
    this.elements = null;
    this.mountedFor = null;
    try {
      const { clientSecret } = await this.stripeService.createPaymentIntent(priceId, {
        savePaymentMethod: save,
      });
      this.clientSecret.set(clientSecret);
    } catch (error) {
      console.error('Error creating payment intent:', error);
      this.errorMessage.set('Could not start checkout.');
    }
  }

  private async mountPaymentElement(container: HTMLDivElement, secret: string): Promise<void> {
    const stripe = await this.stripeService.getStripe();
    if (!stripe) return;
    this.elements = stripe.elements({ clientSecret: secret });
    this.elements.create('payment').mount(container);
  }

  async pay(): Promise<void> {
    const pack = this.selectedPack();
    const method = this.selectedMethod();
    if (!pack || !method || this.isPurchasing()) return;

    this.isPurchasing.set(true);
    this.errorMessage.set(null);
    try {
      const succeeded =
        method === NEW_CARD ? await this.payWithNewCard() : await this.payWithSavedCard(pack, method);
      if (succeeded) await this.onPurchaseSucceeded(pack);
    } finally {
      this.isPurchasing.set(false);
    }
  }

  private async payWithNewCard(): Promise<boolean> {
    const stripe = await this.stripeService.getStripe();
    if (!stripe || !this.elements) return false;
    const { error, paymentIntent } = await stripe.confirmPayment({
      elements: this.elements,
      redirect: 'if_required',
    });
    if (error) {
      this.errorMessage.set(error.message ?? 'Payment failed.');
      return false;
    }
    if (paymentIntent?.status === 'succeeded') return true;
    this.errorMessage.set('Payment did not complete.');
    return false;
  }

  private async payWithSavedCard(pack: TokenPack, paymentMethodId: string): Promise<boolean> {
    const { clientSecret, status } = await this.stripeService.createPaymentIntent(pack.priceId, {
      paymentMethodId,
    });
    if (status === 'succeeded') return true;

    if (status === 'requires_action') {
      const stripe = await this.stripeService.getStripe();
      if (!stripe) return false;
      const { error, paymentIntent } = await stripe.confirmCardPayment(clientSecret);
      if (error) {
        this.errorMessage.set(error.message ?? 'Payment failed.');
        return false;
      }
      if (paymentIntent?.status === 'succeeded') return true;
    }

    this.errorMessage.set('Payment did not complete.');
    return false;
  }

  // The webhook that credits tokens runs asynchronously after Stripe
  // confirms the charge, so the balance may not be updated the instant
  // this resolves - poll briefly rather than showing a stale number.
  private async onPurchaseSucceeded(pack: TokenPack): Promise<void> {
    this.successMessage.set('purchased');
    const before = this.currentUser()?.tokens ?? 0;
    this.cancelPurchase();
    for (let attempt = 0; attempt < 5; attempt++) {
      await this.userService.refreshCurrentUser();
      if ((this.currentUser()?.tokens ?? 0) >= before + pack.tokens) return;
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }
}
