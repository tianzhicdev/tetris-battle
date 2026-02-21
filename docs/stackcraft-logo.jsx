import { useState } from "react";

export default function Logo() {
  const [bg, setBg] = useState("dark");

  const II = ({ w = 300, h = 200, barW = 28, gap = 44, opacity = 0.12 }) => {
    const left = (w - gap - barW * 2) / 2;
    return (
      <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} fill="none">
        <rect x={left} y={0} width={barW} height={h} rx={2} fill="#00c8e0" opacity={opacity} />
        <rect x={left + barW + gap} y={0} width={barW} height={h} rx={2} fill="#00c8e0" opacity={opacity} />
      </svg>
    );
  };

  return (
    <div style={{
      minHeight: "100vh",
      background: bg === "dark" ? "#06060f" : bg === "black" ? "#000" : "#0a0a1a",
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
      gap: 80, padding: 40,
    }}>
      <link href="https://fonts.googleapis.com/css2?family=Orbitron:wght@400;500;600;700;800;900&display=swap" rel="stylesheet" />

      <div style={{ display: "flex", gap: 6 }}>
        {["dark", "black", "navy"].map(b => (
          <button key={b} onClick={() => setBg(b)} style={{
            background: bg === b ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.02)",
            border: `1px solid ${bg === b ? "#ffffff33" : "#ffffff0a"}`,
            borderRadius: 6, padding: "4px 12px", cursor: "pointer",
            color: bg === b ? "#fff" : "#ffffff44",
            fontSize: 8, fontFamily: "'Orbitron'", letterSpacing: 2,
          }}>{b.toUpperCase()}</button>
        ))}
      </div>

      {/* ====== MAIN ====== */}
      <div style={{ position: "relative", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ position: "absolute" }}>
          <II w={460} h={120} barW={32} gap={50} opacity={0.1} />
        </div>
        <span style={{
          position: "relative",
          fontFamily: "'Orbitron'", fontSize: 64, fontWeight: 900, letterSpacing: 6,
          color: "#e0e4f0",
          textShadow: "0 2px 0 #22263a, 0 0 80px rgba(0,200,230,0.05)",
        }}>STACKCRAFT</span>
      </div>

      {/* ====== STACKED ====== */}
      <div style={{ position: "relative", display: "flex", flexDirection: "column", alignItems: "center" }}>
        <div style={{ position: "absolute", top: "50%", transform: "translateY(-50%)" }}>
          <II w={340} h={180} barW={30} gap={44} opacity={0.1} />
        </div>
        <span style={{
          position: "relative",
          fontFamily: "'Orbitron'", fontSize: 62, fontWeight: 900, letterSpacing: 8,
          color: "#e0e4f0", lineHeight: 1,
          textShadow: "0 2px 0 #22263a",
        }}>STACK</span>
        <span style={{
          position: "relative",
          fontFamily: "'Orbitron'", fontSize: 62, fontWeight: 900, letterSpacing: 8,
          color: "#e0e4f0", lineHeight: 1,
          textShadow: "0 2px 0 #22263a",
        }}>CRAFT</span>
      </div>

      {/* ====== SMALL ====== */}
      <div style={{ position: "relative", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ position: "absolute" }}>
          <II w={220} h={50} barW={14} gap={24} opacity={0.1} />
        </div>
        <span style={{
          position: "relative",
          fontFamily: "'Orbitron'", fontSize: 28, fontWeight: 900, letterSpacing: 4,
          color: "#e0e4f0",
          textShadow: "0 1px 0 #22263a",
        }}>STACKCRAFT</span>
      </div>

      {/* ====== ICON ====== */}
      <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
        {[72, 48, 32].map(sz => {
          const b = Math.round(sz * 0.1);
          const g = Math.round(sz * 0.12);
          const fs = Math.round(sz * 0.22);
          return (
            <div key={sz} style={{
              width: sz, height: sz, borderRadius: sz * 0.2,
              background: "#08081a",
              border: "1px solid rgba(0,200,224,0.06)",
              display: "flex", alignItems: "center", justifyContent: "center",
              position: "relative", overflow: "hidden",
            }}>
              {/* II bars */}
              <div style={{ position: "absolute", display: "flex", gap: g, height: "100%" }}>
                <div style={{ width: b, height: "100%", background: "#00c8e0", opacity: 0.08, borderRadius: 1 }} />
                <div style={{ width: b, height: "100%", background: "#00c8e0", opacity: 0.08, borderRadius: 1 }} />
              </div>
              <span style={{
                position: "relative",
                fontFamily: "'Orbitron'", fontSize: fs, fontWeight: 900, letterSpacing: 0.5,
                color: "#e0e4f0",
              }}>SC</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
