/**
 * RecordVideoScreen — opened from a venue detail page.
 * Launches camera immediately with the venue pre-selected, then delegates
 * the upload UI to the shared <UploadFlow>.
 */
import React, { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { COLORS, SPACING } from '../theme';
import { IconBack } from '../components/Icon';
import { UploadFlow } from '../components/UploadFlow';
import { launchCameraWithPerms, showCameraError } from '../utils/camera';
import type { RootStackParamList } from '../types';

type Props = NativeStackScreenProps<RootStackParamList, 'RecordVideo'>;

export function RecordVideoScreen({ navigation, route }: Props) {
  const insets = useSafeAreaInsets();
  const { venueId, venueName, fromCheckin } = route.params;
  const launched = useRef(false);
  const [videoUri, setVideoUri] = useState<string | null>(null);

  useEffect(() => {
    if (launched.current) return;
    launched.current = true;
    (async () => {
      const result = await launchCameraWithPerms({
        mediaType: 'video', videoQuality: 'high', durationLimit: 30, includeBase64: false,
      });
      if (result.kind === 'success') {
        setVideoUri(result.uri);
      } else {
        const shouldLeave = showCameraError(result);
        if (shouldLeave) navigation.goBack();
      }
    })();
  }, [navigation]);

  const handleUploadSuccess = fromCheckin
    ? () => navigation.navigate('ClaimReward', { venueId, venueName })
    : undefined;

  return (
    <View style={{ flex: 1, backgroundColor: COLORS.bg }}>
      {videoUri && (
        <Pressable
          style={[backStyles.btn, { top: insets.top + SPACING.sm }]}
          onPress={() => navigation.goBack()}
        >
          <IconBack size={20} color={COLORS.white} />
        </Pressable>
      )}
      <UploadFlow
        videoUri={videoUri}
        preselectedVenueId={venueId}
        preselectedVenueName={venueName}
        onUploadSuccess={handleUploadSuccess}
        onRetakePress={async () => {
          launched.current = false;
          setVideoUri(null);
          launched.current = true;
          const result = await launchCameraWithPerms({
            mediaType: 'video', videoQuality: 'high', durationLimit: 30, includeBase64: false,
          });
          if (result.kind === 'success') setVideoUri(result.uri);
          else                            showCameraError(result);
        }}
      />
    </View>
  );
}

const backStyles = StyleSheet.create({
  btn: {
    position:          'absolute',
    left:              SPACING.base,
    zIndex:            10,
    width:             36,
    height:            36,
    borderRadius:      18,
    backgroundColor:   'rgba(0,0,0,0.5)',
    alignItems:        'center',
    justifyContent:    'center',
  },
});
