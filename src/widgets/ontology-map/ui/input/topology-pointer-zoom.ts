import type { OntologyMapTokens } from "../../tokens/read-map-tokens";
import type { CameraTarget } from "../../engine/camera";
import { computeWheelZoomFactor, createPinchWheelStream, normalizeWheelDeltaY, readPinchWheel, shouldIgnoreWheelGlide } from "../../interaction/wheel";
import { readOntologyMapTokensOrNull } from "../../tokens/topology-read-tokens";
import type { PointerContext } from "./topology-pointer-context";
import type { TopologyPointerHandlers } from "./topology-pointer-types";

export function createPointerZoomHandlers(
  ctx: PointerContext,
): Pick<TopologyPointerHandlers, "handleWheel" | "handleGesturePinch"> {
  const {
    wheelIntent = "zoom",
    pinchWheelRef = { current: createPinchWheelStream() },
    navigationSpeedRef, zoomEaseRef, cameraRef, cameraTargetRef,
    dampingRef, cameraAngularFreqRef, viewportRef, canvasRef, activeTouchesRef,
    noteUserCameraGesture, scaleWithinZoomBounds, currentRect, releaseCameraForZoom,
  } = ctx;

  const zoomAtPoint = (tokens: OntologyMapTokens, sx: number, sy: number, factor: number) => {
    const { width, height } = viewportRef.current;
    const camera = cameraRef.current;
    const worldX = (sx - width / 2) / camera.scale.value + camera.x.value;
    const worldY = (sy - height / 2) / camera.scale.value + camera.y.value;
    const scale = scaleWithinZoomBounds(tokens, camera.scale.value * factor);
    const x = worldX - (sx - width / 2) / scale;
    const y = worldY - (sy - height / 2) / scale;
    cameraTargetRef.current = { tx: x, ty: y, tscale: scale };
    cameraRef.current = {
      x: { value: x, velocity: 0 },
      y: { value: y, velocity: 0 },
      scale: { value: scale, velocity: 0 },
    };
    noteUserCameraGesture();
    dampingRef.current = tokens.cameraDampingDefault;
    cameraAngularFreqRef.current = tokens.cameraSpringAngFreqInteractive;
  };

  const handleGesturePinch = (ratio: number, clientX: number, clientY: number) => {
    if (activeTouchesRef && activeTouchesRef.current.size >= 2)
      return;
    const tokens = readOntologyMapTokensOrNull();
    const canvas = canvasRef?.current;
    if (!tokens || !canvas)
      return;
    releaseCameraForZoom();
    const rect = currentRect(canvas);
    zoomAtPoint(tokens, clientX - rect.left, clientY - rect.top, ratio ** navigationSpeedRef.current.zoom);
  };

  const handleWheel = (e: WheelEvent) => {
    if (wheelIntent === "page-scroll" && !e.ctrlKey)
      return;
    e.preventDefault();
    const tokens = readOntologyMapTokensOrNull();
    if (!tokens)
      return;
    const { width, height } = viewportRef.current;
    const pixelDeltaY = normalizeWheelDeltaY(e.deltaY, e.deltaMode, height);
    if (shouldIgnoreWheelGlide(pixelDeltaY, e.ctrlKey))
      return;
    releaseCameraForZoom();
    const rect = currentRect(e.currentTarget as HTMLCanvasElement);
    const sx = e.clientX - rect.left;
    const sy = e.clientY - rect.top;
    const camera = cameraRef.current;
    const worldX = (sx - width / 2) / camera.scale.value + camera.x.value;
    const worldY = (sy - height / 2) / camera.scale.value + camera.y.value;
    const pinch = readPinchWheel(pinchWheelRef.current, e);
    const factor = computeWheelZoomFactor(pixelDeltaY, { pinch, speed: navigationSpeedRef.current.zoom });
    if (pinch) {
      zoomAtPoint(tokens, sx, sy, factor);
      return;
    }
    const newScale = scaleWithinZoomBounds(tokens, cameraTargetRef.current.tscale * factor);
    const next: CameraTarget = {
      tx: worldX - (sx - width / 2) / newScale,
      ty: worldY - (sy - height / 2) / newScale,
      tscale: newScale,
    };
    cameraTargetRef.current = next;
    noteUserCameraGesture();
    dampingRef.current = tokens.cameraDampingDefault;
    cameraAngularFreqRef.current = tokens.cameraSpringAngFreqInteractive;
    zoomEaseRef.current = {
      target: next,
      anchorX: sx,
      anchorY: sy,
      worldX,
      worldY,
      fromScale: camera.scale.value,
      startMs: Math.min(performance.now(), e.timeStamp > 0 ? e.timeStamp : Infinity),
    };
    cameraRef.current = {
      ...camera,
      x: { value: camera.x.value, velocity: 0 },
      y: { value: camera.y.value, velocity: 0 },
    };
  };
  return { handleWheel, handleGesturePinch };
}
