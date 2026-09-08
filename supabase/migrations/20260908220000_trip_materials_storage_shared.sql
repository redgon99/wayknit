-- 협업자가 상대의 사진·파일을 볼 수 있게 한다 (HANDOFF §21).
--
-- 증상: 공동편집에서 그림 파일을 올리면 **올린 사람만** 보인다. 나머지 사람에게는
-- "자료가 하나 있다"는 항목은 보이는데 열지도 받지도 못한다.
--
-- 원인: 자료 **메타데이터**는 `trip_materials` 행으로 동기화되지만(§19),
-- 실제 파일은 Storage 에 있고 그 정책이 업로더 본인만 허용하고 있었다.
--
--   trip_materials_select_own:
--     bucket_id = 'trip-materials'
--     AND (storage.foldername(name))[1] = auth.uid()::text
--
-- 경로가 `${userId}/${tripId}/${materialId}/${fileName}` 이라 **첫 칸이 올린 사람**이다.
-- 그래서 협업자는 `createSignedUrl` 자체가 실패한다. 앱은 실패를 조용히 삼키므로
-- (`if (url) next[id] = url`) 깨진 이미지도 안 뜨고 그냥 안 보인다.
--
-- 같은 이유로 **삭제도 반쪽이었다.** 협업자가 남의 자료를 지우면 `trip_materials`
-- 행은 지워지는데(테이블 정책은 편집자를 허용한다) Storage 삭제는 막혀
-- 파일이 저장소에 고아로 남았다.
--
-- ── 고치는 방법 ─────────────────────────────────────────────────────
--
-- 경로 **두 번째 칸이 이미 tripId** 다. 그래서 파일을 옮기지 않고 정책만 넓히면 된다.
-- 경로를 여행 기준(`${tripId}/...`)으로 바꾸는 게 더 깔끔하지만, 그러려면 기존
-- 객체를 전부 옮겨야 하고 이득은 같다.
--
-- 읽기는 협업자(뷰어 포함), 쓰기(삭제)는 편집자까지 — `trip_materials` 테이블
-- 정책과 같은 선이다.

/**
 * 이 Storage 객체 경로를 지금 사용자가 다룰 수 있는가.
 *
 * 경로를 파싱하다 실패하면 정책 전체가 에러로 죽으므로(질의가 통째로 실패한다)
 * uuid 캐스팅을 반드시 감싸야 한다. 정책 안에 `::uuid` 를 직접 쓰면 규칙에 맞지
 * 않는 파일 하나가 버킷 전체 조회를 깨뜨린다.
 */
create or replace function public.trip_material_path_allows(
  p_name       text,
  p_need_write boolean default false
)
returns boolean
language plpgsql
stable
security definer
set search_path = public, storage
as $$
declare
  parts  text[];
  v_trip uuid;
begin
  parts := storage.foldername(p_name);
  if parts is null or array_length(parts, 1) < 2 then
    return false;
  end if;

  -- 내가 올린 파일은 언제나 내 것이다(여행에서 빠진 뒤에도 정리할 수 있어야 한다).
  if parts[1] = (auth.uid())::text then
    return true;
  end if;

  begin
    v_trip := parts[2]::uuid;
  exception when others then
    return false;
  end;

  if p_need_write then
    return public.is_trip_owner(v_trip) or public.is_trip_editor(v_trip);
  end if;
  return public.is_trip_owner(v_trip) or public.is_trip_collaborator(v_trip);
end;
$$;

revoke all on function public.trip_material_path_allows(text, boolean) from public;
grant execute on function public.trip_material_path_allows(text, boolean) to authenticated;

-- 읽기 — 소유자·협업자(뷰어 포함)
drop policy if exists "trip_materials_select_own" on storage.objects;
drop policy if exists "trip_materials_select_shared" on storage.objects;
create policy "trip_materials_select_shared" on storage.objects
  for select
  using (
    bucket_id = 'trip-materials'
    and public.trip_material_path_allows(name, false)
  );

-- 삭제 — 소유자·편집자. 뷰어는 지울 수 없다(trip_materials 테이블 정책과 같은 선).
drop policy if exists "trip_materials_delete_own" on storage.objects;
drop policy if exists "trip_materials_delete_shared" on storage.objects;
create policy "trip_materials_delete_shared" on storage.objects
  for delete
  using (
    bucket_id = 'trip-materials'
    and public.trip_material_path_allows(name, true)
  );

-- 업로드(INSERT)는 그대로 둔다 — 누구든 **자기 폴더에만** 올린다.
-- 넓히면 남의 폴더에 파일을 심을 수 있게 되는데 그럴 이유가 없다.
--
-- 비로그인 열람자는 여전히 볼 수 없다. 공개 여행 공유 페이지(ShareTripPage)는
-- 자료를 보여주지 않으므로 지금은 드러나지 않는다. 공개 여행에서도 사진을
-- 보여주려면 그건 별도 판단이다(사진을 공개한다는 뜻이다).
