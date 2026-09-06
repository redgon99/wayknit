import {
  Callout,
  Card,
  CardBody,
  CardHeader,
  Divider,
  Grid,
  H1,
  H2,
  H3,
  Link,
  Pill,
  Row,
  Stack,
  Stat,
  Table,
  Text,
  UsageBar,
} from 'cursor/canvas';

export default function MyRealTripVsWayknit() {
  return (
    <Stack gap={22}>
      <Stack gap={6}>
        <H1>여로담 vs 마이리얼트립</H1>
        <Text tone="secondary">
          공개 사이트·보도자료와 여로담(Wayknit) 현재 제품 범위 기준. 직접 경쟁사가
          아니라 여행 가치사슬의 다른 칸을 차지한다.
        </Text>
        <Row gap={8} wrap>
          <Pill active>결론: 예약 슈퍼앱 vs 동선 플래너</Pill>
          <Pill>겹침은 작음</Pill>
          <Pill>여로담 모트: 시간표 동선</Pill>
        </Row>
      </Stack>

      <Callout tone="info" title="한 줄">
        마이리얼트립은 ‘무엇을 살지’를 판다. 여로담은 ‘언제 어디로 갈지’를 짠다.
        같은 여행 앱으로 보이지만 수익·재고·핵심 UX가 다르다.
      </Callout>

      <Grid columns={4} gap={12}>
        <Stat value="예약 마켓" label="마이리얼트립 핵심 일" />
        <Stat value="동선 설계" label="여로담 핵심 일" />
        <Stat value="1,000만" label="MRT 누적 가입자 (2025.10 보도)" />
        <Stat value="시범→정식" label="여로담 단계 (2026.8–9)" />
      </Grid>

      <Stack gap={8}>
        <H2>누가 어떤 일을 맡나</H2>
        <Text tone="secondary">이용자 질문으로 보면 두 제품이 갈린다.</Text>
        <Table
          headers={['이용자 질문', '마이리얼트립', '여로담']}
          columnAlign={['left', 'left', 'left']}
          rows={[
            ['상하이 디즈니 티켓 얼마야?', '상품·가격·즉시확정', '다루지 않음'],
            ['인천에서 숙소까지 어떻게 가지?', '상품/가이드 위주', '공항→숙소 안내·문구 카드'],
            ['내일 10곳에 몇 시에 가지?', '일정 설계 도구 아님', '체류·이동 반영 시간표'],
            ['이 코스를 친구에게 넘기려면?', '예약 바우처·공유는 상품 단위', '읽기 전용 링크·공유마당'],
            ['한글로 기사에게 뭐라고 하지?', '상품 상세/후기', '택시 카드·한국어 문구 복사'],
          ]}
        />
      </Stack>

      <Divider />

      <Grid columns={2} gap={16}>
        <Card>
          <CardHeader trailing={<Pill size="sm">OTA · 마켓플레이스</Pill>}>
            마이리얼트립
          </CardHeader>
          <CardBody>
            <Stack gap={8}>
              <Text>
                2012년 현지 가이드 중개로 시작해 항공·숙소·투어·티켓·패키지를 한 앱에
                모은 여행 슈퍼앱. 통신판매중개자라 상품의 당사자는 판매자다.
              </Text>
              <Text tone="secondary">
                홈은 목적지·할인·최저가 보장·광고 상품 그리드다. ‘진짜 나다운 여행’은
                취향 큐레이션이지, 시간표 플래너가 아니다.
              </Text>
              <H3>강점</H3>
              <Text>재고·결제·취소/환불·24시간 상담. 규모와 브랜드.</Text>
              <H3>약점 (여로담 관점)</H3>
              <Text>
                산 상품을 ‘몇 시·몇 분 동선’으로 엮는 도구가 약하다. 인바운드 UI는
                아직 한국어 중심이다.
              </Text>
            </Stack>
          </CardBody>
        </Card>
        <Card>
          <CardHeader trailing={<Pill size="sm" tone="info">플래너 · 도구</Pill>}>
            여로담
          </CardHeader>
          <CardBody>
            <Stack gap={8}>
              <Text>
                장소를 검색·핀업하면 카테고리로 묶이고, 드래그로 순서를 바꾼 뒤 실도로
                이동 시간이 붙은 다일차 일정이 된다. 설치 없이 웹, 로그인 없이 로컬
                저장.
              </Text>
              <Text tone="secondary">
                한국은 카카오, 해외·인바운드는 Google. UI는 ko·en·ja·zh. 한국여행정보는
                TourAPI(사진·둘레길·펫·무장애)를 열람한다.
              </Text>
              <H3>강점</H3>
              <Text>시간표 동선, 발표 모드, 공유마당, 현장용 문구/택시 카드.</Text>
              <H3>약점</H3>
              <Text>
                항공·숙소·티켓을 사지 못한다. 트래픽·신뢰·고객지원은 슈퍼앱과 비교
                불가. Plus(클라우드·내보내기)는 예약 GMV가 아니다.
              </Text>
            </Stack>
          </CardBody>
        </Card>
      </Grid>

      <Stack gap={8}>
        <H2>제품이 쓰는 힘 (정성)</H2>
        <Text tone="secondary">
          매출이 아니라 화면·조직이 어디에 붙어 있는지. 수치는 추정이 아니라 비중
          스케치다.
        </Text>
        <UsageBar
          total={100}
          topLeftLabel="마이리얼트립 초점"
          topRightLabel="예약 75 · 탐색 20 · 일정 5"
          segments={[
            { id: 'mrt-book', value: 45, color: 'blue' },
            { id: 'mrt-tour', value: 30, color: 'purple' },
            { id: 'mrt-promo', value: 20, color: 'orange' },
            { id: 'mrt-plan', value: 5, color: 'gray' },
          ]}
        />
        <Text tone="tertiary">항공·숙소 / 투어·티켓 / 프로모·검색 / 일정 설계</Text>
        <UsageBar
          total={100}
          topLeftLabel="여로담 초점"
          topRightLabel="설계 65 · 공유·정보 30 · 예약 5"
          segments={[
            { id: 'wm-search', value: 30, color: 'cyan' },
            { id: 'wm-route', value: 35, color: 'blue' },
            { id: 'wm-share', value: 15, color: 'purple' },
            { id: 'wm-info', value: 15, color: 'orange' },
            { id: 'wm-book', value: 5, color: 'gray' },
          ]}
        />
        <Text tone="tertiary">여로담 — 설계가 제품의 중심 (예약 슬롯은 비어 있음)</Text>
      </Stack>

      <Stack gap={8}>
        <H2>기능 겹침</H2>
        <Table
          headers={['기능', '마이리얼트립', '여로담', '판단']}
          columnAlign={['left', 'left', 'left', 'left']}
          rows={[
            ['항공·숙소·티켓 결제', '핵심', '없음', '따라가지 말 것'],
            ['현지 가이드/투어 상품', '핵심 (출발점)', '없음', '상품화하면 OTA가 됨'],
            ['목적지 탐색·큐레이션', '강함 (광고·특가)', '약함 (검색·시나리오)', '테마 시나리오로만 보완'],
            ['지도에서 장소 고르기', '상품 위치 위주', '카카오+Google 핀업', '여로담 고유'],
            ['다일차 시간표 동선', '약함', '핵심', '반드시 유지'],
            ['코스 공유·복제', '후기·상품 단위', '링크·공유마당', '템플릿으로 차별'],
            ['인바운드 언어', '한/영 사이트', 'ko/en/ja/zh + 문구카드', '방한 여행자 공백'],
            ['한국 공공 관광정보', '상품에 녹음', 'TourAPI 열람 탭', '예약과 분리된 정보층'],
            ['현장 한국어 소통', '상담 센터', '택시/문구 카드', '여로담이 더 가깝다'],
            ['AI 추천', '검색·묶음 상품 방향', 'TourAPI 후보 위 시나리오', '환각 없이 유지'],
          ]}
        />
      </Stack>

      <Divider />

      <Stack gap={8}>
        <H2>여행 타임라인에서 자리</H2>
        <Grid columns={3} gap={12}>
          <Card>
            <CardHeader>떠나기 전</CardHeader>
            <CardBody>
              <Stack gap={6}>
                <Text weight="semibold">MRT — 사기</Text>
                <Text tone="secondary">항공·숙소·티켓을 장바구니에 담는다.</Text>
                <Text weight="semibold">여로담 — 짜기</Text>
                <Text tone="secondary">산 뒤(또는 사기 전) 장소를 하루 단위로 엮는다.</Text>
              </Stack>
            </CardBody>
          </Card>
          <Card>
            <CardHeader>당일</CardHeader>
            <CardBody>
              <Stack gap={6}>
                <Text weight="semibold">MRT — 바우처</Text>
                <Text tone="secondary">입장·픽업 확인. 다음 장소까지의 분은 이용자 몫.</Text>
                <Text weight="semibold">여로담 — 실행</Text>
                <Text tone="secondary">몇 시 도착, 이동 분, 기사에게 보여줄 한글.</Text>
              </Stack>
            </CardBody>
          </Card>
          <Card>
            <CardHeader>다녀온 뒤</CardHeader>
            <CardBody>
              <Stack gap={6}>
                <Text weight="semibold">MRT — 후기·재구매</Text>
                <Text tone="secondary">상품 리뷰, 다음 특가.</Text>
                <Text weight="semibold">여로담 — 코스 자산</Text>
                <Text tone="secondary">공유마당에 올려 다른 사람이 가져간다.</Text>
              </Stack>
            </CardBody>
          </Card>
        </Grid>
      </Stack>

      <Stack gap={8}>
        <H2>따라가면 안 되는 것 / 가져올 힌트</H2>
        <Grid columns={2} gap={16}>
          <Card>
            <CardHeader>복사하지 말 것</CardHeader>
            <CardBody>
              <Stack gap={6}>
                <Text>항공·숙소 GDS, 최저가 보장, 광고 상품 피드.</Text>
                <Text>가이드 입점·정산. 여로담이 통신판매중개가 된다.</Text>
                <Text>홈을 특가 그리드로 바꾸기. 랜딩 문장(담으면 길이 된다)과 충돌.</Text>
              </Stack>
            </CardBody>
          </Card>
          <Card>
            <CardHeader>참고할 만한 것</CardHeader>
            <CardBody>
              <Stack gap={6}>
                <Text>목적지 하나로 관련 행동을 묶는 검색(도시 선택 → 다음 액션).</Text>
                <Text>구매 후 ‘오늘 동선에 넣기’ 같은 한 칸 연결(딥링크·메모).</Text>
                <Text>인바운드: MRT도 방한을 키운다. 여로담은 이미 다국어·현장 문구가 있다.</Text>
              </Stack>
            </CardBody>
          </Card>
        </Grid>
      </Stack>

      <Callout tone="success" title="여로담이 지켜야 할 공백">
        ‘산 티켓 사이’를 시간으로 메우는 도구. 마이리얼트립이 상품을 더 팔수록, 이용자는
        더 복잡한 하루를 갖게 된다. 그 하루를 짜 주는 쪽이 여로담이다.
      </Callout>

      <Stack gap={6}>
        <H3>출처</H3>
        <Text tone="tertiary">
          마이리얼트립 홈·소개:{' '}
          <Link href="https://www.myrealtrip.com/">myrealtrip.com</Link>
          {' · '}
          2025 여행 건수·가입자:{' '}
          <Link href="https://www.venturesquare.net/1033050/">벤처스퀘어</Link>
          {' · '}
          슈퍼앱 연혁:{' '}
          <Link href="https://www.travelbiztalk.com/myrealtrip-2025-insight/">TravelBizTalk</Link>
          {' · '}
          규모 요약:{' '}
          <Link href="https://namu.wiki/w/%EB%A7%88%EC%9D%B4%EB%A6%AC%EC%96%BC%ED%8A%B8%EB%A6%BD">나무위키</Link>
          {' · '}
          여로담은 랜딩·플래너·빌링 카피 및 현재 구현.
        </Text>
      </Stack>
    </Stack>
  );
}
