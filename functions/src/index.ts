import * as admin from 'firebase-admin';
import * as crypto from 'crypto';
import { onCall, HttpsError } from 'firebase-functions/v2/https';

admin.initializeApp();

const SOPHTRON_API_BASE = 'https://api.sophtron.com/api';

/**
 * Builds the Sophtron HMAC-based Authorization header value.
 * Format: FIApiAUTH:{userId}:{base64Signature}:{authPath}
 * where authPath is the last path segment of the URL (lowercase).
 */
function buildSophtronAuth(httpMethod: string, url: string): string {
  const userId = process.env.SOPHTRON_USER_ID;
  const accessKey = process.env.SOPHTRON_ACCESS_KEY;

  if (!userId || !accessKey) {
    throw new HttpsError(
      'failed-precondition',
      'Sophtron credentials are not configured. Set SOPHTRON_USER_ID and SOPHTRON_ACCESS_KEY.'
    );
  }

  const authPath = url.substring(url.lastIndexOf('/')).toLowerCase();
  const integrationKey = Buffer.from(accessKey, 'base64');
  const plainKey = httpMethod.toUpperCase() + '\n' + authPath;
  const b64Sig = crypto.createHmac('sha256', integrationKey).update(plainKey).digest('base64');
  return `FIApiAUTH:${userId}:${b64Sig}:${authPath}`;
}

/** Executes a POST request against the Sophtron API. */
async function sophtronPost<T>(path: string, body: object): Promise<T> {
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
    throw new HttpsError(
      'internal',
      `Sophtron API error: ${response.status} ${response.statusText}`
    );
  }

  return response.json() as Promise<T>;
}

/**
 * Returns the Sophtron integration key and a unique request ID for a widget
 * session. The client uses these to initialise the Sophtron widget.
 * Returns `{ integrationKey: string, requestId: string }`.
 */
export const getSophtronWidgetData = onCall({ cors: ['https://bclennon.github.io'] }, async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'You must be signed in.');
  }

  const userId = process.env.SOPHTRON_USER_ID;
  if (!userId) {
    throw new HttpsError(
      'failed-precondition',
      'Sophtron credentials are not configured. Set SOPHTRON_USER_ID and SOPHTRON_ACCESS_KEY.'
    );
  }

  const result = await sophtronPost<{ IntegrationKey: string }>(
    'User/GetUserIntegrationKey',
    { Id: userId }
  );

  const requestId = crypto.randomUUID();
  return { integrationKey: result.IntegrationKey, requestId };
});

/**
 * Persists the Sophtron UserInstitutionID for the authenticated user in
 * Firestore at `users/{uid}/sophtron/token`.
 * Accepts `{ userInstitutionId: string }`.
 */
export const saveSophtronUserInstitution = onCall({ cors: ['https://bclennon.github.io'] }, async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'You must be signed in.');
  }

  const data = request.data as { userInstitutionId?: string };
  if (!data.userInstitutionId) {
    throw new HttpsError('invalid-argument', 'userInstitutionId is required.');
  }

  await admin
    .firestore()
    .doc(`users/${request.auth.uid}/sophtron/token`)
    .set({ userInstitutionId: data.userInstitutionId });

  return { success: true };
});

// Shape of a Sophtron account returned by GetUserInstitutionAccounts.
// Field names follow Sophtron's PascalCase convention.
interface SophtronAccount {
  AccountID: string;
  AccountType: string;   // e.g. "Checking", "Savings"
  AccountBalance: number;
}

interface SophtronJobStatus {
  SuccessFlag: boolean | null;
  LastStatus: string;
}

/**
 * Polls the Sophtron job until it succeeds or times out.
 * Resolves when the job succeeds or accounts are ready,
 * throws an HttpsError on failure or timeout.
 */
async function waitForSophtronJob(jobId: string): Promise<void> {
  const maxAttempts = 15;
  const pollIntervalMs = 4000;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));

    const job = await sophtronPost<SophtronJobStatus>(
      'Job/GetJobInformationByID',
      { JobID: jobId }
    );

    if (job.SuccessFlag === true || job.LastStatus === 'AccountsReady') {
      return;
    }

    if (job.SuccessFlag === false && job.LastStatus === 'Completed') {
      throw new HttpsError('internal', 'Failed to refresh account balance. Please relink your account in Settings.');
    }
  }

  throw new HttpsError('unavailable', 'Balance refresh timed out. Please try again later.');
}

/**
 * Fetches the current balance of the linked checking account via Sophtron.
 * If the balance is not yet available it triggers a refresh and waits for
 * the job to complete before returning the updated balance.
 * Returns `{ balanceCents: number }`.
 */
export const getCheckingBalance = onCall({ cors: ['https://bclennon.github.io'], timeoutSeconds: 120 }, async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'You must be signed in.');
  }

  const snap = await admin
    .firestore()
    .doc(`users/${request.auth.uid}/sophtron/token`)
    .get();

  if (!snap.exists) {
    throw new HttpsError('not-found', 'No linked bank account found. Link your account in Settings.');
  }

  const { userInstitutionId } = snap.data() as { userInstitutionId: string };

  let accounts = await sophtronPost<SophtronAccount[]>(
    'UserInstitution/GetUserInstitutionAccounts',
    { UserInstitutionID: userInstitutionId }
  );

  if (!accounts || accounts.length === 0) {
    throw new HttpsError('not-found', 'No accounts found on the linked institution.');
  }

  let checking = accounts.find(
    (a) => a.AccountType && a.AccountType.toLowerCase().includes('checking')
  );

  if (!checking) {
    throw new HttpsError('not-found', 'No checking account found on the linked institution.');
  }

  // If the balance is stale (null/undefined), trigger a Sophtron refresh and wait.
  if (checking.AccountBalance === null || checking.AccountBalance === undefined) {
    const refreshResult = await sophtronPost<{ JobID: string }>(
      'UserInstitutionAccount/RefreshUserInstitutionAccount',
      { AccountID: checking.AccountID }
    );

    await waitForSophtronJob(refreshResult.JobID);

    accounts = await sophtronPost<SophtronAccount[]>(
      'UserInstitution/GetUserInstitutionAccounts',
      { UserInstitutionID: userInstitutionId }
    );

    checking = accounts.find(
      (a) => a.AccountType && a.AccountType.toLowerCase().includes('checking')
    );

    if (!checking || checking.AccountBalance === null || checking.AccountBalance === undefined) {
      throw new HttpsError(
        'unavailable',
        'Checking account balance is currently unavailable. Please try again later.'
      );
    }
  }

  const balanceCents = Math.round(checking.AccountBalance * 100);
  return { balanceCents };
});
