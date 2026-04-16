"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getCheckingBalance = exports.saveSophtronUserInstitution = exports.getSophtronWidgetData = void 0;
const admin = require("firebase-admin");
const crypto = require("crypto");
const https_1 = require("firebase-functions/v2/https");
admin.initializeApp();
const SOPHTRON_API_BASE = 'https://api.sophtron.com/api';
/**
 * Builds the Sophtron HMAC-based Authorization header value.
 * Format: FIApiAUTH:{userId}:{base64Signature}:{authPath}
 * where authPath is the last path segment of the URL (lowercase).
 */
function buildSophtronAuth(httpMethod, url) {
    const userId = process.env.SOPHTRON_USER_ID;
    const accessKey = process.env.SOPHTRON_ACCESS_KEY;
    if (!userId || !accessKey) {
        throw new https_1.HttpsError('failed-precondition', 'Sophtron credentials are not configured. Set SOPHTRON_USER_ID and SOPHTRON_ACCESS_KEY.');
    }
    const authPath = url.substring(url.lastIndexOf('/')).toLowerCase();
    const integrationKey = Buffer.from(accessKey, 'base64');
    const plainKey = httpMethod.toUpperCase() + '\n' + authPath;
    const b64Sig = crypto.createHmac('sha256', integrationKey).update(plainKey).digest('base64');
    return `FIApiAUTH:${userId}:${b64Sig}:${authPath}`;
}
/** Executes a POST request against the Sophtron API. */
async function sophtronPost(path, body) {
    const url = `${SOPHTRON_API_BASE}/${path}`;
    const auth = buildSophtronAuth('POST', url);
    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': auth,
        },
        body: JSON.stringify(body),
    });
    if (!response.ok) {
        throw new https_1.HttpsError('internal', `Sophtron API error: ${response.status} ${response.statusText}`);
    }
    return response.json();
}
/**
 * Returns the Sophtron integration key and a unique request ID for a widget
 * session. The client uses these to initialise the Sophtron widget.
 * Returns `{ integrationKey: string, requestId: string }`.
 */
exports.getSophtronWidgetData = (0, https_1.onCall)({ cors: ['https://bclennon.github.io'] }, async (request) => {
    if (!request.auth) {
        throw new https_1.HttpsError('unauthenticated', 'You must be signed in.');
    }
    const userId = process.env.SOPHTRON_USER_ID;
    if (!userId) {
        throw new https_1.HttpsError('failed-precondition', 'Sophtron credentials are not configured. Set SOPHTRON_USER_ID and SOPHTRON_ACCESS_KEY.');
    }
    const result = await sophtronPost('User/GetUserIntegrationKey', { Id: userId });
    const requestId = crypto.randomUUID();
    return { integrationKey: result.IntegrationKey, requestId };
});
/**
 * Persists the Sophtron UserInstitutionID for the authenticated user in
 * Firestore at `users/{uid}/sophtron/token`.
 * Accepts `{ userInstitutionId: string }`.
 */
exports.saveSophtronUserInstitution = (0, https_1.onCall)({ cors: ['https://bclennon.github.io'] }, async (request) => {
    if (!request.auth) {
        throw new https_1.HttpsError('unauthenticated', 'You must be signed in.');
    }
    const data = request.data;
    if (!data.userInstitutionId) {
        throw new https_1.HttpsError('invalid-argument', 'userInstitutionId is required.');
    }
    await admin
        .firestore()
        .doc(`users/${request.auth.uid}/sophtron/token`)
        .set({ userInstitutionId: data.userInstitutionId });
    return { success: true };
});
/**
 * Fetches the current balance of the linked checking account via Sophtron.
 * Returns `{ balanceCents: number }`.
 */
exports.getCheckingBalance = (0, https_1.onCall)({ cors: ['https://bclennon.github.io'] }, async (request) => {
    if (!request.auth) {
        throw new https_1.HttpsError('unauthenticated', 'You must be signed in.');
    }
    const snap = await admin
        .firestore()
        .doc(`users/${request.auth.uid}/sophtron/token`)
        .get();
    if (!snap.exists) {
        throw new https_1.HttpsError('not-found', 'No linked bank account found. Link your account in Settings.');
    }
    const { userInstitutionId } = snap.data();
    const accounts = await sophtronPost('UserInstitution/GetUserInstitutionAccounts', { UserInstitutionID: userInstitutionId });
    if (!accounts || accounts.length === 0) {
        throw new https_1.HttpsError('not-found', 'No accounts found on the linked institution.');
    }
    const checking = accounts.find((a) => a.AccountType && a.AccountType.toLowerCase().includes('checking'));
    if (!checking) {
        throw new https_1.HttpsError('not-found', 'No checking account found on the linked institution.');
    }
    if (checking.AccountBalance === null || checking.AccountBalance === undefined) {
        throw new https_1.HttpsError('unavailable', 'Checking account balance is currently unavailable. Please try again later.');
    }
    const balanceCents = Math.round(checking.AccountBalance * 100);
    return { balanceCents };
});
//# sourceMappingURL=index.js.map