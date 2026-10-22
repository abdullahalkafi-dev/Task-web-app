import type { ExpoConfig } from 'expo/config';
const config: ExpoConfig = {
  name: 'Dayflow', slug: 'dayflow-mobile', version: '1.0.0', scheme: 'dayflow',
  userInterfaceStyle: 'automatic', icon: './assets/icon.png',
  android: { package: 'com.dayflow.mobile', versionCode: 1, predictiveBackGestureEnabled: true, permissions: ['INTERNET'], blockedPermissions: ['android.permission.READ_EXTERNAL_STORAGE', 'android.permission.WRITE_EXTERNAL_STORAGE', 'android.permission.RECORD_AUDIO', 'android.permission.CAMERA'] },
  plugins: [
    'expo-router', 'expo-secure-store', '@react-native-google-signin/google-signin',
    ['expo-image-picker', { photosPermission: 'Choose images to attach to your Dayflow tasks and notes.', cameraPermission: false, microphonePermission: false }],
    ['expo-build-properties', { android: { minSdkVersion: 31, compileSdkVersion: 37, targetSdkVersion: 36, buildArchs: ['arm64-v8a'], enableMinifyInReleaseBuilds: true, enableShrinkResourcesInReleaseBuilds: true } }],
    './plugins/withDayflow.cjs',
  ],
};
export default config;
