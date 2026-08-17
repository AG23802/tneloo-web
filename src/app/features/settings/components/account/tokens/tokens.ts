import { Component, ElementRef, effect, inject, output, signal, viewChild } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { TranslatePipe } from '@ngx-translate/core';
import type { StripeElements } from '@stripe/stripe-js';
import { IconComponent } from '../../../../../components/icon/icon';
import { UserService } from '../../../../../core/services/user.service';
import {
  Bundle,
  BundleSize,
  SavedPaymentMethod,
  StripeService,
} from '../../../../../core/services/stripe.service';

const NEW_CARD = 'new' as const;
const COUNTRY_CODES = ['CH', 'DE', 'AT'] as const;

interface SelectedBundle {
  size: BundleSize;
  price: number;
  tokens: number;
  currency: string;
}

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
  readonly countryCodes = COUNTRY_CODES;
  // `country` is otherwise only ever set server-side after a first
  // purchase (see the Stripe webhook) - a brand-new buyer needs to pick
  // one upfront just to see prices/VAT for their own purchase.
  readonly selectedCountry = signal<string | null>(this.currentUser()?.country ?? null);
  readonly bundles = signal<Record<BundleSize, Bundle> | null>(null);
  readonly currency = signal<string>('');
  readonly paymentMethods = signal<SavedPaymentMethod[]>([]);
  readonly isLoading = signal(false);
  readonly selectedBundle = signal<SelectedBundle | null>(null);
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
  // against - re-runs if the bundle or the "save this card" choice
  // changes, since both are baked into the PaymentIntent at creation time.
  private readonly ensureIntentEffect = effect(() => {
    const bundle = this.selectedBundle();
    const method = this.selectedMethod();
    const save = this.saveNewCard();
    const country = this.selectedCountry();
    if (!bundle || !country || method !== NEW_CARD) return;
    const key = `${bundle.size}:${save}`;
    if (this.intentKey === key) return;
    this.intentKey = key;
    void this.createNewCardIntent(country, bundle.size, save);
  });

  private readonly mountEffect = effect(() => {
    const container = this.paymentElementContainer()?.nativeElement;
    const secret = this.clientSecret();
    if (!container || !secret || this.mountedFor === secret) return;
    this.mountedFor = secret;
    void this.mountPaymentElement(container, secret);
  });

  constructor() {
    if (this.selectedCountry()) void this.loadData();
    void this.loadPaymentMethods();
  }

  goBack(): void {
    this.navigateBack.emit();
  }

  chooseCountry(code: string): void {
    this.selectedCountry.set(code);
    void this.loadData();
  }

  private async loadPaymentMethods(): Promise<void> {
    try {
      this.paymentMethods.set(await this.stripeService.listPaymentMethods());
    } catch (error) {
      console.error('Error loading payment methods:', error);
    }
  }

  private async loadData(): Promise<void> {
    const country = this.selectedCountry();
    if (!country) return;
    this.isLoading.set(true);
    try {
      const { currency, bundles } = await this.stripeService.listBundles(country);
      this.currency.set(currency);
      this.bundles.set(bundles);
    } catch (error) {
      console.error('Error loading bundles:', error);
      this.errorMessage.set('Could not load token bundles.');
    } finally {
      this.isLoading.set(false);
    }
  }

  bundleSizes(): BundleSize[] {
    return this.bundles() ? (Object.keys(this.bundles()!) as BundleSize[]) : [];
  }

  selectBundle(size: BundleSize): void {
    const bundle = this.bundles()?.[size];
    if (!bundle) return;
    this.errorMessage.set(null);
    this.successMessage.set(null);
    this.selectedBundle.set({ size, ...bundle, currency: this.currency() });
    const defaultMethod = this.paymentMethods().find((pm) => pm.isDefault);
    this.selectedMethod.set(defaultMethod?.id ?? (this.paymentMethods()[0]?.id || NEW_CARD));
  }

  cancelPurchase(): void {
    this.selectedBundle.set(null);
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

  private async createNewCardIntent(
    countryCode: string,
    bundleSize: BundleSize,
    save: boolean,
  ): Promise<void> {
    this.clientSecret.set(null);
    this.elements = null;
    this.mountedFor = null;
    try {
      const { clientSecret } = await this.stripeService.createPaymentIntent(
        countryCode,
        bundleSize,
        { savePaymentMethod: save },
      );
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
    const bundle = this.selectedBundle();
    const method = this.selectedMethod();
    const country = this.selectedCountry();
    if (!bundle || !method || !country || this.isPurchasing()) return;

    this.isPurchasing.set(true);
    this.errorMessage.set(null);
    try {
      const succeeded =
        method === NEW_CARD
          ? await this.payWithNewCard()
          : await this.payWithSavedCard(country, bundle, method);
      if (succeeded) await this.onPurchaseSucceeded(bundle);
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

  private async payWithSavedCard(
    countryCode: string,
    bundle: SelectedBundle,
    paymentMethodId: string,
  ): Promise<boolean> {
    const { clientSecret, status } = await this.stripeService.createPaymentIntent(
      countryCode,
      bundle.size,
      { paymentMethodId },
    );
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
  private async onPurchaseSucceeded(bundle: SelectedBundle): Promise<void> {
    this.successMessage.set('purchased');
    const before = this.currentUser()?.tokenBalance ?? 0;
    this.cancelPurchase();
    for (let attempt = 0; attempt < 5; attempt++) {
      await this.userService.refreshCurrentUser();
      if ((this.currentUser()?.tokenBalance ?? 0) >= before + bundle.tokens) return;
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }
}
