/* 白天打断 · 原生本地通知
 * 仅在原生平台（Android）调度，桌面/浏览器调试自动跳过。
 * 解决纯 Web 在页面不打开时无法定时推送的问题：通知在原生层调度，
 * 用户点击通知打开 App 后，daytime 页自然显示当天打断问题（与现有逻辑一致）。
 */
import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';

export async function scheduleDaytimeInterrupt(question) {
  if (!Capacitor.isNativePlatform()) return false;
  try {
    const perm = await LocalNotifications.requestPermissions();
    if (!perm.display || perm.display !== 'granted') return false;

    const now = new Date();
    let at = new Date(now);
    // 当天 9:00–21:00 之间随机一个时刻
    at.setHours(9 + Math.floor(Math.random() * 12), Math.floor(Math.random() * 60), 0, 0);
    // 若该时刻已过，则排到当前时间之后 5–95 分钟内
    if (at.getTime() <= now.getTime()) {
      at = new Date(now.getTime() + (5 + Math.floor(Math.random() * 90)) * 60000);
    }

    await LocalNotifications.schedule({
      notifications: [
        {
          id: 1,
          title: '人生重启 · 打断',
          body: question,
          schedule: { at },
          extra: { screen: 'daytime' }
        }
      ]
    });
    return true;
  } catch (e) {
    return false;
  }
}

// 处理通知点击（可选）：直接打开 App 即可，daytime 页会显示当天问题
export function registerNotificationOpenHandler(onOpen) {
  if (!Capacitor.isNativePlatform()) return;
  try {
    LocalNotifications.addListener('localNotificationActionPerformed', () => {
      onOpen && onOpen();
    });
  } catch (_) { /* ignore */ }
}
