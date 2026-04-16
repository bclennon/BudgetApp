"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getCheckingBalance = exports.exchangePublicToken = exports.createLinkToken = void 0;
const admin = require("firebase-admin");
const https_1 = require("firebase-functions/v2/https");
const plaid_1 = require("plaid");
admin.initializeApp();
function getPlaidClient() {
    const clientId = process.env.PLAID_CLIENT_ID;
    const secret = process.env.PLAID_SECRET;
    const env = process.env.PLAID_ENV ?? 'sandbox';
    if (!clientId || !secret) {
        throw new https_1.HttpsError('failed-precondition', 'Plaid credentials are not configured. Set PLAID_CLIENT_ID and PLAID_SECRET.');
    }
    const config = new plaid_1.Configuration({
        basePath: plaid_1.PlaidEnvironments[env],
        baseOptions: {
            headers: {
                'PLAID-CLIENT-ID': clientId,
                'PLAID-SECRET': secret,
            },
        },
    });
    return new plaid_1.PlaidApi(config);
}
/**
 * Creates a Plaid Link token scoped to the `balance` product.
 * Returns `{ linkToken: string }`.
 */
exports.createLinkToken = (0, https_1.onCall)(async (request) => {
    if (!request.auth) {
        throw new https_1.HttpsError('unauthenticated', 'You must be signed in.');
    }
    const plaid = getPlaidClient();
    const response = await plaid.linkTokenCreate({
        user: { client_user_id: request.auth.uid },
        client_name: 'BudgetApp',
        products: [plaid_1.Products.Balance],
        country_codes: [plaid_1.CountryCode.Us],
        language: 'en',
    });
    return { linkToken: response.data.link_token };
});
/**
 * Exchanges a Plaid public token for a persistent access token and stores it
 * in Firestore at `users/{uid}/plaid/token`.
 * Accepts `{ publicToken: string }`.
 */
exports.exchangePublicToken = (0, https_1.onCall)(async (request) => {
    if (!request.auth) {
        throw new https_1.HttpsError('unauthenticated', 'You must be signed in.');
    }
    const data = request.data;
    if (!data.publicToken) {
        throw new https_1.HttpsError('invalid-argument', 'publicToken is required.');
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
exports.getCheckingBalance = (0, https_1.onCall)(async (request) => {
    if (!request.auth) {
        throw new https_1.HttpsError('unauthenticated', 'You must be signed in.');
    }
    const snap = await admin
        .firestore()
        .doc(`users/${request.auth.uid}/plaid/token`)
        .get();
    if (!snap.exists) {
        throw new https_1.HttpsError('not-found', 'No linked bank account found. Link your account in Settings.');
    }
    const { accessToken } = snap.data();
    const plaid = getPlaidClient();
    const response = await plaid.accountsBalanceGet({ access_token: accessToken });
    const checking = response.data.accounts.find((a) => a.type === plaid_1.AccountType.Depository && a.subtype === plaid_1.AccountSubtype.Checking);
    if (!checking) {
        throw new https_1.HttpsError('not-found', 'No checking account found on the linked institution.');
    }
    const balanceCents = Math.round((checking.balances.current ?? 0) * 100);
    return { balanceCents };
});
//# sourceMappingURL=index.js.map