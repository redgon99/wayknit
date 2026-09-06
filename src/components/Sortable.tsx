import { ReactNode } from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  horizontalListSortingStrategy,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface SortableItemProps {
  id: string;
  children: (args: { listeners: any; setActivatorNodeRef: (el: HTMLElement | null) => void; isDragging: boolean }) => ReactNode;
}

/** 드래그 핸들을 자식 컴포넌트가 직접 결정할 수 있는 Sortable Wrapper */
export function SortableItem({ id, children }: SortableItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 10 : undefined,
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes}>
      {children({ listeners, setActivatorNodeRef, isDragging })}
    </div>
  );
}

interface SortableContainerProps {
  ids: string[];
  onReorder?: (orderedIds: string[]) => void;
  direction?: 'horizontal' | 'vertical';
  children: ReactNode;
}

export function SortableContainer({
  ids,
  onReorder,
  direction = 'vertical',
  children,
}: SortableContainerProps) {
  // onReorder 유무로 갈리는 조기 return보다 먼저 훅을 호출해야 한다 — 같은
  // 컴포넌트 인스턴스에서 onReorder가 런타임에 생겼다 사라졌다 하면(예: 모드
  // 토글로 재정렬 가능 여부가 바뀌는 경우) 훅 호출 순서가 렌더마다 달라져
  // React가 깨진다.
  const sensors = useSensors(
    useSensor(PointerSensor, {
      // 5px 이상 움직여야 드래그 시작 → 클릭과 구분
      activationConstraint: { distance: 5 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  if (!onReorder) {
    return <>{children}</>;
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIdx = ids.indexOf(String(active.id));
    const newIdx = ids.indexOf(String(over.id));
    if (oldIdx === -1 || newIdx === -1) return;
    onReorder?.(arrayMove(ids, oldIdx, newIdx));
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext
        items={ids}
        strategy={direction === 'horizontal' ? horizontalListSortingStrategy : verticalListSortingStrategy}
      >
        {children}
      </SortableContext>
    </DndContext>
  );
}
