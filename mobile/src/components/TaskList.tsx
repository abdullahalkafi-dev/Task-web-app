import { Alert } from 'react-native';
import { useEffect, useState } from 'react';
import { router } from 'expo-router';
import { randomUUID } from 'expo-crypto';
import { STATUS_LABEL, type TaskDoc } from '@dayflow/shared';
import { repository } from '../../modules/dayflow-native';
import { copyPendingImages } from '../lib/images';
import { useDayflow } from '../lib/context';
import { Body, Button, Card, Row } from './ui';
export function TaskList({ tasks, history = false }: { tasks: TaskDoc[]; history?: boolean }) {
  const { session } = useDayflow();
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 30000); return () => clearInterval(timer); }, []);
  async function change(task: TaskDoc) { if (session) await repository.mutate(session.user.id, 'task', { id: task.id, status: task.status === 'completed' ? 'notStarted' : task.status === 'started' ? 'completed' : 'started' }); }
  async function move(task: TaskDoc, direction: number) { const other = tasks[tasks.indexOf(task) + direction]; if (other && session) { await repository.mutate(session.user.id, 'task', { id: task.id, orderIndex: other.orderIndex }); await repository.mutate(session.user.id, 'task', { id: other.id, orderIndex: task.orderIndex }); } }
  async function copy(task: TaskDoc) {
    if (!session) return;
    const id = randomUUID(); const html = await copyPendingImages(session.user.id, 'task', id, task.descriptionHtml);
    await repository.mutate(session.user.id, 'task', { id, title: task.title, descriptionHtml: html, descriptionText: task.descriptionText, estimatedMinutes: task.estimatedMinutes, copiedFromDate: task.taskDate, copiedFromTaskId: task.id });
    Alert.alert('Copied', 'Added to Today.');
  }
  const safely = (work: Promise<unknown>) => { void work.catch(e => Alert.alert('Could not save', String(e))); };
  return <>{tasks.length === 0 ? <Card><Body muted>No tasks for this day.</Body></Card> : tasks.map(task => <Card key={task.id}>
    <Body>{task.title}</Body><Body muted>{STATUS_LABEL[task.status]} · {task.estimatedMinutes ? `${task.estimatedMinutes} min` : 'No estimate'}</Body>
    {task.descriptionText ? <Body muted>{task.descriptionText}</Body> : null}
    {task.reminderAt ? <Body muted>{Date.parse(task.reminderAt) < now && task.status !== 'completed' ? 'Overdue · ' : 'Reminder · '}{new Date(task.reminderAt).toLocaleString('en-GB', { timeZone: 'Asia/Dhaka' })} Dhaka</Body> : null}
    <Row><Button subtle title="Edit" onPress={() => router.push({ pathname: '/editor', params: { entity: 'task', id: task.id } })} />{history ? <Button title="Copy to Today" onPress={() => safely(copy(task))} /> : <><Button title={task.status === 'completed' ? 'Reopen' : task.status === 'started' ? 'Complete' : 'Start'} onPress={() => safely(change(task))} /><Button subtle title="↑" onPress={() => safely(move(task, -1))} /><Button subtle title="↓" onPress={() => safely(move(task, 1))} /></>}</Row>
  </Card>)}</>;
}
