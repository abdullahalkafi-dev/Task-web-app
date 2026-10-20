import { expect, type APIRequestContext, type Page } from "@playwright/test";

/** A fake Google identity. The e2e backend stubs token verification (see stub-google.cjs). */
export interface Creds {
  email: string;
  credential: string;
}

export function makeCreds(sub: string, email: string): Creds {
  return { email, credential: `e2e-credential:${sub}:${email}` };
}

/** SUPERADMIN_EMAILS in e2e/stack.mjs lists this address. */
export const ADMIN = makeCreds("e2e-admin", "admin@e2e.test");

interface LoginResponse {
  token: string;
  user: { id: string; role: string };
}

export async function apiLogin(request: APIRequestContext, creds: Creds): Promise<LoginResponse> {
  const res = await request.post("/api/auth/google", { data: { credential: creds.credential } });
  expect(res.ok()).toBeTruthy();
  return (await res.json()) as LoginResponse;
}

/** A fresh regular user. The account itself is created on its first sign-in. */
export async function createUser(_request: APIRequestContext, prefix = "e2e"): Promise<Creds> {
  const sub = `${prefix}_${Date.now().toString(36)}${Math.floor(Math.random() * 1000)}`;
  return makeCreds(sub, `${sub}@e2e.test`);
}

const FAKE_GSI = `
  (() => {
    let cb;
    window.google = { accounts: { id: {
      initialize: (o) => { cb = o.callback; },
      renderButton: (el) => {
        const b = document.createElement("button");
        b.type = "button";
        b.textContent = "Continue with Google";
        b.onclick = () => cb({ credential: window.__e2eCredential });
        el.appendChild(b);
      },
    } } };
  })();
`;

/** Signs in through the real login page, with Google's script replaced by a one-button fake. */
export async function uiLogin(page: Page, creds: Creds): Promise<void> {
  await page.context().route("https://accounts.google.com/gsi/client", (route) =>
    route.fulfill({ contentType: "text/javascript", body: FAKE_GSI }),
  );
  await page.addInitScript((credential) => {
    (window as unknown as { __e2eCredential: string }).__e2eCredential = credential;
  }, creds.credential);
  await page.goto("/login");
  await page.getByRole("button", { name: "Continue with Google" }).click();
  await expect(page.getByTestId("today-date")).toBeVisible();
}

export async function addTask(page: Page, title: string): Promise<void> {
  await page.getByTestId("add-task").click();
  await page.getByLabel("Task title").fill(title);
  await page.getByRole("button", { name: "Save task" }).click();
  await expect(page.getByTestId("task-card").filter({ hasText: title })).toBeVisible();
}
