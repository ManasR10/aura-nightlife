// Camera permission + launch helpers for CameraScreen / RecordVideoScreen.
// image-picker asks for CAMERA/RECORD_AUDIO itself, but on Android that request is
// silently dropped if the user previously hit "Don't ask again", so we fire an
// explicit PermissionsAndroid request first and hand back a tagged result the
// caller can turn into a real error message.
import { Alert, PermissionsAndroid, Platform } from 'react-native';
import {
  launchCamera,
  type CameraOptions,
  type ImagePickerResponse,
} from 'react-native-image-picker';

export type CameraResult =
  | { kind: 'success'; uri: string }
  | { kind: 'cancelled' }
  | { kind: 'denied' }
  | { kind: 'error'; message: string };

async function requestAndroidCameraPerms(): Promise<boolean> {
  if (Platform.OS !== 'android') return true;
  try {
    const result = await PermissionsAndroid.requestMultiple([
      PermissionsAndroid.PERMISSIONS.CAMERA,
      PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
    ]);
    return (
      result['android.permission.CAMERA'] === PermissionsAndroid.RESULTS.GRANTED &&
      result['android.permission.RECORD_AUDIO'] === PermissionsAndroid.RESULTS.GRANTED
    );
  } catch (err) {
    console.warn('camera permission request failed:', err);
    return false;
  }
}

function parseResponse(res: ImagePickerResponse): CameraResult {
  if (res.didCancel)        return { kind: 'cancelled' };
  if (res.errorCode === 'permission') return { kind: 'denied' };
  if (res.errorCode)        return { kind: 'error', message: res.errorMessage ?? res.errorCode };
  const uri = res.assets?.[0]?.uri;
  if (uri)                  return { kind: 'success', uri };
  return { kind: 'error', message: 'Camera returned no file.' };
}

/**
 * Request permissions and open the camera. Returns a parsed result the caller
 * can switch on without dealing with image-picker's raw response shape.
 */
export async function launchCameraWithPerms(options: CameraOptions): Promise<CameraResult> {
  const granted = await requestAndroidCameraPerms();
  if (!granted) return { kind: 'denied' };

  return new Promise<CameraResult>((resolve) => {
    launchCamera(options, (res) => resolve(parseResponse(res)));
  });
}

/**
 * Show a user-friendly Alert for non-success camera results. Returns true if
 * the caller should treat this as "user opted out" (cancelled or denied) and
 * navigate back; false if the call genuinely errored and the caller may want
 * to keep the user on screen so they can retry.
 */
export function showCameraError(result: Exclude<CameraResult, { kind: 'success' }>): boolean {
  if (result.kind === 'cancelled') return true;
  if (result.kind === 'denied') {
    Alert.alert(
      'Camera permission required',
      'AURA needs camera and microphone access to record live clips. Enable it in Settings → Apps → AURA → Permissions.',
    );
    return true;
  }
  Alert.alert('Camera unavailable', result.message);
  return false;
}
