import { useEffect, useState } from 'react';
import type { Document, Entity } from '@dayflow/shared';
import { repository } from '../../modules/dayflow-native';
import { useDayflow } from './context';
export function useDocuments(entity: Entity) {
  const { session, revision } = useDayflow(); const [docs, setDocs] = useState<Document[]>([]);
  useEffect(() => { let live = true; if (session) void repository.list(session.user.id, entity).then(rows => { if (live) setDocs(rows.filter(d => !d.deletedAt).sort((a, b) => a.orderIndex - b.orderIndex)); }); return () => { live = false; }; }, [session, entity, revision]);
  return docs;
}
