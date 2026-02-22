import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import type { Board, Tetromino } from '@tetris-battle/game-core';
import { TetrisRenderer } from '../../renderer/TetrisRenderer';
import type { Theme } from '../../themes';

interface CylinderBoardViewProps {
  board: Board;
  currentPiece: Tetromino | null;
  ghostPiece: Tetromino | null;
  theme: Theme;
  width: number;
  height: number;
  showGrid?: boolean;
  showGhost?: boolean;
  borderRadius?: string;
}

type CylinderScene = {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  mesh: THREE.Mesh<THREE.CylinderGeometry, THREE.MeshBasicMaterial>;
  offscreenCanvas: HTMLCanvasElement;
  boardRenderer: TetrisRenderer;
  texture: THREE.CanvasTexture;
};

const TAU = Math.PI * 2;
const BASE_CYLINDER_RADIUS = 1;
const BASE_CYLINDER_HEIGHT = 1;
const CYLINDER_SEGMENTS = 96;
const TEXELS_PER_CELL = 20;
const CYLINDER_FIT_PADDING = 1.08;

function clampDimension(value: number): number {
  if (!Number.isFinite(value)) return 1;
  return Math.max(1, Math.round(value));
}

function getPieceCenterX(piece: Tetromino | null, boardWidth: number): number {
  if (!piece || !Array.isArray(piece.shape) || boardWidth <= 0) {
    return boardWidth / 2;
  }

  let minX = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;

  for (let y = 0; y < piece.shape.length; y++) {
    for (let x = 0; x < piece.shape[y].length; x++) {
      if (!piece.shape[y][x]) continue;
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
    }
  }

  if (!Number.isFinite(minX) || !Number.isFinite(maxX)) {
    return boardWidth / 2;
  }

  const localCenterX = (minX + maxX + 1) / 2;
  return piece.position.x + localCenterX;
}

function drawBoundaryGuide(canvas: HTMLCanvasElement, cellSize: number): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  ctx.save();
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.95)';
  ctx.lineWidth = Math.max(1, Math.round(cellSize * 0.12));
  ctx.setLineDash([Math.max(3, cellSize * 0.45), Math.max(2, cellSize * 0.3)]);

  // The two board edges collapse into a single seam on the cylinder.
  ctx.beginPath();
  ctx.moveTo(0.5, 0);
  ctx.lineTo(0.5, canvas.height);
  ctx.stroke();

  ctx.restore();
}

function resizeTextureCanvas(scene: CylinderScene, board: Board): number {
  const cellSize = Math.max(6, TEXELS_PER_CELL);
  const width = clampDimension(board.width * cellSize);
  const height = clampDimension(board.height * cellSize);

  if (scene.offscreenCanvas.width !== width || scene.offscreenCanvas.height !== height) {
    scene.offscreenCanvas.width = width;
    scene.offscreenCanvas.height = height;
  }

  scene.boardRenderer.setBlockSize(cellSize);
  return cellSize;
}

function getCylinderDimensions(board: Board): {
  radius: number;
  height: number;
  halfWidth: number;
  halfHeight: number;
} {
  const boardWidth = Math.max(1, board.width);
  const boardHeight = Math.max(1, board.height);

  // Keep one board cell approximately square on the unwrapped cylinder surface:
  // (cylinder circumference / columns) === (cylinder height / rows)
  const radius = BASE_CYLINDER_RADIUS;
  const cellWorldSize = (TAU * radius) / boardWidth;
  const height = cellWorldSize * boardHeight;

  return {
    radius,
    height,
    halfWidth: radius,
    halfHeight: height * 0.5,
  };
}

function getCameraDistanceToFit(
  camera: THREE.PerspectiveCamera,
  halfWidth: number,
  halfHeight: number
): number {
  const halfFovY = THREE.MathUtils.degToRad(camera.fov * 0.5);
  const halfFovX = Math.atan(Math.tan(halfFovY) * Math.max(0.0001, camera.aspect));

  const byHeight = halfHeight / Math.max(0.0001, Math.tan(halfFovY));
  const byWidth = halfWidth / Math.max(0.0001, Math.tan(halfFovX));

  return Math.max(byHeight, byWidth) * CYLINDER_FIT_PADDING;
}

