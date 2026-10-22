import { native } from '../../modules/dayflow-native';
const writes = new Map<string, Promise<void>>();
/** Keep asynchronous bridge calls ordered; an older draft must never win a race. */
export function persistDraft(user: string, key: string, value: string | null): Promise<void> {
  const identity = `${user}:${key}`;
  const previous = writes.get(identity) ?? Promise.resolve();
  const next = previous.catch(() => undefined).then(() => native.setMeta(user, key, value));
  writes.set(identity, next);
  return next;
}
export async function flushDrafts() { await Promise.all([...writes.values()]); }
