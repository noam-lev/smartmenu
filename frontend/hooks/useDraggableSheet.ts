import { useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";

type UseDraggableSheetOptions = {
  onDismiss: () => void;
  dismissThreshold?: number;
};

type DragStateRef = {
  pointerId: number;
  startClientY: number;
  startOffsetY: number;
};

export function useDraggableSheet({
  onDismiss,
  dismissThreshold = 120,
}: UseDraggableSheetOptions) {
  const [sheetOffsetY, setSheetOffsetY] = useState(0);
  const [sheetDragging, setSheetDragging] = useState(false);
  const sheetDragRef = useRef<DragStateRef | null>(null);

  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    sheetDragRef.current = {
      pointerId: event.pointerId,
      startClientY: event.clientY,
      startOffsetY: sheetOffsetY,
    };
    setSheetDragging(true);
  };

  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = sheetDragRef.current;
    if (!drag || event.pointerId !== drag.pointerId) {
      return;
    }

    const delta = event.clientY - drag.startClientY;
    setSheetOffsetY(Math.max(0, drag.startOffsetY + delta));
  };

  const onPointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = sheetDragRef.current;
    if (!drag || event.pointerId !== drag.pointerId) {
      return;
    }

    event.currentTarget.releasePointerCapture(event.pointerId);
    const delta = event.clientY - drag.startClientY;
    const endOffset = Math.max(0, drag.startOffsetY + delta);
    sheetDragRef.current = null;
    setSheetDragging(false);

    if (endOffset >= dismissThreshold) {
      onDismiss();
      return;
    }

    setSheetOffsetY(0);
  };

  return {
    sheetOffsetY,
    sheetDragging,
    dragHandlers: {
      onPointerDown,
      onPointerMove,
      onPointerUp,
      onPointerCancel: onPointerUp,
    },
  };
}
