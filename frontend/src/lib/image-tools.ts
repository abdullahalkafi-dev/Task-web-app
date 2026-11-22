import { request } from "./api";

export interface ImageVersion {
  url: string;
  createdAt: string;
}

const TEAM_IMAGE = /^\/uploads\/teams\/([a-f0-9-]{36})\/([a-f0-9-]{36}\.(?:webp|gif))$/;
const PERSONAL_IMAGE = /^\/uploads\/([a-zA-Z0-9-]{8,64})\/([a-f0-9-]{36}\.(?:webp|gif))$/;

/** Path (without origin or query) of a stored Dayflow image, or null for blobs / external images. */
export function storedImagePath(src: string): string | null {
  try {
    const url = new URL(src, window.location.origin);
    if (url.origin !== window.location.origin) return null;
    return TEAM_IMAGE.test(url.pathname) || PERSONAL_IMAGE.test(url.pathname)
      ? url.pathname
      : null;
  } catch {
    return null;
  }
}

/** Hidden earlier versions (newest first, including this image). Empty for unedited or unstored images. */
export async function fetchVersions(src: string): Promise<ImageVersion[]> {
  const path = storedImagePath(src);
  if (!path) return [];
  const team = TEAM_IMAGE.exec(path);
  const personal = PERSONAL_IMAGE.exec(path);
  const apiPath = team
    ? `/teams/${team[1]}/uploads/${team[2]}/versions`
    : `/uploads/${personal![1]}/${personal![2]}/versions`;
  const { versions } = await request<{ versions: ImageVersion[] }>(
    "GET",
    apiPath,
  );
  return versions;
}

/** Uploads a marked-up image so it replaces `src` (the old file is kept hidden on the server). */
export async function uploadMarkup(
  src: string,
  blob: Blob,
): Promise<{ url: string }> {
  const path = storedImagePath(src);
  if (!path) throw new Error("This image cannot be edited.");
  const team = TEAM_IMAGE.exec(path);
  const personal = PERSONAL_IMAGE.exec(path);
  const form = new FormData();
  form.append("replaces", (team ?? personal)![2]);
  form.append("file", blob, "markup.png");
  return request<{ url: string }>(
    "POST",
    team ? `/teams/${team[1]}/uploads` : "/uploads",
    form,
  );
}

export function downloadName(src: string): string {
  const file = src.split("?")[0].split("/").pop() ?? "image";
  return /\.(webp|gif|png|jpe?g)$/i.test(file) ? file : `${file || "image"}.png`;
}
