import { useState, useEffect, useRef, useCallback, useMemo } from "react";

const COLS = 10;
const ROWS = 20;
const CELL = 28;
const TICK_MS = 500;
const FAST_TICK = 40;

const PIECES = {
  I: { shape: [[1,1,1,1]], color: "#00f0f0", gradAngle: 180 },
  O: { shape: [[1,1],[1,1]], color: "#f0e000", gradAngle: 135 },
  T: { shape: [[0,1,0],[1,1,1]], color: "#b040f0", gradAngle: 150 },
  S: { shape: [[0,1,1],[1,1,0]], color: "#00f060", gradAngle: 120 },
  Z: { shape: [[1,1,0],[0,1,1]], color: "#f04040", gradAngle: 160 },
  J: { shape: [[1,0,0],[1,1,1]], color: "#4080ff", gradAngle: 140 },
  L: { shape: [[0,0,1],[1,1,1]], color: "#f0a020", gradAngle: 130 },
};
const PIECE_KEYS = Object.keys(PIECES);

const SKILLS = [
  { char: "震", name: "QUAKE", cost: 40 },
  { char: "揺", name: "SHAKE", cost: 40 },
  { char: "墨", name: "INK", cost: 35 },
  { char: "縮", name: "MINI", cost: 35 },
  { char: "満", name: "FILL", cost: 75 },
  { char: "消", name: "CLEAR", cost: 100 },
];

const bag = (() => {
  let b = [];
  return () => {
    if (b.length === 0) b = [...PIECE_KEYS].sort(() => Math.random() - 0.5);
    const key = b.pop();
    return { ...PIECES[key], key, x: Math.floor((COLS - PIECES[key].shape[0].length) / 2), y: 0, rotation: 0 };
  };
})();

const rotate = (shape) => {
  const rows = shape.length, cols = shape[0].length;
  return Array.from({ length: cols }, (_, c) =>
    Array.from({ length: rows }, (_, r) => shape[rows - 1 - r][c])
  );
};

const emptyBoard = () => Array.from({ length: ROWS }, () => Array(COLS).fill(null));

const collides = (board, shape, px, py) => {
  for (let r = 0; r < shape.length; r++)
    for (let c = 0; c < shape[0].length; c++)
      if (shape[r][c]) {
        const nx = px + c, ny = py + r;
        if (nx < 0 || nx >= COLS || ny >= ROWS) return true;
        if (ny >= 0 && board[ny][nx]) return true;
      }
  return false;
};

// Particle
class Particle {
  constructor(x, y, color, type = "burst") {
    this.x = x; this.y = y; this.color = color; this.type = type;
    if (type === "burst") {
      const a = Math.random() * Math.PI * 2, sp = 2 + Math.random() * 5;
      this.vx = Math.cos(a) * sp; this.vy = Math.sin(a) * sp - 2;
      this.life = 1; this.decay = 0.014 + Math.random() * 0.02; this.size = 2 + Math.random() * 4;
    } else if (type === "trail") {
      this.vx = (Math.random() - 0.5) * 0.6; this.vy = -0.8 - Math.random() * 1.5;
      this.life = 1; this.decay = 0.04 + Math.random() * 0.03; this.size = 1.5 + Math.random() * 2.5;
    } else if (type === "ambient") {
      this.vx = (Math.random() - 0.5) * 0.12; this.vy = -0.08 - Math.random() * 0.15;
      this.life = 0.4 + Math.random() * 0.3; this.decay = 0.001 + Math.random() * 0.002; this.size = 0.8 + Math.random() * 1.2;
    } else if (type === "lock") {
      const a = Math.random() * Math.PI * 2, sp = 0.3 + Math.random() * 1.2;
      this.vx = Math.cos(a) * sp; this.vy = Math.sin(a) * sp;
      this.life = 1; this.decay = 0.035 + Math.random() * 0.025; this.size = 1 + Math.random() * 2;
    } else if (type === "lineSweep") {
      this.vx = (Math.random() - 0.5) * 0.3; this.vy = -0.3 - Math.random() * 0.4;
      this.life = 1; this.decay = 0.008 + Math.random() * 0.008; this.size = 1 + Math.random() * 1.5;
    }
  }
  update() {
    this.x += this.vx; this.y += this.vy;
    if (this.type === "burst") this.vy += 0.14;
    if (this.type === "lock") { this.vx *= 0.95; this.vy *= 0.95; }
    this.life -= this.decay;
    return this.life > 0;
  }
}

