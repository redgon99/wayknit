/**
 * KorPetTourService2(반려동물 동반여행)/KorWithService2(무장애여행) —
 * KorService2와 같은 contentId 공간을 쓰는 "필터형" 서비스라 새 후보를 만들지 않고,
 * 이미 확정된 시나리오 스팟에 배지(반려동물 동반가능/무장애 시설)를 붙이는 용도로만 쓴다.
 * detailCommon2로 해당 contentId가 그 서비스 목록에 존재하는지만 확인한다
 * (totalCount>0 = 존재). GoCamping처럼 별도 ID 공간을 쓰는 스팟은 애초에 매칭될 수
 * 없으므로 검사 대상에서 제외한다.
 */

function keyParam(serviceKey: string): string {
  return serviceKey.includes('%')
    ? `serviceKey=${serviceKey}`
    : `serviceKey=${encodeURIComponent(serviceKey)}`;
}

function buildDetailUrl(base: string, contentId: string, serviceKey: string): string {
  const params = new URLSearchParams({
    MobileOS: 'ETC',
    MobileApp: 'Wayknit',
    _type: 'json',
    contentId,
  });
  return `https://apis.data.go.kr/B551011/${base}/detailCommon2?${keyParam(serviceKey)}&${params.toString()}`;
}

async function existsIn(base: string, contentId: string, serviceKey: string): Promise<boolean> {
  try {
    const res = await fetch(buildDetailUrl(base, contentId, serviceKey), {
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) return false;
    const json = (await res.json()) as { response?: { body?: { totalCount?: number } } };
    return (json.response?.body?.totalCount ?? 0) > 0;
  } catch {
    return false;
  }
}

export interface StopTags {
  petFriendly: boolean;
  accessible: boolean;
}

/**
 * 시나리오 최종 스팟들의 contentId를 받아 반려동물/무장애 배지 여부를 병렬 조회한다.
 * GoCamping 등 KorService2 ID 공간이 아닌 스팟(contentId에 ':' 포함)은 건너뛴다.
 */
export async function fetchStopTags(
  contentIds: string[],
  serviceKey: string
): Promise<Map<string, StopTags>> {
  const checkable = [...new Set(contentIds)].filter((id) => id && !id.includes(':'));
  const result = new Map<string, StopTags>();
  await Promise.all(
    checkable.map(async (id) => {
      const [petFriendly, accessible] = await Promise.all([
        existsIn('KorPetTourService2', id, serviceKey),
        existsIn('KorWithService2', id, serviceKey),
      ]);
      if (petFriendly || accessible) result.set(id, { petFriendly, accessible });
    })
  );
  return result;
}
