import { useState } from 'react';
import { GoogleSignin, isSuccessResponse } from '@react-native-google-signin/google-signin';
import { api } from '../lib/api';
import { setSession } from '../lib/runtime';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Body, Button, Card, Heading, Screen } from './ui';
export function Login() {
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  async function signIn() {
    setBusy(true); setError('');
    try {
      const { googleClientId } = await api.config();
      if (!googleClientId) throw new Error('Google sign-in is unavailable. Please try again later.');
      GoogleSignin.configure({ webClientId: googleClientId });
      await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
      const response = await GoogleSignin.signIn();
      if (isSuccessResponse(response)) { if (!response.data.idToken) throw new Error('Google did not return a sign-in token'); await setSession(await api.login(response.data.idToken)); }
    } catch (e) { setError(e instanceof Error ? e.message : 'Sign-in failed'); }
    finally { setBusy(false); }
  }
  return <SafeAreaView style={{ flex: 1 }}><Screen><Heading>Dayflow</Heading><Body>Your tasks and notes, wherever you work.</Body><Card><Body muted>Sign in with the same Google account you use on the website and Windows app.</Body><Button title={busy ? 'Connecting…' : 'Continue with Google'} disabled={busy} onPress={() => void signIn()} />{error ? <Body>{error}</Body> : null}</Card><Body muted>After your first sync, you can work offline. Changes sync when a connection is available.</Body></Screen></SafeAreaView>;
}
