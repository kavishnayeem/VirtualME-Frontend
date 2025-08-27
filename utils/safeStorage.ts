// utils/safeStorage.ts
export async function getItem(key: string): Promise<string | null> {
  try {
    if (typeof localStorage !== 'undefined') return localStorage.getItem(key);
    return null;
  } catch { return null; }
}

export async function setItem(key: string, value: string): Promise<void> {
  try {
    if (typeof localStorage !== 'undefined') localStorage.setItem(key, value);
  } catch {}
}

export async function deleteItem(key: string): Promise<void> {
  try {
    if (typeof localStorage !== 'undefined') localStorage.removeItem(key);
  } catch {}
}
