import {
  COURSE_TAXONOMY_GROUPS,
  COURSE_TAXONOMY_GROUP_META,
  splitTopicTags,
  mergeTopicTags,
  tagsForGroup,
  toggleId,
  type CourseTaxonomyGroupId,
} from '../lib/courseGuideTaxonomy';

export function CourseTaxonomyPicker({
  tags,
  onChange,
}: {
  tags: string[];
  onChange: (next: string[]) => void;
}) {
  const { selected, extra } = splitTopicTags(tags);
  return (
    <CourseTaxonomyChips
      mode="picker"
      selected={selected}
      extra={extra}
      onChange={(next) => onChange(mergeTopicTags(next, extra))}
      onExtraChange={(nextExtra) => onChange(mergeTopicTags(selected, nextExtra))}
    />
  );
}

type Props = {
  selected: string[];
  onChange: (next: string[]) => void;
  /** filter: 데이터에 있는 태그만. picker: 전체 */
  mode: 'filter' | 'picker';
  availableIds?: string[];
  locale?: string;
  extra?: string[];
  onExtraChange?: (next: string[]) => void;
};

export function CourseTaxonomyChips({
  selected,
  onChange,
  mode,
  availableIds,
  locale = 'ko',
  extra,
  onExtraChange,
}: Props) {
  const en = !locale.toLowerCase().startsWith('ko');
  const groups: CourseTaxonomyGroupId[] =
    mode === 'filter'
      ? ['region', 'when', 'who', 'theme', 'style', 'budget', 'access']
      : [...COURSE_TAXONOMY_GROUPS];

  const rows = groups
    .map((group) => {
      const tags = tagsForGroup(group).filter(
        (tag) =>
          mode === 'picker' ||
          selected.includes(tag.id) ||
          !availableIds ||
          availableIds.includes(tag.id)
      );
      return { group, tags, meta: COURSE_TAXONOMY_GROUP_META[group] };
    })
    .filter((row) => row.tags.length > 0);

  if (rows.length === 0 && mode === 'filter') return null;

  return (
    <div className={`course-tax ${mode === 'picker' ? 'is-picker' : ''}`}>
      {mode === 'filter' && selected.length > 0 && (
        <div className="course-tax-toolbar">
          <button type="button" className="course-tax-clear" onClick={() => onChange([])}>
            {en ? 'Clear filters' : '필터 초기화'}
          </button>
        </div>
      )}
      {rows.map(({ group, tags, meta }) => (
        <div key={group} className="course-tax-row">
          <span className="course-tax-label">{en ? meta.labelEn : meta.labelKo}</span>
          <div className="course-tax-chips" role="group" aria-label={en ? meta.labelEn : meta.labelKo}>
            {tags.map((tag) => {
              const on = selected.includes(tag.id);
              return (
                <button
                  key={tag.id}
                  type="button"
                  className={`course-tax-chip${on ? ' is-on' : ''}`}
                  aria-pressed={on}
                  onClick={() => onChange(toggleId(selected, tag.id))}
                >
                  {en ? tag.labelEn : tag.labelKo}
                </button>
              );
            })}
          </div>
        </div>
      ))}
      {mode === 'picker' && onExtraChange && (
        <label className="admin-guide-field">
          기타 태그 (쉼표)
          <input
            value={(extra ?? []).join(', ')}
            onChange={(e) =>
              onExtraChange(
                e.currentTarget.value
                  .split(',')
                  .map((s) => s.trim())
                  .filter(Boolean)
              )
            }
          />
        </label>
      )}
    </div>
  );
}
