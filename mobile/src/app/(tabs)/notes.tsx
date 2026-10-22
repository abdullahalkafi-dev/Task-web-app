import { useState } from 'react';
import { router } from 'expo-router';
import { useDocuments } from '../../lib/useDocuments';
import { Body, Button, Card, Heading, Input, Screen } from '../../components/ui';
export default function Notes() { const notes = useDocuments('note'); const [search, setSearch] = useState(''); return <Screen><Heading>Notes</Heading><Input accessibilityLabel="Search notes" placeholder="Search notes" value={search} onChangeText={setSearch} /><Button title="＋ New note" onPress={() => router.push('/editor?entity=note')} />{notes.filter(n => `${n.title} ${n.descriptionText}`.toLowerCase().includes(search.toLowerCase())).map(n => <Card key={n.id}><Body>{n.title}</Body><Body muted>{n.descriptionText || 'No description'}</Body><Button subtle title="Open note" onPress={() => router.push({ pathname: '/editor', params: { entity: 'note', id: n.id } })} /></Card>)}</Screen>; }
