import { useState } from 'react';
import { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { dhakaDateKey, type TaskDoc } from '@dayflow/shared';
import { useDocuments } from '../../lib/useDocuments';
import { TaskList } from '../../components/TaskList';
import { Body, Button, Heading, Row, Screen } from '../../components/ui';
export default function History() {
  const tasks = useDocuments('task') as TaskDoc[]; const [date, setDate] = useState(() => dhakaDateKey(Date.now() - 86400000));
  const days = [...new Set(tasks.map(t => t.taskDate))].sort().reverse();
  return <Screen><Heading>History</Heading><Button subtle title={date} onPress={() => DateTimePickerAndroid.open({ value: new Date(`${date}T12:00:00+06:00`), mode: 'date', timeZoneName: 'Asia/Dhaka', onChange: (event, selected) => { if (event.type === 'set' && selected) setDate(dhakaDateKey(selected)); } })} /><Body muted>Choose a day. Copy a task to Today to start it again.</Body><Row>{days.slice(0, 14).map(day => <Button subtle key={day} title={day} onPress={() => setDate(day)} />)}</Row><TaskList history tasks={tasks.filter(t => t.taskDate === date)} /></Screen>;
}
