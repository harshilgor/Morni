"use client";

import {
  type HTMLAttributes,
  type PointerEvent,
  type ReactNode,
  type RefObject,
  useCallback,
  useRef,
  useState,
} from "react";

export function MouseDragScroll({
  children,
  className = "",
  scrollRef,
  onClickCapture,
  ...props
}: HTMLAttributes<HTMLDivElement> & {
  children: ReactNode;
  scrollRef?: RefObject<HTMLDivElement | null>;
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const pointerIdRef = useRef<number | null>(null);
  const startXRef = useRef(0);
  const startScrollLeftRef = useRef(0);
  const draggedRef = useRef(false);
  const [dragging, setDragging] = useState(false);

  const stopDragging = useCallback((event: PointerEvent<HTMLDivElement>) => {
    if (pointerIdRef.current !== event.pointerId) return;
    if (trackRef.current?.hasPointerCapture(event.pointerId)) {
      trackRef.current.releasePointerCapture(event.pointerId);
    }
    pointerIdRef.current = null;
    setDragging(false);
  }, []);

  return (
    <div
      {...props}
      ref={(node) => {
        trackRef.current = node;
        if (scrollRef) scrollRef.current = node;
      }}
      onPointerDown={(event) => {
        props.onPointerDown?.(event);
        if (event.pointerType !== "mouse" || event.button !== 0) return;
        pointerIdRef.current = event.pointerId;
        startXRef.current = event.clientX;
        startScrollLeftRef.current = event.currentTarget.scrollLeft;
        draggedRef.current = false;
        event.currentTarget.setPointerCapture(event.pointerId);
      }}
      onPointerMove={(event) => {
        props.onPointerMove?.(event);
        if (pointerIdRef.current !== event.pointerId) return;
        const distance = event.clientX - startXRef.current;
        if (Math.abs(distance) > 5) {
          draggedRef.current = true;
          setDragging(true);
        }
        if (!draggedRef.current) return;
        event.preventDefault();
        event.currentTarget.scrollLeft = startScrollLeftRef.current - distance;
      }}
      onPointerUp={(event) => {
        props.onPointerUp?.(event);
        stopDragging(event);
      }}
      onPointerCancel={(event) => {
        props.onPointerCancel?.(event);
        stopDragging(event);
      }}
      onClickCapture={(event) => {
        if (draggedRef.current) {
          event.preventDefault();
          event.stopPropagation();
          draggedRef.current = false;
        }
        onClickCapture?.(event);
      }}
      className={`${className} cursor-grab ${dragging ? "cursor-grabbing select-none" : ""}`}
    >
      {children}
    </div>
  );
}
