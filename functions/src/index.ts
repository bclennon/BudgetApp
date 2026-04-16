import * as admin from 'firebase-admin';
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import {
  Configuration,
  PlaidApi,
  PlaidEnvironments,
  Products,
  CountryCode,
  AccountType,
  AccountSubtype,
} from 'plaid';

admin.initializeApp();

function getPlaidClient(): PlaidApi {
  const clientId = process.env.PLAID_CLIENT_ID;
  const secret = process.env.PLAID_SECRET;
  const env = process.env.PLAID_ENV ?? 'sandbox';

  if (!clientId || !secret) {
    throw new HttpsError(
      'failed-precondition',
      'Plaid credentials are not configured. Set PLAID_CLIENT_ID and PLAID_SECRET.'
    );
  }

  const config = new Configuration({
    basePath: PlaidEnvironments[env as keyof typeof PlaidEnvironments],
    baseOptions: {
      headers: {
        'PLAID-CLIENT-ID': clientId,
        'PLAID-SECRET': secret,
      },
    },
  });

  return new PlaidApi(config);
}

/**
 * Creates a Plaid Link token scoped to the `balance` product.
 * Returns `{ linkToken: string }`.
 */
export const createLinkToken = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'You must be signed in.');
  }

  const plaid = getPlaidClient();
  const response = await plaid.linkTokenCreate({
    user: { client_user_id: request.auth.uid },
    client_name: 'BudgetApp',
    products: [Products.Balance],
    country_codes: [CountryCode.Us],
    language: 'en',
  });

  return { linkToken: response.data.link_token };
});

/**
 * Exchanges a Plaid public token for a persistent access token and stores it
 * in Firestore at `users/{uid}/plaid/token`.
 * Accepts `{ publicToken: string }`.
 */
export const exchangePublicToken = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'You must be signed in.');
  }

  const data = request.data as { publicToken?: string };
  if (!data.publicToken) {
    throw new HttpsError('invalid-argument', 'publicToken is required.');
  }

  const plaid = getPlaidClient();
  const response = await plaid.itemPublicTokenExchange({
    public_token: data.publicToken,
  });

  await admin
    .firestore()
    .doc(`users/${request.auth.uid}/plaid/token`)
    .set({ accessToken: response.data.access_token });

  return { success: true };
});

/**
 * Fetches the current balance of the linked Wells Fargo Checking account.
 * Returns `{ balanceCents: number }`.
 */
export const getCheckingBalance = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'You must be signed in.');
  }

  const snap = await admin
    .firestore()
    .doc(`users/${request.auth.uid}/plaid/token`)
    .get();

  if (!snap.exists) {
    throw new HttpsError('not-found', 'No linked bank account found. Link your account in Settings.');
  }

  const { accessToken } = snap.data() as { accessToken: string };

  const plaid = getPlaidClient();
  const response = await plaid.accountsBalanceGet({ access_token: accessToken });

  const checking = response.data.accounts.find(
    (a) => a.type === AccountType.Depository && a.subtype === AccountSubtype.Checking
  );

  if (!checking) {
    throw new HttpsError('not-found', 'No checking account found on the linked institution.');
  }

  const current = checking.balances.current;
  if (current === null || current === undefined) {
    throw new HttpsError(
      'unavailable',
      'Checking account balance is currently unavailable. Please try again later.'
    );
  }

  const balanceCents = Math.round(current * 100);
  return { balanceCents };
});