export default function TetrisCyberpunk() {
  const [board, setBoard] = useState(emptyBoard);
  const [piece, setPiece] = useState(() => bag());
  const [queue, setQueue] = useState(() => [bag(), bag(), bag()]);
  const [score, setScore] = useState(0);
  const [lines, setLines] = useState(0);
  const [combo, setCombo] = useState(0);
  const [stars, setStars] = useState(200);
  const [gameOver, setGameOver] = useState(false);
  const [shake, setShake] = useState({ x: 0, y: 0 });
  const [flashRows, setFlashRows] = useState([]);
  const [floatingTexts, setFloatingTexts] = useState([]);
  const [lockFlash, setLockFlash] = useState(null);
  const [dropTrail, setDropTrail] = useState([]);
  const [activeSkill, setActiveSkill] = useState(null);
  const [level, setLevel] = useState(1);

  const canvasRef = useRef(null);
  const particlesRef = useRef([]);
  const boardRef = useRef(board);
  const pieceRef = useRef(piece);
  const queueRef = useRef(queue);
  const gameOverRef = useRef(false);
  const softDropRef = useRef(false);
  const frameRef = useRef(0);
  const tickRef = useRef(null);

  boardRef.current = board;
  pieceRef.current = piece;
  queueRef.current = queue;
  gameOverRef.current = gameOver;

  const addParticles = useCallback((x, y, color, count, type = "burst") => {
    for (let i = 0; i < count; i++) particlesRef.current.push(new Particle(x, y, color, type));
  }, []);

  const triggerShake = useCallback((intensity = 4) => {
    const dur = 280;
    const start = Date.now();
    const anim = () => {
      const t = (Date.now() - start) / dur;
      if (t > 1) { setShake({ x: 0, y: 0 }); return; }
      const d = (1 - t) * (1 - t);
      setShake({
        x: (Math.random() - 0.5) * intensity * d * 2,
        y: (Math.random() - 0.5) * intensity * d * 2,
      });
      requestAnimationFrame(anim);
    };
    anim();
  }, []);

  const addFloatingText = useCallback((text, x, y, color = "#fff", size = 16) => {
    const id = Date.now() + Math.random();
    setFloatingTexts((p) => [...p, { id, text, x, y, color, size, born: Date.now() }]);
    setTimeout(() => setFloatingTexts((p) => p.filter((t) => t.id !== id)), 1400);
  }, []);

  const getShape = useCallback((p) => {
    let s = p.shape;
    for (let i = 0; i < (p.rotation || 0) % 4; i++) s = rotate(s);
    return s;
  }, []);

  const lockPiece = useCallback(() => {
    const p = pieceRef.current;
    const shape = getShape(p);
    const newBoard = boardRef.current.map((r) => [...r]);
    const cells = [];

    for (let r = 0; r < shape.length; r++)
      for (let c = 0; c < shape[0].length; c++)
        if (shape[r][c]) {
          const ny = p.y + r, nx = p.x + c;
          if (ny < 0) { setGameOver(true); return; }
          newBoard[ny][nx] = { color: p.color, gradAngle: p.gradAngle || 135 };
          cells.push({ x: nx, y: ny });
          addParticles(nx * CELL + CELL / 2, ny * CELL + CELL / 2, p.color, 3, "lock");
        }

    setLockFlash({ cells, color: p.color, time: Date.now() });
    setTimeout(() => setLockFlash(null), 180);

    const fullRows = [];
    for (let r = 0; r < ROWS; r++)
      if (newBoard[r].every((c) => c !== null)) fullRows.push(r);

    if (fullRows.length > 0) {
      setFlashRows(fullRows);
      const nc = combo + 1;
      setCombo(nc);

      fullRows.forEach((row) => {
        for (let c = 0; c < COLS; c++) {
          const cell = newBoard[row][c];
          if (cell) {
            addParticles(c * CELL + CELL / 2, row * CELL + CELL / 2, cell.color, 8, "burst");
            // Lingering sweep particles
            addParticles(c * CELL + CELL / 2, row * CELL + CELL / 2, cell.color, 3, "lineSweep");
          }
        }
      });

      triggerShake(fullRows.length * 5 + 2);

      const pts = [0, 100, 300, 500, 800][fullRows.length] || 800;
      const multi = nc > 1 ? 1 + nc * 0.25 : 1;
      const total = Math.round(pts * multi * level);
      setScore((s) => s + total);
      setLines((l) => l + fullRows.length);
      setStars((s) => s + fullRows.length * 15 + (fullRows.length === 4 ? 50 : 0));
      setLevel((l) => Math.floor(lines / 10) + 1);

      const labels = ["", "SINGLE", "DOUBLE", "TRIPLE", "TETRIS!"];
      const colors = ["", "#ffffff", "#00f0f0", "#f0a020", "#ff2080"];
      addFloatingText(
        labels[fullRows.length] + (nc > 1 ? `  ×${nc}` : ""),
        COLS * CELL / 2, fullRows[0] * CELL - 10,
        colors[fullRows.length],
        fullRows.length === 4 ? 24 : 18
      );
      addFloatingText(`+${total}`, COLS * CELL / 2, fullRows[0] * CELL + 18, "#ffffffcc", 13);

      setTimeout(() => {
        const cleared = [...newBoard];
        fullRows.sort((a, b) => b - a).forEach((row) => {
          cleared.splice(row, 1);
          cleared.unshift(Array(COLS).fill(null));
        });
        setBoard(cleared);
        setFlashRows([]);
      }, 280);
      setBoard(newBoard);
    } else {
      setBoard(newBoard);
      setCombo(0);
    }

    const q = [...queueRef.current];
    const np = q.shift();
    q.push(bag());
    setQueue(q);
    if (collides(newBoard, np.shape, np.x, np.y)) { setGameOver(true); return; }
    setPiece(np);
  }, [combo, level, lines, addParticles, triggerShake, addFloatingText, getShape]);

  const moveDown = useCallback(() => {
    if (gameOverRef.current) return;
    const p = pieceRef.current;
    const shape = getShape(p);
    if (!collides(boardRef.current, shape, p.x, p.y + 1)) {
      setPiece((prev) => ({ ...prev, y: prev.y + 1 }));
    } else lockPiece();
  }, [lockPiece, getShape]);

  const hardDrop = useCallback(() => {
    if (gameOverRef.current) return;
    const p = pieceRef.current;
    const shape = getShape(p);
    let dy = p.y;
    while (!collides(boardRef.current, shape, p.x, dy + 1)) dy++;

    const trail = [];
    for (let r = 0; r < shape.length; r++)
      for (let c = 0; c < shape[0].length; c++)
        if (shape[r][c]) {
          for (let ty = p.y + r; ty <= dy + r; ty++)
            trail.push({ x: p.x + c, y: ty, color: p.color });
          addParticles((p.x + c) * CELL + CELL / 2, (dy + r) * CELL + CELL / 2, p.color, 5, "trail");
        }
    setDropTrail(trail);
    setTimeout(() => setDropTrail([]), 140);

    setScore((s) => s + (dy - p.y) * 2);
    setPiece((prev) => ({ ...prev, y: dy }));
    triggerShake(3);
    setTimeout(() => lockPiece(), 10);
  }, [lockPiece, getShape, addParticles, triggerShake]);

  const move = useCallback((dx) => {
    if (gameOverRef.current) return;
    const p = pieceRef.current;
    const shape = getShape(p);
    if (!collides(boardRef.current, shape, p.x + dx, p.y))
      setPiece((prev) => ({ ...prev, x: prev.x + dx }));
  }, [getShape]);

  const rotatePiece = useCallback(() => {
    if (gameOverRef.current) return;
    const p = pieceRef.current;
    const nr = (p.rotation || 0) + 1;
    let shape = p.shape;
    for (let i = 0; i < nr % 4; i++) shape = rotate(shape);
    for (const dx of [0, -1, 1, -2, 2])
      if (!collides(boardRef.current, shape, p.x + dx, p.y)) {
        setPiece((prev) => ({ ...prev, rotation: nr, x: prev.x + dx }));
        return;
      }
  }, []);

  const restart = useCallback(() => {
    setBoard(emptyBoard());
    setPiece(bag());
    setQueue([bag(), bag(), bag()]);
    setScore(0); setLines(0); setCombo(0); setStars(200);
    setGameOver(false); setFlashRows([]); setFloatingTexts([]);
    setLevel(1);
    particlesRef.current = [];
  }, []);

  // Game tick
  useEffect(() => {
    if (gameOver) return;
    const speed = Math.max(80, TICK_MS - (level - 1) * 40);
    const id = setInterval(moveDown, softDropRef.current ? FAST_TICK : speed);
    return () => clearInterval(id);
  }, [gameOver, moveDown, level]);

  // Keyboard
  useEffect(() => {
    const kd = (e) => {
      if (gameOver && e.key === "r") { restart(); return; }
      if (gameOver) return;
      switch (e.key) {
        case "ArrowLeft": move(-1); break;
        case "ArrowRight": move(1); break;
        case "ArrowDown": softDropRef.current = true; break;
        case "ArrowUp": rotatePiece(); break;
        case " ": e.preventDefault(); hardDrop(); break;
      }
    };
    const ku = (e) => { if (e.key === "ArrowDown") softDropRef.current = false; };
    window.addEventListener("keydown", kd);
    window.addEventListener("keyup", ku);
    return () => { window.removeEventListener("keydown", kd); window.removeEventListener("keyup", ku); };
  }, [gameOver, move, rotatePiece, hardDrop, restart]);

  // Canvas particles
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    let running = true;

    const ambient = setInterval(() => {
      if (particlesRef.current.length < 120)
        addParticles(Math.random() * COLS * CELL, ROWS * CELL + 5, `hsl(${180 + Math.random() * 40}, 60%, 50%)`, 1, "ambient");
    }, 200);

    const draw = () => {
      if (!running) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      particlesRef.current = particlesRef.current.filter((p) => {
        p.update();
        if (p.life <= 0) return false;
        ctx.globalAlpha = Math.min(p.life, 1) * (p.type === "ambient" ? 0.6 : 1);
        ctx.shadowColor = p.color;
        ctx.shadowBlur = p.type === "ambient" ? 3 : p.type === "lineSweep" ? 8 : 10;
        ctx.fillStyle = p.color;
        if (p.type === "burst") {
          const s = p.size * Math.max(p.life, 0.2);
          ctx.fillRect(p.x - s / 2, p.y - s / 2, s, s);
        } else {
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size * Math.min(p.life + 0.3, 1), 0, Math.PI * 2);
          ctx.fill();
        }
        return true;
      });
      ctx.globalAlpha = 1; ctx.shadowBlur = 0;
      frameRef.current = requestAnimationFrame(draw);
    };
    draw();
    return () => { running = false; cancelAnimationFrame(frameRef.current); clearInterval(ambient); };
  }, [addParticles]);

  // Ghost Y
  const ghostY = useMemo(() => {
    if (gameOver) return piece.y;
    const shape = getShape(piece);
    let gy = piece.y;
    while (!collides(board, shape, piece.x, gy + 1)) gy++;
    return gy;
  }, [board, piece, gameOver, getShape]);

  const currentShape = useMemo(() => getShape(piece), [piece, getShape]);

  const W = COLS * CELL;
  const H = ROWS * CELL;

  return (
    <div style={{
      background: "radial-gradient(ellipse at 50% 20%, #0e0a2a 0%, #06060f 60%, #020208 100%)",
      minHeight: "100vh",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      fontFamily: "'Orbitron', sans-serif",
      overflow: "hidden",
      userSelect: "none",
      padding: "10px 0",
    }}>
      <link href="https://fonts.googleapis.com/css2?family=Orbitron:wght@400;700;900&family=Noto+Sans+SC:wght@400;700&display=swap" rel="stylesheet" />

      {/* === HUD - no boxes, just glowing numbers === */}
      <div style={{
        display: "flex",
        gap: 32,
        marginBottom: 10,
        alignItems: "baseline",
      }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 8, color: "#00f0f044", letterSpacing: 4 }}>SCORE</div>
          <div style={{
            fontSize: 30,
            fontWeight: 900,
            color: "#00f0f0",
            textShadow: "0 0 20px #00f0f066, 0 0 50px #00f0f022",
            lineHeight: 1,
          }}>{score.toLocaleString()}</div>
        </div>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 8, color: "#b040f044", letterSpacing: 4 }}>STARS</div>
          <div style={{
            fontSize: 18,
            fontWeight: 700,
            color: "#b040f0",
            textShadow: "0 0 12px #b040f044",
            lineHeight: 1,
          }}>{stars}</div>
        </div>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 8, color: "#f0a02044", letterSpacing: 4 }}>LINES</div>
          <div style={{
            fontSize: 18,
            fontWeight: 700,
            color: "#f0a020",
            textShadow: "0 0 12px #f0a02044",
            lineHeight: 1,
          }}>{lines}</div>
        </div>
        {combo > 0 && (
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 8, color: "#ff208044", letterSpacing: 4 }}>COMBO</div>
            <div style={{
              fontSize: 18,
              fontWeight: 900,
              color: "#ff2080",
              textShadow: "0 0 20px #ff208088",
              lineHeight: 1,
              animation: "comboPulse 0.4s ease",
            }}>{combo}×</div>
          </div>
        )}
      </div>

      {/* === Main layout === */}
      <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>

        {/* Left - Next queue, no containers */}
        <div style={{
          display: "flex",
          flexDirection: "column",
          gap: 6,
          paddingTop: 8,
          width: 50,
          alignItems: "center",
        }}>
          <div style={{ fontSize: 7, color: "#ffffff16", letterSpacing: 3, marginBottom: 4 }}>NEXT</div>
          {queue.map((q, qi) => {
            const opacity = [0.85, 0.45, 0.2][qi];
            const scale = [1, 0.85, 0.7][qi];
            return (
              <div key={qi} style={{
                opacity,
                transform: `scale(${scale})`,
                height: 38,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                transition: "all 0.3s ease",
              }}>
                <div style={{ position: "relative" }}>
                  {q.shape.map((row, ry) =>
                    row.map((cell, cx) => {
                      if (!cell) return null;
                      const s = 12;
                      return (
                        <div key={`${ry}-${cx}`} style={{
                          position: "absolute",
                          left: cx * s - (q.shape[0].length * s) / 2,
                          top: ry * s - (q.shape.length * s) / 2,
                          width: s - 1,
                          height: s - 1,
                          borderRadius: 2,
                          background: `linear-gradient(${q.gradAngle || 135}deg, ${q.color}cc, ${q.color}66)`,
                          boxShadow: `0 0 4px ${q.color}44`,
                        }} />
                      );
                    })
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Board */}
        <div style={{
          position: "relative",
          transform: `translate(${shake.x}px, ${shake.y}px)`,
        }}>
          {/* Glow border - subtle */}
          <div style={{
            position: "absolute",
            inset: -2,
            borderRadius: 6,
            border: "1px solid #00f0f018",
            boxShadow: "0 0 30px #00f0f008, inset 0 0 30px #00f0f004",
            pointerEvents: "none",
            zIndex: 5,
          }} />

          <div style={{
            width: W,
            height: H,
            position: "relative",
            borderRadius: 4,
            overflow: "hidden",
            // Semi-transparent so bg shows through
            background: "rgba(5, 5, 22, 0.78)",
            backdropFilter: "blur(6px)",
          }}>
            {/* Ultra-subtle grid */}
            <div style={{
              position: "absolute", inset: 0,
              background: `
                repeating-linear-gradient(0deg, transparent, transparent ${CELL - 1}px, rgba(255,255,255,0.018) ${CELL}px),
                repeating-linear-gradient(90deg, transparent, transparent ${CELL - 1}px, rgba(255,255,255,0.018) ${CELL}px)
              `,
              zIndex: 1, pointerEvents: "none",
            }} />

            {/* Vignette */}
            <div style={{
              position: "absolute", inset: 0,
              background: "radial-gradient(ellipse at 50% 45%, transparent 35%, rgba(3,3,15,0.65) 100%)",
              pointerEvents: "none", zIndex: 6,
            }} />

            {/* Board cells */}
            {board.map((row, ry) =>
              row.map((cell, cx) => {
                if (!cell) return null;
                const isFlashing = flashRows.includes(ry);
                const { color: cc, gradAngle: ga } = cell;
                return (
                  <div key={`${ry}-${cx}`} style={{
                    position: "absolute",
                    left: cx * CELL + 1, top: ry * CELL + 1,
                    width: CELL - 2, height: CELL - 2,
                    borderRadius: 3, zIndex: 2,
                    background: isFlashing
                      ? `linear-gradient(${ga}deg, #ffffffee, ${cc}cc)`
                      : `linear-gradient(${ga}deg, ${cc}dd, ${cc}66)`,
                    boxShadow: isFlashing
                      ? `0 0 16px #ffffff, 0 0 30px ${cc}88`
                      : `0 0 6px ${cc}44, 0 0 14px ${cc}18`,
                    transition: isFlashing ? "all 0.08s" : "none",
                  }}>
                    {/* Top-left highlight */}
                    <div style={{
                      position: "absolute", top: 2, left: 2,
                      width: "40%", height: "35%",
                      background: "rgba(255,255,255,0.18)",
                      borderRadius: "2px 1px 3px 1px",
                    }} />
                    {/* Bottom-right shadow */}
                    <div style={{
                      position: "absolute", bottom: 1, right: 1,
                      width: "50%", height: "40%",
                      background: "rgba(0,0,0,0.12)",
                      borderRadius: "1px 1px 2px 1px",
                    }} />
                  </div>
                );
              })
            )}

            {/* Lock flash */}
            {lockFlash && lockFlash.cells.map((c, i) => (
              <div key={`lf-${i}`} style={{
                position: "absolute",
                left: c.x * CELL - 4, top: c.y * CELL - 4,
                width: CELL + 8, height: CELL + 8,
                background: `radial-gradient(circle, ${lockFlash.color}44, transparent 70%)`,
                zIndex: 3, pointerEvents: "none",
                animation: "lockPulse 0.18s ease-out",
              }} />
            ))}

            {/* Drop trail */}
            {dropTrail.map((t, i) => (
              <div key={`tr-${i}`} style={{
                position: "absolute",
                left: t.x * CELL + 5, top: t.y * CELL + 5,
                width: CELL - 10, height: CELL - 10,
                borderRadius: 2,
                background: `${t.color}18`,
                boxShadow: `0 0 8px ${t.color}33`,
                zIndex: 1,
              }} />
            ))}

            {/* Ghost */}
            {!gameOver && currentShape.map((row, ry) =>
              row.map((cell, cx) => {
                if (!cell) return null;
                return (
                  <div key={`gh-${ry}-${cx}`} style={{
                    position: "absolute",
                    left: (piece.x + cx) * CELL + 3, top: (ghostY + ry) * CELL + 3,
                    width: CELL - 6, height: CELL - 6,
                    borderRadius: 3,
                    border: `1px solid ${piece.color}30`,
                    background: `${piece.color}08`,
                    zIndex: 1,
                  }} />
                );
              })
            )}

            {/* Active piece */}
            {!gameOver && currentShape.map((row, ry) =>
              row.map((cell, cx) => {
                if (!cell) return null;
                return (
                  <div key={`ap-${ry}-${cx}`} style={{
                    position: "absolute",
                    left: (piece.x + cx) * CELL + 1, top: (piece.y + ry) * CELL + 1,
                    width: CELL - 2, height: CELL - 2,
                    borderRadius: 3, zIndex: 3,
                    background: `linear-gradient(${piece.gradAngle || 135}deg, ${piece.color}ee, ${piece.color}99)`,
                    boxShadow: `0 0 8px ${piece.color}66, 0 0 20px ${piece.color}22`,
                  }}>
                    <div style={{
                      position: "absolute", top: 2, left: 2,
                      width: "40%", height: "35%",
                      background: "rgba(255,255,255,0.22)",
                      borderRadius: "2px 1px 3px 1px",
                    }} />
                  </div>
                );
              })
            )}

            {/* Particle canvas */}
            <canvas ref={canvasRef} width={W} height={H} style={{
              position: "absolute", inset: 0, zIndex: 8, pointerEvents: "none",
            }} />

            {/* Floating texts */}
            {floatingTexts.map((ft) => {
              const age = Math.min((Date.now() - ft.born) / 1400, 1);
              return (
                <div key={ft.id} style={{
                  position: "absolute",
                  left: ft.x, top: ft.y - age * 50,
                  transform: `translateX(-50%) scale(${1 + age * 0.15})`,
                  fontSize: ft.size,
                  fontWeight: 900,
                  color: ft.color,
                  textShadow: `0 0 10px ${ft.color}, 0 0 30px ${ft.color}66`,
                  opacity: age < 0.15 ? age / 0.15 : 1 - (age - 0.15) / 0.85,
                  zIndex: 20,
                  pointerEvents: "none",
                  letterSpacing: 3,
                  whiteSpace: "nowrap",
                }}>{ft.text}</div>
              );
            })}

            {/* Game over */}
            {gameOver && (
              <div style={{
                position: "absolute", inset: 0,
                background: "rgba(3,3,12,0.88)",
                backdropFilter: "blur(8px)",
                display: "flex", flexDirection: "column",
                alignItems: "center", justifyContent: "center",
                zIndex: 50,
              }}>
                <div style={{
                  fontSize: 26, fontWeight: 900,
                  color: "#ff2080",
                  textShadow: "0 0 30px #ff208066, 0 0 60px #ff208022",
                  marginBottom: 6, letterSpacing: 4,
                }}>GAME OVER</div>
                <div style={{ fontSize: 32, fontWeight: 900, color: "#00f0f0", textShadow: "0 0 20px #00f0f066", marginBottom: 4 }}>{score.toLocaleString()}</div>
                <div style={{ fontSize: 10, color: "#ffffff44", marginBottom: 20, letterSpacing: 2 }}>{lines} lines · level {level}</div>
                <button onClick={restart} style={{
                  background: "transparent",
                  border: "1px solid #00f0f044",
                  color: "#00f0f0",
                  fontFamily: "'Orbitron'",
                  fontSize: 11, fontWeight: 700,
                  padding: "8px 28px",
                  borderRadius: 4, cursor: "pointer",
                  letterSpacing: 3,
                  textShadow: "0 0 8px #00f0f044",
                  boxShadow: "0 0 20px #00f0f011",
                }}>RESTART</button>
              </div>
            )}
          </div>
        </div>

        {/* Right - opponent area placeholder */}
        <div style={{ width: 50, paddingTop: 8 }}>
          <div style={{ fontSize: 7, color: "#ffffff10", letterSpacing: 2, textAlign: "center", marginBottom: 6 }}>LVL</div>
          <div style={{
            fontSize: 20, fontWeight: 900,
            color: "#ffffff18",
            textAlign: "center",
            textShadow: "0 0 10px #ffffff08",
          }}>{level}</div>
        </div>
      </div>

      {/* === Skills bar - Ghost style === */}
      <div style={{
        display: "flex",
        gap: 6,
        marginTop: 12,
        justifyContent: "center",
      }}>
        {SKILLS.map((s, i) => {
          const isActive = activeSkill === i;
          const canAfford = stars >= s.cost;
          return (
            <div
              key={s.char}
              onClick={() => {
                if (canAfford && !gameOver) {
                  setActiveSkill(isActive ? null : i);
                  if (!isActive) {
                    setStars((st) => st - s.cost);
                    addFloatingText(`−${s.cost}`, COLS * CELL / 2, ROWS * CELL - 20, "#b040f0", 12);
                  }
                }
              }}
              style={{
                width: 44,
                height: 52,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                cursor: canAfford ? "pointer" : "default",
                opacity: isActive ? 1 : canAfford ? 0.3 : 0.12,
                transition: "all 0.25s ease",
              }}
            >
              <div style={{
                fontSize: 24,
                color: isActive ? "#00f0f0" : "#ffffff",
                fontFamily: "'Noto Sans SC', sans-serif",
                lineHeight: 1,
                textShadow: isActive ? "0 0 16px #00f0f088, 0 0 30px #00f0f044" : "none",
                transition: "all 0.25s",
              }}>{s.char}</div>
              <div style={{
                fontSize: 8,
                color: isActive ? "#00f0f088" : "#ffffff33",
                marginTop: 3,
                fontFamily: "'Orbitron'",
                letterSpacing: 1,
              }}>★{s.cost}</div>
            </div>
          );
        })}
      </div>

      {/* === Controls - ultra subtle === */}
      <div style={{
        display: "flex",
        gap: 6,
        marginTop: 10,
        justifyContent: "center",
      }}>
        {[
          { label: "◁", action: () => move(-1) },
          { label: "▽▽", action: hardDrop, wide: true },
          { label: "▽", action: moveDown },
          { label: "↻", action: rotatePiece },
          { label: "▷", action: () => move(1) },
        ].map((btn, i) => (
          <button
            key={i}
            onPointerDown={(e) => { e.preventDefault(); btn.action(); }}
            style={{
              width: btn.wide ? 56 : 46,
              height: 44,
              background: "rgba(255,255,255,0.025)",
              border: "1px solid rgba(255,255,255,0.06)",
              borderRadius: 10,
              color: "#ffffff30",
              fontSize: btn.label === "↻" ? 18 : 14,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              WebkitTapHighlightColor: "transparent",
              fontFamily: "system-ui",
            }}
          >{btn.label}</button>
        ))}
      </div>

      <style>{`
        @keyframes lockPulse {
          0% { opacity: 1; transform: scale(1.15); }
          100% { opacity: 0; transform: scale(1); }
        }
        @keyframes comboPulse {
          0% { transform: scale(1.4); }
          50% { transform: scale(0.95); }
          100% { transform: scale(1); }
        }
      `}</style>
    </div>
  );
}
