import { useEffect, useState } from 'react';
import { router } from 'expo-router';
import { dhakaDateKey, STATUS_LABEL, STATUS_ORDER, type TaskDoc } from '@dayflow/shared';
import { useDocuments } from '../../lib/useDocuments';
import { useDayflow } from '../../lib/context';
import { syncNow } from '../../lib/runtime';
import { TaskList } from '../../components/TaskList';
import { Body, Button, Card, Heading, Screen } from '../../components/ui';
export default function Today() {
  const tasks = useDocuments('task') as TaskDoc[]; const { sync } = useDayflow(); const [today, setToday] = useState(dhakaDateKey());
  useEffect(() => { const timer = setInterval(() => setToday(dhakaDateKey()), 30000); return () => clearInterval(timer); }, []);
  const todayTasks = tasks.filter(task => task.taskDate === today);
  return <Screen><Heading>Today’s tasks</Heading><Body muted>{today} · Dhaka time · Tasks stay on their day</Body><Body muted>{sync.state} · {sync.pending} pending{sync.message ? ` · ${sync.message}` : ''}</Body><Button title="＋ Add task" onPress={() => router.push('/editor?entity=task')} /><Button subtle title="Sync now" onPress={syncNow} />{STATUS_ORDER.map(status => {
    const section = todayTasks.filter(task => task.status === status).sort((a, b) => a.orderIndex - b.orderIndex);
    return <Card key={status}><Body>{STATUS_LABEL[status]} · {section.length}</Body><TaskList tasks={section} /></Card>;
  })}</Screen>;
}
