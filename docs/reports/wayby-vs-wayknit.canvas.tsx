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

export default function WaybyVsWayknit() {
  return (
    <Stack gap={22}>
      <Stack gap={6}>
        <H1>여로담 vs Wayby</H1>
        <Text tone="secondary">
          Wayby 랜딩(
          <Link href="https://wayby.me/#how-it-works">wayby.me</Link>
          ) 공개 카피와 여로담 현재 구현 기준. 마이리얼트립과 달리 같은 일 — 장소를
          모아 동선을 만드는 일 — 을 한다.
        </Text>
        <Row gap={8} wrap>
          <Pill active>직접 경쟁: 동선 플래너</Pill>
          <Pill>Wayby = 하루·함께·최적화</Pill>
          <Pill>여로담 = 다일차·시간표·현장</Pill>
        </Row>
      </Stack>

      <Callout tone="warning" title="한 줄">
        Wayby는 ‘오늘 갈 곳의 순서를 같이, 한 번에’ 맞춘다. 여로담은 ‘며칠을 몇
        시에’ 짠다. 검색·지도·최적화는 겹치고, 일정 단위와 공유 방식이 갈린다.
      </Callout>

      <Grid columns={4} gap={12}>
        <Stat value="하루" label="Wayby가 말하는 단위" />
        <Stat value="다일차" label="여로담이 말하는 단위" />
        <Stat value="같이 편집" label="Wayby 공유의 핵" />
        <Stat value="가져오기" label="여로담 마당의 핵" />
      </Grid>

      <Stack gap={8}>
        <H2>같은 질문, 다른 답</H2>
        <Table
          headers={['이용자 질문', 'Wayby', '여로담']}
          columnAlign={['left', 'left', 'left']}
          rows={[
            ['오늘 데이트 5곳, 순서는?', '원터치 최적화 + 순서 고정', '드래그 + 일정 만들기(시간표)'],
            ['친구랑 같이 짜고 싶어', '링크 초대, 실시간 공동 편집', '읽기 링크·마당에서 가져오기'],
            ['3박 4일은?', '하루 단위 제품 카피', '1·2·3일차 탭'],
            ['몇 시에 점심 먹지?', '순서·이동 최적화 중심', '체류·점심 시간대 보정'],
            ['기사에게 한글로?', '랜딩에 없음', '택시 카드·문구 복사'],
            ['앱을 깔아야 해?', 'App Store / Play 유도', '웹 즉시, 로그인 없이 로컬'],
          ]}
        />
      </Stack>

      <Divider />

      <Grid columns={2} gap={16}>
        <Card>
          <CardHeader trailing={<Pill size="sm">공유 일정 플래너</Pill>}>Wayby</CardHeader>
          <CardBody>
            <Stack gap={8}>
              <Text>
                하루 장소를 한 화면에 담고, 링크 하나로 같이 편집한다. 데이트·약속·당일
                여행. 검색은 Google Places, Naver, Kakao.
              </Text>
              <Text tone="secondary">
                랜딩이 반복하는 약속: 순서 고정, 원터치 최적화, 왕복(순환) 경로, 클라우드
                동기화. 불필요한 기능은 덜고 모으기·최적화·공유만 남긴다.
              </Text>
              <H3>강점</H3>
              <Text>공동 편집, 한 버튼 최적화, 앱, 인지 부하가 낮음.</Text>
              <H3>약점 (여로담 관점)</H3>
              <Text>
                다일차·몇 시 시간표·현장 한국어·공공 관광정보·발표 모드가 제품 이야기에
                없다. 웹 없이 앱 설치가 기본 흐름이다.
              </Text>
            </Stack>
          </CardBody>
        </Card>
        <Card>
          <CardHeader trailing={<Pill size="sm" tone="info">여행 동선 도구</Pill>}>
            여로담
          </CardHeader>
          <CardBody>
            <Stack gap={8}>
              <Text>
                핀을 카테고리로 묶고 드래그한 뒤, 실도로 이동과 체류가 붙은 시간표가
                나온다. 한국은 카카오, 해외는 Google. ko/en/ja/zh.
              </Text>
              <Text tone="secondary">
                공유는 실시간 동시 편집보다 읽기 링크와 공유마당(코스를 내 일정으로
                가져오기). 설치 없이 웹, 로그인 없이 로컬.
              </Text>
              <H3>강점</H3>
              <Text>다일차, 시간표, 마당, 현장 문구, TourAPI 정보, 발표 모드.</Text>
              <H3>약점</H3>
              <Text>
                같이 짜기의 마찰이 크다. ‘최적화’ 한 방이 Wayby만큼 전면에 없다.
                네이버 검색은 없고, 네이티브 앱도 없다.
              </Text>
            </Stack>
          </CardBody>
        </Card>
      </Grid>

      <Stack gap={8}>
        <H2>제품이 쓰는 힘 (정성)</H2>
        <Text tone="secondary">
          랜딩이 강조하는 화면. 매출이 아니라 카피 비중 스케치다.
        </Text>
        <UsageBar
          total={100}
          topLeftLabel="Wayby 초점"
          topRightLabel="모으기 25 · 최적화 40 · 같이 25 · 기타 10"
          segments={[
            { id: 'wb-add', value: 25, color: 'cyan' },
            { id: 'wb-opt', value: 40, color: 'blue' },
            { id: 'wb-collab', value: 25, color: 'purple' },
            { id: 'wb-rest', value: 10, color: 'gray' },
          ]}
        />
        <Text tone="tertiary">검색 추가 / 순서 최적화 / 공동 편집 / 나머지</Text>
        <UsageBar
          total={100}
          topLeftLabel="여로담 초점"
          topRightLabel="핀 30 · 시간표 35 · 공유 15 · 현장·정보 20"
          segments={[
            { id: 'wm-pin', value: 30, color: 'cyan' },
            { id: 'wm-time', value: 35, color: 'blue' },
            { id: 'wm-share', value: 15, color: 'purple' },
            { id: 'wm-field', value: 20, color: 'orange' },
          ]}
        />
        <Text tone="tertiary">검색·핀업 / 동선·시간표 / 마당·링크 / 도움말·한국정보</Text>
      </Stack>

      <Stack gap={8}>
        <H2>기능 겹침</H2>
        <Table
          headers={['기능', 'Wayby (랜딩)', '여로담 (구현)', '판단']}
          columnAlign={['left', 'left', 'left', 'left']}
          rows={[
            ['장소 검색', 'Google · Naver · Kakao', 'Kakao · Google', '네이버는 Wayby만'],
            ['지도에 모으기', '한눈 지도', '핀업 바 + 지도', '둘 다 핵심'],
            ['순서 바꾸기', '고정 + 나머지 자동', '드래그, 필수 핀 우선', 'Wayby가 더 단순'],
            ['경로 최적화', '원터치·왕복', '최근접 + 실도로·체류', '여로담은 시각까지'],
            ['다일차', '카피에 없음', '일차 탭', '여로담 고유'],
            ['시간표(몇 시)', '강조 없음', '출발·체류·점심', '여로담 모트'],
            ['실시간 공동 편집', '핵심 약속', '없음', '따라갈지 결정 필요'],
            ['코스 마켓', '없음', '공유마당', '여로담 고유'],
            ['현장 한국어', '없음', '택시·문구 카드', '방한·택시 장면'],
            ['설치', '앱 필수 흐름', '웹 즉시', '유입 장벽이 반대'],
            ['언어', '랜딩 한국어', 'ko/en/ja/zh', '인바운드는 여로담'],
          ]}
        />
      </Stack>

      <Divider />

      <Stack gap={8}>
        <H2>누가 누구에게 지는가</H2>
        <Grid columns={3} gap={12}>
          <Card>
            <CardHeader>데이트·당일 약속</CardHeader>
            <CardBody>
              <Text>
                Wayby가 더 가깝다. ‘오늘 완벽한 하루’, 같이 담고 한 번 최적화. 여로담은
                무겁게 느껴질 수 있다.
              </Text>
            </CardBody>
          </Card>
          <Card>
            <CardHeader>2박 이상 여행</CardHeader>
            <CardBody>
              <Text>
                여로담. 일차를 나누고 이동 분과 점심을 넣는다. Wayby 랜딩은 이 장면을
                약속하지 않는다.
              </Text>
            </CardBody>
          </Card>
          <Card>
            <CardHeader>방한·현장</CardHeader>
            <CardBody>
              <Text>
                여로담. 다국어 UI, 기사에게 보여줄 한글, TourAPI 정보. Wayby는 국내
                사용자 공동 계획에 맞춰져 있다.
              </Text>
            </CardBody>
          </Card>
        </Grid>
      </Stack>

      <Stack gap={8}>
        <H2>가져올 것 / 가져오지 말 것</H2>
        <Grid columns={2} gap={16}>
          <Card>
            <CardHeader>참고할 만한 것</CardHeader>
            <CardBody>
              <Stack gap={6}>
                <Text>
                  3단계 카피: 담기 → 최적화 → 공유. 여로담은 ‘일정 만들기’가 그 가운데
                  방에 해당한다. 버튼을 더 크게 보여 줄 여지.
                </Text>
                <Text>
                  순서 고정. 여로담의 필수 핀은 ‘먼저 방문’에 가깝다. 시간대가 있는
                  예약(공연·식당)을 자리에 고정하는 UX는 Wayby가 더 분명하다.
                </Text>
                <Text>
                  같이 짜기. 마당은 끝난 코스의 복제다. 짜는 중의 동시 편집은 공백이다.
                </Text>
              </Stack>
            </CardBody>
          </Card>
          <Card>
            <CardHeader>복사하지 말 것</CardHeader>
            <CardBody>
              <Stack gap={6}>
                <Text>
                  시간표를 버리고 순서만 남기기. 그러면 Wayby와 같은 앱이 되고, 여로담
                  랜딩(몇 시에 어디)과 어긋난다.
                </Text>
                <Text>앱 설치를 시작으로 바꾸기. 지금 강점은 웹에서 바로다.</Text>
                <Text>
                  기능을 덜어 ‘하루 앱’으로 좁히기. 데이트 시장은 Wayby가 이미 그
                  문장으로 앉아 있다.
                </Text>
              </Stack>
            </CardBody>
          </Card>
        </Grid>
      </Stack>

      <Callout tone="success" title="여로담이 지켜야 할 자리">
        Wayby가 ‘오늘을 같이 짧게’라면, 여로담은 ‘여행을 시간으로’. 최적화 한 방과
        공동 편집은 배워도 되고, 다일차 시간표와 현장·마당은 양보하면 안 된다.
      </Callout>

      <Stack gap={6}>
        <H3>출처</H3>
        <Text tone="tertiary">
          Wayby 랜딩·사용 방법:{' '}
          <Link href="https://wayby.me/#how-it-works">wayby.me/#how-it-works</Link>
          {' · '}
          여로담은 플래너(최근접 최적화, 필수 핀, 점심 보정, 공유마당)와 랜딩 카피.
        </Text>
      </Stack>
    </Stack>
  );
}
