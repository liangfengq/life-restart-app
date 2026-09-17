const fs = require('fs');
const env = process.env;
const ex = (p) => fs.existsSync(p);
console.log('=== 环境变量 ===');
console.log('JAVA_HOME:', env.JAVA_HOME || '(未设置)');
console.log('ANDROID_HOME:', env.ANDROID_HOME || '(未设置)');
console.log('ANDROID_SDK_ROOT:', env.ANDROID_SDK_ROOT || '(未设置)');
console.log('GRADLE_HOME:', env.GRADLE_HOME || '(未设置)');
console.log('=== JDK 常见路径 ===');
const jdkDirs = [
  'C:/Program Files/Java',
  'C:/Program Files/Eclipse Adoptium',
  'C:/Program Files/AdoptOpenJDK',
  'C:/Program Files/Zulu',
  'C:/Users/liang/.jdks'
];
for (const d of jdkDirs) {
  if (ex(d)) console.log('FOUND ' + d + ' -> ' + fs.readdirSync(d).join(', '));
}
console.log('=== Android SDK / Studio ===');
const sdkDirs = [
  'C:/Users/liang/AppData/Local/Android/Sdk',
  'C:/Android/Sdk',
  'C:/Program Files/Android/Android Studio'
];
for (const d of sdkDirs) console.log((ex(d) ? 'FOUND ' : 'miss  ') + d);
console.log('=== 工程状态 ===');
const proj = 'C:/Users/liang/WorkBuddy/2026-09-16-14-14-19/life-restart-app';
console.log('android/ exists:', ex(proj + '/android'));
const apkDir = proj + '/android/app/build/outputs/apk';
console.log('apk dir:', ex(apkDir) ? ('存在 -> ' + fs.readdirSync(apkDir).join(',')) : '不存在(未构建过)');
