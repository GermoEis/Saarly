import type { ImageProps } from 'expo-image';
import { useRef, useState } from 'react';
import type { CSSProperties, PointerEvent as ReactPointerEvent, WheelEvent } from 'react';
import { Image as NativeImage } from 'react-native';
import { createPortal } from 'react-dom';

type Zoom = { scale: number; x: number; y: number };

const MIN_SCALE = 1;
const MAX_SCALE = 4;
const INITIAL_ZOOM: Zoom = { scale: MIN_SCALE, x: 0, y: 0 };

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value));
}

function sourceUri(source: ImageProps['source']) {
  if (typeof source === 'string') return source;
  if (typeof source === 'number') return NativeImage.resolveAssetSource(source)?.uri ?? '';
  if (Array.isArray(source)) return sourceUri(source[0]);
  if (source && typeof source === 'object' && 'uri' in source) return source.uri ?? '';
  return '';
}

function pointerDistance(points: { x: number; y: number }[]) {
  if (points.length < 2) return 0;
  return Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y);
}

export function ImageViewer({ visible, source, title, onClose }: {
  visible: boolean;
  source: ImageProps['source'];
  title: string;
  onClose: () => void;
}) {
  const [zoom, setZoomState] = useState<Zoom>(INITIAL_ZOOM);
  const zoomRef = useRef<Zoom>(INITIAL_ZOOM);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const dragStart = useRef<{ pointerX: number; pointerY: number; imageX: number; imageY: number } | null>(null);
  const pinchStart = useRef<{ distance: number; scale: number } | null>(null);

  const setZoom = (next: Zoom) => {
    const scale = clamp(next.scale, MIN_SCALE, MAX_SCALE);
    const maxX = Math.max(0, (window.innerWidth * scale - window.innerWidth) / 2);
    const maxY = Math.max(0, (window.innerHeight * scale - window.innerHeight) / 2);
    const normalized = scale === MIN_SCALE
      ? INITIAL_ZOOM
      : { scale, x: clamp(next.x, -maxX, maxX), y: clamp(next.y, -maxY, maxY) };
    zoomRef.current = normalized;
    setZoomState(normalized);
  };
  const close = () => {
    setZoom(INITIAL_ZOOM);
    pointers.current.clear();
    onClose();
  };
  const updatePointer = (event: ReactPointerEvent<HTMLDivElement>) => {
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
  };
  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    updatePointer(event);
    const points = [...pointers.current.values()];
    if (points.length >= 2) {
      pinchStart.current = { distance: pointerDistance(points), scale: zoomRef.current.scale };
      dragStart.current = null;
    } else {
      dragStart.current = { pointerX: event.clientX, pointerY: event.clientY, imageX: zoomRef.current.x, imageY: zoomRef.current.y };
    }
  };
  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!pointers.current.has(event.pointerId)) return;
    updatePointer(event);
    const points = [...pointers.current.values()];
    if (points.length >= 2 && pinchStart.current) {
      const nextScale = pinchStart.current.scale * pointerDistance(points) / Math.max(1, pinchStart.current.distance);
      setZoom({ ...zoomRef.current, scale: nextScale });
    } else if (dragStart.current && zoomRef.current.scale > MIN_SCALE) {
      setZoom({
        ...zoomRef.current,
        x: dragStart.current.imageX + event.clientX - dragStart.current.pointerX,
        y: dragStart.current.imageY + event.clientY - dragStart.current.pointerY,
      });
    }
  };
  const onPointerEnd = (event: ReactPointerEvent<HTMLDivElement>) => {
    pointers.current.delete(event.pointerId);
    if (pointers.current.size < 2) pinchStart.current = null;
    if (!pointers.current.size) dragStart.current = null;
  };
  const onWheel = (event: WheelEvent<HTMLDivElement>) => {
    event.preventDefault();
    setZoom({ ...zoomRef.current, scale: zoomRef.current.scale + (event.deltaY < 0 ? .35 : -.35) });
  };

  if (!visible || typeof document === 'undefined') return null;
  return createPortal(<div role="dialog" aria-modal="true" aria-label={title} style={styles.backdrop}>
    <button type="button" aria-label="Sulge pilt" onClick={close} style={styles.closeButton}>×</button>
    <div
      role="img"
      aria-label={title}
      onDoubleClick={() => setZoom(zoomRef.current.scale > MIN_SCALE ? INITIAL_ZOOM : { scale: 2, x: 0, y: 0 })}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerEnd}
      onPointerCancel={onPointerEnd}
      onWheel={onWheel}
      style={styles.stage}>
      <img
        src={sourceUri(source)}
        alt={title}
        draggable={false}
        style={{ ...styles.image, transform: `translate(${zoom.x}px, ${zoom.y}px) scale(${zoom.scale})` }} />
    </div>
    <div style={styles.controls}>
      <button type="button" aria-label="Vähenda pilti" disabled={zoom.scale <= MIN_SCALE} onClick={() => setZoom({ ...zoomRef.current, scale: zoomRef.current.scale - .75 })} style={styles.zoomButton}>−</button>
      <span aria-live="polite" style={styles.zoomValue}>{Math.round(zoom.scale * 100)}%</span>
      <button type="button" aria-label="Suurenda pilti" disabled={zoom.scale >= MAX_SCALE} onClick={() => setZoom({ ...zoomRef.current, scale: zoomRef.current.scale + .75 })} style={styles.zoomButton}>+</button>
    </div>
    <div style={styles.help}>Topeltklõpsa, näpista, keri või kasuta suurendamiseks nuppe</div>
  </div>, document.body);
}

const styles: Record<string, CSSProperties> = {
  backdrop: { position: 'fixed', inset: 0, zIndex: 2147483647, overflow: 'hidden', background: 'rgba(0, 0, 0, .96)', color: '#FFFFFF', fontFamily: 'system-ui, sans-serif' },
  stage: { position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', touchAction: 'none', cursor: 'grab' },
  image: { width: '100%', height: '100%', objectFit: 'contain', transformOrigin: 'center', userSelect: 'none', pointerEvents: 'none' },
  closeButton: { position: 'absolute', zIndex: 2, top: 18, right: 18, width: 48, height: 48, padding: 0, borderRadius: 24, border: '1px solid rgba(255, 255, 255, .3)', background: 'rgba(36, 36, 36, .92)', color: '#FFFFFF', fontSize: 31, lineHeight: '44px', cursor: 'pointer' },
  controls: { position: 'absolute', zIndex: 2, left: '50%', bottom: 50, display: 'flex', alignItems: 'center', gap: 12, padding: 8, borderRadius: 25, border: '1px solid rgba(255, 255, 255, .24)', background: 'rgba(36, 36, 36, .92)', transform: 'translateX(-50%)' },
  zoomButton: { width: 42, height: 42, padding: 0, border: 0, borderRadius: 21, background: 'rgba(255, 255, 255, .14)', color: '#FFFFFF', fontSize: 26, fontWeight: 600, cursor: 'pointer' },
  zoomValue: { minWidth: 52, color: '#FFFFFF', fontSize: 14, fontWeight: 700, textAlign: 'center' },
  help: { position: 'absolute', zIndex: 2, left: '50%', bottom: 18, color: 'rgba(255, 255, 255, .72)', fontSize: 13, textAlign: 'center', transform: 'translateX(-50%)', whiteSpace: 'nowrap' },
};