function disposeScene(scene: CylinderScene): void {
  scene.mesh.geometry.dispose();
  scene.mesh.material.map?.dispose();
  scene.mesh.material.dispose();
  scene.renderer.dispose();
  scene.renderer.forceContextLoss();
}

export function CylinderBoardView({
  board,
  currentPiece,
  ghostPiece,
  theme,
  width,
  height,
  showGrid = true,
  showGhost = true,
  borderRadius = '8px',
}: CylinderBoardViewProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const sceneRef = useRef<CylinderScene | null>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const offscreenCanvas = document.createElement('canvas');
    offscreenCanvas.width = 1;
    offscreenCanvas.height = 1;

    const boardRenderer = new TetrisRenderer(offscreenCanvas, TEXELS_PER_CELL, theme);
    const texture = new THREE.CanvasTexture(offscreenCanvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.ClampToEdgeWrapping;
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.NearestFilter;
    texture.generateMipmaps = false;
    texture.colorSpace = THREE.SRGBColorSpace;

    const geometry = new THREE.CylinderGeometry(
      BASE_CYLINDER_RADIUS,
      BASE_CYLINDER_RADIUS,
      BASE_CYLINDER_HEIGHT,
      CYLINDER_SEGMENTS,
      1,
      true
    );
    const material = new THREE.MeshBasicMaterial({
      map: texture,
      transparent: true,
      side: THREE.DoubleSide,
    });
    const mesh = new THREE.Mesh(geometry, material);

    const scene = new THREE.Scene();
    scene.add(mesh);

    const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 100);
    camera.position.set(0, 0, 4.2);
    camera.lookAt(0, 0, 0);

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance',
    });
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(clampDimension(width), clampDimension(height), false);
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    renderer.domElement.style.display = 'block';

    host.replaceChildren(renderer.domElement);

    sceneRef.current = {
      renderer,
      scene,
      camera,
      mesh,
      offscreenCanvas,
      boardRenderer,
      texture,
    };

    return () => {
      const current = sceneRef.current;
      sceneRef.current = null;
      if (!current) return;
      disposeScene(current);
      host.replaceChildren();
    };
  }, []);

  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;

    const pixelWidth = clampDimension(width);
    const pixelHeight = clampDimension(height);

    scene.renderer.setSize(pixelWidth, pixelHeight, false);
    scene.camera.aspect = pixelWidth / pixelHeight;
    scene.camera.updateProjectionMatrix();
  }, [width, height]);

  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;

    const cellSize = resizeTextureCanvas(scene, board);
    scene.boardRenderer.setTheme(theme);
    scene.boardRenderer.render(board, currentPiece, ghostPiece, {
      showGrid,
      showGhost,
    });
    drawBoundaryGuide(scene.offscreenCanvas, cellSize);
    scene.texture.needsUpdate = true;

    const dimensions = getCylinderDimensions(board);
    scene.mesh.scale.set(
      dimensions.radius / BASE_CYLINDER_RADIUS,
      dimensions.height / BASE_CYLINDER_HEIGHT,
      dimensions.radius / BASE_CYLINDER_RADIUS
    );

    // Keep active piece centered toward the viewer by rotating around Y.
    const centerX = getPieceCenterX(currentPiece, board.width);
    const normalized = ((centerX % board.width) + board.width) / board.width;
    scene.mesh.rotation.y = -normalized * TAU;

    const fitDistance = getCameraDistanceToFit(scene.camera, dimensions.halfWidth, dimensions.halfHeight);
    scene.camera.position.z = fitDistance;
    scene.camera.lookAt(0, 0, 0);
    scene.renderer.render(scene.scene, scene.camera);
  }, [board, currentPiece, ghostPiece, theme, showGrid, showGhost]);

  return (
    <div
      ref={hostRef}
      style={{
        position: 'absolute',
        inset: 0,
        borderRadius,
        overflow: 'hidden',
        pointerEvents: 'none',
        zIndex: 1,
      }}
    />
  );
}
