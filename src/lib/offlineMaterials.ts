/**
 * 여행 자료(사진·파일)를 Cache Storage API로 오프라인 저장한다 — Plus 전용
 * 킬러기능. 서명 URL은 1시간마다 바뀌지만(getMaterialSignedUrl), 캐시 키는
 * materialId로 고정한 가짜 same-origin URL을 쓴다 — 한 번 받아둔 바이트는
 * 나중에 토큰이 바뀌어도 그대로 재생 가능해야 하기 때문이다.
 */

const OFFLINE_MATERIALS_CACHE = 'wayknit-offline-materials-v1';

function offlineMaterialKey(materialId: string): string {
  return `/_offline/material/${materialId}`;
}

export function isOfflineCacheSupported(): boolean {
  return typeof caches !== 'undefined';
}

export async function isMaterialOffline(materialId: string): Promise<boolean> {
  if (!isOfflineCacheSupported()) return false;
  try {
    const cache = await caches.open(OFFLINE_MATERIALS_CACHE);
    return Boolean(await cache.match(offlineMaterialKey(materialId)));
  } catch {
    return false;
  }
}

/** sourceUrl(서명 URL 또는 오프라인 blob URL)에서 바이트를 받아 캐시에 저장한다 */
export async function saveMaterialOffline(materialId: string, sourceUrl: string): Promise<boolean> {
  if (!isOfflineCacheSupported()) return false;
  try {
    const res = await fetch(sourceUrl);
    if (!res.ok) return false;
    const cache = await caches.open(OFFLINE_MATERIALS_CACHE);
    await cache.put(offlineMaterialKey(materialId), res.clone());
    return true;
  } catch {
    return false;
  }
}

export async function removeMaterialOffline(materialId: string): Promise<void> {
  if (!isOfflineCacheSupported()) return;
  try {
    const cache = await caches.open(OFFLINE_MATERIALS_CACHE);
    await cache.delete(offlineMaterialKey(materialId));
  } catch {
    /* ignore */
  }
}

/** 캐시된 바이트를 blob URL로 반환 — 서명 URL 발급이 안 되는(오프라인) 상황의 대체 표시용 */
export async function getOfflineMaterialObjectUrl(materialId: string): Promise<string | null> {
  if (!isOfflineCacheSupported()) return null;
  try {
    const cache = await caches.open(OFFLINE_MATERIALS_CACHE);
    const res = await cache.match(offlineMaterialKey(materialId));
    if (!res) return null;
    const blob = await res.blob();
    return URL.createObjectURL(blob);
  } catch {
    return null;
  }
}

/** 이 여행에서 지금 캐시된 것 중 목록에 없는 materialId는 정리한다(자료 삭제 후 잔여 캐시 방지) */
export async function pruneOfflineMaterials(keepIds: Set<string>): Promise<void> {
  if (!isOfflineCacheSupported()) return;
  try {
    const cache = await caches.open(OFFLINE_MATERIALS_CACHE);
    const requests = await cache.keys();
    for (const req of requests) {
      const id = req.url.split('/_offline/material/')[1];
      if (id && !keepIds.has(decodeURIComponent(id))) {
        await cache.delete(req);
      }
    }
  } catch {
    /* ignore */
  }
}
