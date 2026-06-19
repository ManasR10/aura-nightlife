import firebase from '@react-native-firebase/app';
import auth from '@react-native-firebase/auth';

// Importing this file at app startup ensures the native Firebase app is ready
// before any auth or Firestore calls run.
const firebaseApp = firebase.app();

export const firebaseAuth = auth();

export default firebaseApp;
