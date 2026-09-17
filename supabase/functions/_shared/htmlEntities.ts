/**
 * I2(관리자 검토 2026-09-16) — 네이버/유튜브 API가 title·description을
 * HTML 인코딩된 채로 돌려줘(`&#39;`, `&amp;` 등) 수집 원문·인사이트
 * 화면에 그대로 노출됐다. 태그 제거(stripHtml)와는 별개 문제라 디코딩을
 * 추가한다.
 */
const NAMED_ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
};

export function decodeHtmlEntities(text: string | null | undefined): string | null {
  if (!text) return text ?? null;
  return text.replace(/&(#x[0-9a-fA-F]+|#\d+|[a-zA-Z]+);/g, (match, entity: string) => {
    if (entity[0] === '#') {
      const code =
        entity[1] === 'x' || entity[1] === 'X'
          ? parseInt(entity.slice(2), 16)
          : parseInt(entity.slice(1), 10);
      return Number.isNaN(code) ? match : String.fromCodePoint(code);
    }
    return NAMED_ENTITIES[entity] ?? match;
  });
}
