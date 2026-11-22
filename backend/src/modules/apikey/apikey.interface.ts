export const API_KEY_PREFIX = "dfk_";
export const MAX_KEYS_PER_USER = 20;

export interface IApiKey {
  _id: string;
  userId: string;
  name: string;
  prefix: string;
  hash: string;
  write: boolean;
  createdAt: Date;
  lastUsedAt: Date | null;
}

export interface ApiKeyPublic {
  id: string;
  name: string;
  prefix: string;
  write: boolean;
  createdAt: string;
  lastUsedAt: string | null;
}
