/**
 * Claudeのアーティファクト専用API（window.storage）を
 * ブラウザのlocalStorageで代替する互換レイヤー。
 * これがあるので、window.storage を使うアーティファクトも書き換えずに動きます。
 * データはその端末・そのブラウザにだけ保存されます。
 */
if (typeof window !== 'undefined' && !window.storage) {
  const PREFIX = 'kidsgames:'
  const safe = (fn, fallback) => {
    try {
      return fn()
    } catch {
      return fallback
    }
  }

  window.storage = {
    async get(key) {
      const value = safe(() => localStorage.getItem(PREFIX + key), null)
      return value === null ? null : { key, value }
    },
    async set(key, value) {
      safe(() => localStorage.setItem(PREFIX + key, value))
      return { key, value }
    },
    async delete(key) {
      safe(() => localStorage.removeItem(PREFIX + key))
      return { key, deleted: true }
    },
    async list(prefix = '') {
      const keys = safe(
        () =>
          Object.keys(localStorage)
            .filter((k) => k.startsWith(PREFIX + prefix))
            .map((k) => k.slice(PREFIX.length)),
        [],
      )
      return { keys }
    },
  }
}
