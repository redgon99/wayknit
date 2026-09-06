import type { Place, SimpleCategory } from '../types';

/**
 * Wayknit Planner PC 시안 아이콘 세트 — Unicode 컬러 이모지.
 * 맛집은 카테고리/상호 키워드로 세분화 (피자·치킨·고기 등).
 */
export const CATEGORY_EMOJI: Record<SimpleCategory | 'mart' | 'sight', string> = {
  food: '🍽',
  cafe: '☕',
  tour: '🌋',
  sight: '🌋',
  stay: '🏨',
  culture: '🎭',
  shop: '🛒',
  mart: '🛒',
  beauty: '💄',
  market: '🛒',
  transport: '🚌',
  road: '🛣',
  other: '📍',
};

/** 구체적 → 일반 순. 먼저 매칭된 규칙 사용 */
const FOOD_EMOJI_RULES: Array<{ re: RegExp; emoji: string }> = [
  // 치킨·닭
  { re: /치킨|닭발|닭갈비|통닭|후라이드|양념치킨|bhc|교촌|bbq|네네|페리카나|순살|토종닭|닭볶|chicken|fried\s*chicken/i, emoji: '🍗' },
  // 피자
  { re: /피자|pizza/i, emoji: '🍕' },
  // 햄버거·패스트푸드
  { re: /버거|햄버거|hamburger|burger|맥도날|버거킹|롯데리아|맘스터치|쉐이크쉑/i, emoji: '🍔' },
  // 고기·구이·곱창
  { re: /곱창|막창|대창|삼겹|갈비|한우|소고기|돼지고기|육회|스테이크|barbecue|바베큐|숯불|화로|고기집|육류|불고기|차돌|양념갈비|로스트|steak|grill|구이/i, emoji: '🥩' },
  // 해산물·회
  { re: /회\b|횟집|초밥|스시|sushi|사시미|새우|게장|대게|킹크랩|조개|해산물|해물|생선|굴\b|문어|오징어|주꾸미|seafood|shrimp|lobster|crab/i, emoji: '🦐' },
  // 면·국수·파스타
  { re: /라멘|라면|국수|우동|소바|파스타|pasta|냉면|칼국수|잔치국수|쫄면|비빔국수|쌀국수|pho|noodle|ramen|udon|soba|면요리|중화면|짜장|짬뽕/i, emoji: '🍜' },
  // 일식 (면·회 이후)
  { re: /일식|돈가스|돈까스|덮밥|규동|카레|일본|이자카야|오마카세|japanese|tonkatsu|donburi/i, emoji: '🍱' },
  // 중식
  { re: /중식|중국|딤섬|마라|탕수육|깐풍|양꼬치|중국집|chinese|dim\s*sum|hotpot|훠궈/i, emoji: '🥡' },
  // 분식·김밥
  { re: /분식|김밥|떡볶이|순대|튀김|어묵|오뎅|핫도그|토스트|샌드위치|김밥천국/i, emoji: '🍙' },
  // 밥·한식 일반
  { re: /백반|정식|국밥|설렁탕|곰탕|감자탕|찌개|비빔밥|돌솥|한식|백숙|보쌈|족발|쌈밥|도시락/i, emoji: '🍚' },
  // 탕·국
  { re: /탕\b|전골|샤브|soup|stew|hot\s*pot/i, emoji: '🍲' },
  // 빵·디저트
  { re: /베이커리|빵집|케이크|디저트|빙수|아이스크림|와플|크로플|도넛|bakery|dessert|cake|ice\s*cream/i, emoji: '🥐' },
  // 술·바
  { re: /호프|맥주|포차|술집|와인바|칵테일|\bbar\b|pub|포장마차|막걸리/i, emoji: '🍺' },
  // 채식
  { re: /비건|채식|vegan|vegetarian|할랄|halal/i, emoji: '🥗' },
  // 양식·브런치
  { re: /양식|브런치|brunch|웨스턴|western|salad|샐러드|이탈리|italian/i, emoji: '🍝' },
];

const PLACE_EMOJI_RULES: Array<{ re: RegExp; emoji: string }> = [
  { re: /카페|coffee|커피|티룸|tea\s*house|에스프레소/i, emoji: '☕' },
  {
    re: /편의점|cu\b|씨유|gs25|세븐일레븐|이마트24|미니스톱|패밀리마트|familymart|convenience|7-eleven/i,
    emoji: '🏪',
  },
  {
    re: /마트|슈퍼|supermarket|이마트|홈플러스|코스트코|하나로|롯데마트/i,
    emoji: '🛒',
  },
  { re: /해변|비치|beach|해수욕/i, emoji: '🏖' },
  { re: /해안|coast|바다|ocean|wave/i, emoji: '🌊' },
  { re: /일출봉|오름|volcano|peak|hike|등반|등산/i, emoji: '🌋' },
  { re: /호텔|hotel|리조트|resort/i, emoji: '🏨' },
  { re: /게스트|guesthouse|펜션|hostel|모텔|motel/i, emoji: '🛏' },
  { re: /스테이|stay|숙소|한옥/i, emoji: '🏡' },
  { re: /박물관|미술관|전시|museum|gallery/i, emoji: '🎭' },
  { re: /공원|park|테마파크/i, emoji: '🌳' },
];

/** 장소명·카테고리로 이모지 선택 (맛집은 세부 키워드 우선) */
export function getPlaceEmoji(
  place: Pick<
    Place,
    'name' | 'category' | 'categoryLabel' | 'categoryDetail' | 'categoryCode'
  >
): string {
  const hay = `${place.name} ${place.categoryLabel ?? ''} ${place.categoryDetail ?? ''}`;
  const isFood =
    place.category === 'food' ||
    place.categoryCode === 'FD6' ||
    /음식|맛집|식당|레스토랑|restaurant|food/i.test(hay);

  if (isFood) {
    for (const rule of FOOD_EMOJI_RULES) {
      if (rule.re.test(hay)) return rule.emoji;
    }
  }

  for (const rule of PLACE_EMOJI_RULES) {
    if (rule.re.test(hay)) return rule.emoji;
  }

  // 카페 코드
  if (place.category === 'cafe' || place.categoryCode === 'CE7') return '☕';
  if (place.categoryCode === 'CS2') return '🏪';
  if (place.categoryCode === 'MT1') return '🛒';

  const cat = place.category;
  if (cat && cat in CATEGORY_EMOJI) return CATEGORY_EMOJI[cat];
  return CATEGORY_EMOJI.other;
}
