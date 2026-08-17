import { Service } from '@angular/core';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { loadStripe, Stripe } from '@stripe/stripe-js';
import app from '../firebase';
import { environment } from '../../../environments/environment';

export interface SavedPaymentMethod {
  id: string;
  brand: string | null;
  last4: string | null;
  expMonth: number | null;
  expYear: number | null;
  isDefault: boolean;
}

export type BundleSize = 'small' | 'medium' | 'large';

export interface Bundle {
  price: number;
  tokens: number;
}

export interface CountryBundles {
  currency: string;
  bundles: Record<BundleSize, Bundle>;
}

// Thin wrapper around the Cloud Functions that talk to Stripe - everything
// here happens in-app (Payment Element embedded in our own UI), never a
// redirect to a Stripe-hosted page.
@Service()
export class StripeService {
  private readonly functions = getFunctions(app, 'europe-west6');
  private stripePromise: Promise<Stripe | null> | null = null;

  getStripe(): Promise<Stripe | null> {
    if (!this.stripePromise) {
      this.stripePromise = loadStripe(environment.stripePublishableKey);
    }
    return this.stripePromise;
  }

  async createSetupIntent(): Promise<{ clientSecret: string }> {
    const call = httpsCallable<void, { clientSecret: string }>(
      this.functions,
      'createSetupIntent',
    );
    return (await call()).data;
  }

  async listPaymentMethods(): Promise<SavedPaymentMethod[]> {
    const call = httpsCallable<void, { paymentMethods: SavedPaymentMethod[] }>(
      this.functions,
      'listPaymentMethods',
    );
    return (await call()).data.paymentMethods;
  }

  async deletePaymentMethod(paymentMethodId: string): Promise<void> {
    const call = httpsCallable<{ paymentMethodId: string }, { success: boolean }>(
      this.functions,
      'deletePaymentMethod',
    );
    await call({ paymentMethodId });
  }

  async setDefaultPaymentMethod(paymentMethodId: string): Promise<void> {
    const call = httpsCallable<{ paymentMethodId: string }, { success: boolean }>(
      this.functions,
      'setDefaultPaymentMethod',
    );
    await call({ paymentMethodId });
  }

  async listBundles(countryCode: string): Promise<CountryBundles> {
    const call = httpsCallable<{ countryCode: string }, CountryBundles>(
      this.functions,
      'listBundles',
    );
    return (await call({ countryCode })).data;
  }

  async createPaymentIntent(
    countryCode: string,
    bundleSize: BundleSize,
    options?: { paymentMethodId?: string; savePaymentMethod?: boolean },
  ): Promise<{ clientSecret: string; status: string }> {
    const call = httpsCallable<
      {
        countryCode: string;
        bundleSize: BundleSize;
        paymentMethodId?: string;
        savePaymentMethod?: boolean;
      },
      { clientSecret: string; status: string }
    >(this.functions, 'createPaymentIntent');
    return (await call({ countryCode, bundleSize, ...options })).data;
  }
}
