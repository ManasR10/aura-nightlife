/**
 * Dev-only "Seed test admin" button shown under the entry screen in __DEV__
 * builds. Calls the seedPseudoAdmin Cloud Function with the SEED_ADMIN_*
 * values from env.ts so a developer can quickly provision a venue admin.
 */
import React, { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, Text } from 'react-native';
import { fnSouth } from '../../firebase/fns';
import { SEED_ADMIN_EMAIL, SEED_ADMIN_PASSWORD } from '../../env';
import { authStyles as s } from './AuthPrimitives';

export function SeedAdminBtn() {
  const [seeding, setSeeding] = useState(false);

  async function seed() {
    if (!SEED_ADMIN_EMAIL || !SEED_ADMIN_PASSWORD) {
      Alert.alert('Config missing', 'Set SEED_ADMIN_EMAIL/PASSWORD in env.ts');
      return;
    }
    setSeeding(true);
    try {
      const r = await fnSouth.httpsCallable('seedPseudoAdmin')({
        email:    SEED_ADMIN_EMAIL,
        password: SEED_ADMIN_PASSWORD,
      });
      const d = r.data as { email: string; venueId: string; venueName: string };
      Alert.alert('✅ Admin created', `Email: ${d.email}\n${d.venueName}`);
    } catch (e: unknown) {
      Alert.alert('Seed failed', e instanceof Error ? e.message : String(e));
    } finally {
      setSeeding(false);
    }
  }

  return (
    <Pressable style={s.seedBtn} onPress={seed} disabled={seeding}>
      {seeding
        ? <ActivityIndicator color="#6b7280" size="small" />
        : <Text style={s.seedText}>🛠 Seed test admin</Text>
      }
    </Pressable>
  );
}
