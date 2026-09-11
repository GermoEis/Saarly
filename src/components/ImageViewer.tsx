import { Image, ImageProps } from 'expo-image';
import { useRef, useState } from 'react';
import {
  Dimensions,
  Modal,
  PanResponder,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

type Zoom = { scale: number; x: number; y: number };

const MIN_SCALE = 1;
const MAX_SCALE = 4;
const SCALE_STEP = 0.75;
const INITIAL_ZOOM: Zoom = { scale: MIN_SCALE, x: 0, y: 0 };

function distance(touches: readonly { pageX: number; pageY: number }[]) {
  if (touches.length < 2) return 0;
  return Math.hypot(touches[0].pageX - touches[1].pageX, touches[0].pageY - touches[1].pageY);
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value));
}

export function ImageViewer({ visible, source, title, onClose }: {
  visible: boolean;
  source: ImageProps['source'];
  title: string;
  onClose: () => void;
}) {
  const [zoom, setZoomState] = useState<Zoom>(INITIAL_ZOOM);
  const zoomRef = useRef<Zoom>(INITIAL_ZOOM);
  const pinchStart = useRef<{ distance: number; scale: number } | null>(null);
  const panStart = useRef({ x: 0, y: 0 });
  const lastTap = useRef(0);

  const setZoom = (next: Zoom) => {
    const { width, height } = Dimensions.get('window');
    const scale = clamp(next.scale, MIN_SCALE, MAX_SCALE);
    const maxX = Math.max(0, (width * scale - width) / 2);
    const maxY = Math.max(0, (height * scale - height) / 2);
    const normalized = scale === MIN_SCALE
      ? INITIAL_ZOOM
      : { scale, x: clamp(next.x, -maxX, maxX), y: clamp(next.y, -maxY, maxY) };
    zoomRef.current = normalized;
    setZoomState(normalized);
  };

  // The ref values below are read by responder callbacks after render, never by the initializer itself.
  // eslint-disable-next-line react-hooks/refs
  const [responder] = useState(() => PanResponder.create({
    onStartShouldSetPanResponder: (event) => event.nativeEvent.touches.length >= 2,
    onMoveShouldSetPanResponder: (event) => event.nativeEvent.touches.length >= 2 || zoomRef.current.scale > MIN_SCALE,
    onPanResponderGrant: (event) => {
      const touches = event.nativeEvent.touches;
      if (touches.length >= 2) pinchStart.current = { distance: distance(touches), scale: zoomRef.current.scale };
      panStart.current = { x: zoomRef.current.x, y: zoomRef.current.y };
    },
    onPanResponderMove: (event, gesture) => {
      const touches = event.nativeEvent.touches;
      if (touches.length >= 2) {
        if (!pinchStart.current) pinchStart.current = { distance: distance(touches), scale: zoomRef.current.scale };
        const start = pinchStart.current;
        if (start.distance > 0) setZoom({ ...zoomRef.current, scale: start.scale * distance(touches) / start.distance });
        return;
      }
      if (zoomRef.current.scale > MIN_SCALE) {
        setZoom({ ...zoomRef.current, x: panStart.current.x + gesture.dx, y: panStart.current.y + gesture.dy });
      }
    },
    onPanResponderRelease: () => { pinchStart.current = null; },
    onPanResponderTerminate: () => { pinchStart.current = null; },
    onPanResponderTerminationRequest: () => false,
  }));

  const changeScale = (amount: number) => setZoom({ ...zoomRef.current, scale: zoomRef.current.scale + amount });
  const handleTap = () => {
    const now = Date.now();
    if (now - lastTap.current < 300) {
      setZoom(zoomRef.current.scale > MIN_SCALE ? INITIAL_ZOOM : { scale: 2, x: 0, y: 0 });
      lastTap.current = 0;
    } else lastTap.current = now;
  };
  const close = () => {
    setZoom(INITIAL_ZOOM);
    onClose();
  };

  return <Modal
    visible={visible}
    transparent
    animationType="fade"
    statusBarTranslucent
    presentationStyle="overFullScreen"
    onShow={() => setZoom(INITIAL_ZOOM)}
    onRequestClose={close}>
    <View style={styles.backdrop} accessibilityViewIsModal>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Sulge pilt"
        onPress={close}
        style={styles.closeButton}>
        <Text style={styles.closeText}>×</Text>
      </Pressable>
      <Pressable
        accessibilityRole="imagebutton"
        accessibilityLabel={`${title}. Ava või lähtesta suurendus topeltpuudutusega.`}
        onPress={handleTap}
        style={styles.stage}>
        <View
          {...responder.panHandlers}
          style={[styles.imageLayer, { transform: [{ translateX: zoom.x }, { translateY: zoom.y }, { scale: zoom.scale }] }]}>
          <Image source={source} contentFit="contain" transition={150} alt={title} style={styles.image} />
        </View>
      </Pressable>
      <View style={styles.controls}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Vähenda pilti"
          disabled={zoom.scale <= MIN_SCALE}
          onPress={() => changeScale(-SCALE_STEP)}
          style={({ pressed }) => [styles.zoomButton, pressed && styles.pressed, zoom.scale <= MIN_SCALE && styles.disabled]}>
          <Text style={styles.zoomButtonText}>−</Text>
        </Pressable>
        <Text accessibilityLiveRegion="polite" style={styles.zoomValue}>{Math.round(zoom.scale * 100)}%</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Suurenda pilti"
          disabled={zoom.scale >= MAX_SCALE}
          onPress={() => changeScale(SCALE_STEP)}
          style={({ pressed }) => [styles.zoomButton, pressed && styles.pressed, zoom.scale >= MAX_SCALE && styles.disabled]}>
          <Text style={styles.zoomButtonText}>+</Text>
        </Pressable>
      </View>
      <Text style={styles.help}>{Platform.OS === 'web' ? 'Topeltklõpsa või kasuta suurendamiseks nuppe' : 'Näpista või topeltpuuduta suurendamiseks'}</Text>
    </View>
  </Modal>;
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0, 0, 0, .96)', overflow: 'hidden' },
  stage: { flex: 1, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  imageLayer: { width: '100%', height: '100%' },
  image: { width: '100%', height: '100%' },
  closeButton: { position: 'absolute', zIndex: 2, top: 18, right: 18, width: 48, height: 48, borderRadius: 24, backgroundColor: 'rgba(36, 36, 36, .92)', borderWidth: 1, borderColor: 'rgba(255, 255, 255, .3)', alignItems: 'center', justifyContent: 'center' },
  closeText: { color: '#FFFFFF', fontSize: 31, lineHeight: 34, fontWeight: '400' },
  controls: { position: 'absolute', zIndex: 2, bottom: 50, alignSelf: 'center', flexDirection: 'row', alignItems: 'center', gap: 12, padding: 8, borderRadius: 25, backgroundColor: 'rgba(36, 36, 36, .92)', borderWidth: 1, borderColor: 'rgba(255, 255, 255, .24)' },
  zoomButton: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255, 255, 255, .14)' },
  zoomButtonText: { color: '#FFFFFF', fontSize: 26, lineHeight: 29, fontWeight: '600' },
  zoomValue: { minWidth: 52, color: '#FFFFFF', fontSize: 14, fontWeight: '700', textAlign: 'center' },
  help: { position: 'absolute', zIndex: 2, bottom: 18, alignSelf: 'center', color: 'rgba(255, 255, 255, .72)', fontSize: 13 },
  pressed: { opacity: .72 },
  disabled: { opacity: .35 },
});
