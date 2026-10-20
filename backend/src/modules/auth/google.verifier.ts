import { OAuth2Client } from "google-auth-library";
import { config } from "../../config/env";

export interface GoogleIdentity {
  sub: string;
  email: string;
  emailVerified: boolean;
  name?: string;
}

let client: OAuth2Client | undefined;

/** Verifies a Google Identity Services ID token (signature, expiry, audience). Returns null when invalid. */
export async function verifyGoogleCredential(credential: string): Promise<GoogleIdentity | null> {
  if (!config.GOOGLE_CLIENT_ID) return null;
  client ??= new OAuth2Client(config.GOOGLE_CLIENT_ID);
  try {
    const ticket = await client.verifyIdToken({ idToken: credential, audience: config.GOOGLE_CLIENT_ID });
    const p = ticket.getPayload();
    if (!p?.sub || !p.email) return null;
    return { sub: p.sub, email: p.email, emailVerified: p.email_verified === true, ...(p.name ? { name: p.name } : {}) };
  } catch {
    return null;
  }
}
