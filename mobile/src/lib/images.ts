import type { Entity } from '@dayflow/shared';
import { native, repository } from '../../modules/dayflow-native';

/** Copies must own their pending files so source deletion/upload cannot break them. */
export async function copyPendingImages(user: string, entity: Entity, id: string, html: string) {
  let copy = html;
  for (const image of await repository.uploads(user)) {
    if (!copy.includes(image.localId)) continue;
    const queued = JSON.parse(await native.queueImage(user, entity, id, image.uri, image.mime)) as { localId: string };
    copy = copy.replaceAll(image.localId, queued.localId);
  }
  return copy;
}
