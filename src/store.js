/* 存储抽象层
 * - 原生平台：用 @capacitor/preferences（原生 KV，只有清应用数据才丢）
 * - 桌面/浏览器调试：降级 localStorage
 * 对外暴露同步语义 load/save（内部用内存缓存 + 异步持久化），
 * 这样现有业务代码几乎不用改。启动时必须先 await init()。
 */
let mem = {};
let nativePref = null;

export async function init() {
  try {
    const mod = await import('@capacitor/preferences');
    const P = mod.Preferences;
    nativePref = P;
    const { keys } = await P.keys();
    for (const k of (keys.keys || [])) {
      const { value } = await P.get({ key: k });
      if (value != null) {
        try { mem[k] = JSON.parse(value); } catch (_) { /* ignore */ }
      }
    }
  } catch (e) {
    // 降级到浏览器 localStorage（桌面调试；node 测试时也会走这里）
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        const v = localStorage.getItem(k);
        if (v != null) { try { mem[k] = JSON.parse(v); } catch (_) { /* ignore */ } }
      }
    } catch (_) { /* 无 localStorage 环境，仅用内存 */ }
  }
}

export function load(k, d) {
  return Object.prototype.hasOwnProperty.call(mem, k) ? mem[k] : d;
}

export function save(k, v) {
  mem[k] = v;
  if (nativePref) {
    nativePref.set({ key: k, value: JSON.stringify(v) }).catch(() => {});
  } else {
    try { localStorage.setItem(k, JSON.stringify(v)); } catch (_) { /* ignore */ }
  }
}

export function all() {
  return mem;
}
