import { useState } from "react";

// ============================================================
// DESIGN TOKENS — the single source of truth
// ============================================================
const T = {
  // Colors
  bg: {
    deep: "#06060f",
    panel: "rgba(8, 10, 24, 0.92)",
    card: "rgba(255, 255, 255, 0.025)",
    cardHover: "rgba(255, 255, 255, 0.045)",
    input: "rgba(255, 255, 255, 0.035)",
    button: "rgba(255, 255, 255, 0.04)",
    buttonHover: "rgba(255, 255, 255, 0.08)",
    overlay: "rgba(3, 3, 12, 0.85)",
  },
  border: {
    subtle: "rgba(255, 255, 255, 0.06)",
    medium: "rgba(255, 255, 255, 0.10)",
    accent: "rgba(0, 240, 240, 0.15)",
    win: "rgba(0, 240, 140, 0.25)",
    loss: "rgba(255, 60, 80, 0.25)",
  },
  text: {
    primary: "#ffffffdd",
    secondary: "#ffffff77",
    tertiary: "#ffffff33",
    dim: "#ffffff18",
  },
  accent: {
    cyan: "#00f0f0",
    purple: "#b040f0",
    green: "#00f08c",
    red: "#ff3c50",
    orange: "#f0a020",
    yellow: "#f0e000",
    pink: "#ff2080",
    blue: "#4080ff",
  },
  // Typography
  font: {
    display: "'Orbitron', sans-serif",
    body: "'Orbitron', sans-serif",
    chinese: "'Noto Sans SC', sans-serif",
    mono: "'JetBrains Mono', 'Courier New', monospace",
  },
  // Spacing
  radius: {
    sm: 4,
    md: 8,
    lg: 12,
    xl: 16,
  },
  // Effects
  glow: (color, intensity = 1) => `0 0 ${12 * intensity}px ${color}44, 0 0 ${30 * intensity}px ${color}18`,
  panelGlow: "0 0 40px rgba(0, 240, 240, 0.03), inset 0 0 40px rgba(0, 240, 240, 0.02)",
};

// ============================================================
// COMPONENT: Panel (modal / dialog wrapper)
// ============================================================
function Panel({ title, onClose, children, width = 480 }) {
  return (
    <div style={{
      width,
      maxWidth: "95vw",
      background: T.bg.panel,
      backdropFilter: "blur(20px)",
      borderRadius: T.radius.xl,
      border: `1px solid ${T.border.accent}`,
      boxShadow: T.panelGlow,
      overflow: "hidden",
    }}>
      {/* Header */}
      <div style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        padding: "16px 20px 12px",
      }}>
        <div style={{
          fontSize: 14,
          fontWeight: 700,
          fontFamily: T.font.display,
          color: T.accent.cyan,
          letterSpacing: 4,
          textShadow: `0 0 20px ${T.accent.cyan}44`,
        }}>{title}</div>
        {onClose && (
          <button onClick={onClose} style={{
            background: T.bg.button,
            border: `1px solid ${T.border.subtle}`,
            borderRadius: T.radius.sm,
            color: T.text.secondary,
            width: 32,
            height: 32,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 14,
            fontFamily: "system-ui",
          }}>✕</button>
        )}
      </div>

      {/* Separator */}
      <div style={{
        height: 1,
        background: `linear-gradient(90deg, transparent, ${T.accent.cyan}22, transparent)`,
      }} />

      {/* Content */}
      <div style={{ padding: "16px 20px 20px" }}>
        {children}
      </div>
    </div>
  );
}

// ============================================================
// COMPONENT: Tabs
// ============================================================
function Tabs({ tabs, active, onChange }) {
  return (
    <div style={{
      display: "flex",
      gap: 0,
      marginBottom: 16,
      borderBottom: `1px solid ${T.border.subtle}`,
    }}>
      {tabs.map((tab) => (
        <button key={tab} onClick={() => onChange(tab)} style={{
          flex: 1,
          padding: "10px 0",
          background: active === tab ? "rgba(0, 240, 240, 0.06)" : "transparent",
          border: "none",
          borderBottom: active === tab ? `2px solid ${T.accent.cyan}` : "2px solid transparent",
          color: active === tab ? T.accent.cyan : T.text.secondary,
          fontFamily: T.font.body,
          fontSize: 10,
          fontWeight: 600,
          letterSpacing: 2,
          cursor: "pointer",
          transition: "all 0.2s",
        }}>{tab}</button>
      ))}
    </div>
  );
}

// ============================================================
// COMPONENT: Input
// ============================================================
function Input({ placeholder, button }) {
  return (
    <div style={{ display: "flex", gap: 8 }}>
      <input
        placeholder={placeholder}
        style={{
          flex: 1,
          background: T.bg.input,
          border: `1px solid ${T.border.subtle}`,
          borderRadius: T.radius.md,
          padding: "10px 14px",
          color: T.text.primary,
          fontFamily: T.font.mono,
          fontSize: 12,
          outline: "none",
        }}
      />
      {button && (
        <button style={{
          background: T.bg.button,
          border: `1px solid ${T.accent.cyan}33`,
          borderRadius: T.radius.md,
          color: T.accent.cyan,
          fontFamily: T.font.display,
          fontSize: 10,
          fontWeight: 700,
          padding: "0 18px",
          cursor: "pointer",
          letterSpacing: 2,
        }}>{button}</button>
      )}
    </div>
  );
}

// ============================================================
// COMPONENT: Label
// ============================================================
function Label({ children }) {
  return (
    <div style={{
      fontSize: 9,
      color: T.text.tertiary,
      fontFamily: T.font.body,
      letterSpacing: 3,
      marginBottom: 6,
      textTransform: "uppercase",
    }}>{children}</div>
  );
}

// ============================================================
// COMPONENT: Stat Badge (for profile stats)
// ============================================================
function StatBadge({ value, label, color = T.accent.cyan }) {
  return (
    <div style={{
      textAlign: "center",
      flex: 1,
    }}>
      <div style={{
        fontSize: 22,
        fontWeight: 900,
        fontFamily: T.font.display,
        color,
        textShadow: `0 0 14px ${color}44`,
        lineHeight: 1,
      }}>{value}</div>
      <div style={{
        fontSize: 8,
        color: T.text.tertiary,
        letterSpacing: 2,
        marginTop: 6,
        fontFamily: T.font.body,
      }}>{label}</div>
    </div>
  );
}

// ============================================================
// COMPONENT: Match Row
// ============================================================
function MatchRow({ result, opponent, date, coins }) {
  const isWin = result === "WIN";
  return (
    <div style={{
      display: "flex",
      alignItems: "center",
      padding: "10px 14px",
      background: T.bg.card,
      borderRadius: T.radius.md,
      borderLeft: `3px solid ${isWin ? T.accent.green : T.accent.red}55`,
      marginBottom: 6,
    }}>
      <div style={{ flex: 1 }}>
        <div style={{
          fontSize: 11,
          fontWeight: 700,
          fontFamily: T.font.display,
          color: isWin ? T.accent.green : T.accent.red,
          letterSpacing: 2,
        }}>{result}</div>
        <div style={{
          fontSize: 10,
          color: T.text.secondary,
          fontFamily: T.font.mono,
          marginTop: 2,
        }}>vs {opponent}</div>
      </div>
      <div style={{ textAlign: "right" }}>
        <div style={{
          fontSize: 12,
          fontWeight: 700,
          color: T.accent.yellow,
          fontFamily: T.font.mono,
        }}>+{coins}</div>
        <div style={{
          fontSize: 8,
          color: T.text.tertiary,
          marginTop: 2,
        }}>{date}</div>
      </div>
    </div>
  );
}

// ============================================================
// COMPONENT: Ability Card
// ============================================================
function AbilityCard({ char, name, cost, description, equipped }) {
  return (
    <div style={{
      background: equipped ? "rgba(0, 240, 240, 0.04)" : T.bg.card,
      border: `1px solid ${equipped ? T.accent.cyan + "33" : T.border.subtle}`,
      borderRadius: T.radius.md,
      padding: 14,
      display: "flex",
      flexDirection: "column",
      gap: 8,
      transition: "all 0.2s",
    }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{
          fontSize: 22,
          fontFamily: T.font.chinese,
          color: equipped ? T.accent.cyan : T.text.primary,
          textShadow: equipped ? `0 0 12px ${T.accent.cyan}66` : "none",
          lineHeight: 1,
          width: 28,
          textAlign: "center",
        }}>{char}</div>
        <div style={{ flex: 1 }}>
          <div style={{
            fontSize: 11,
            fontWeight: 700,
            fontFamily: T.font.display,
            color: T.text.primary,
            letterSpacing: 1,
          }}>{name}</div>
        </div>
        <div style={{
          fontSize: 10,
          fontFamily: T.font.mono,
          color: T.accent.purple,
        }}>★{cost}</div>
      </div>

      {/* Description */}
      <div style={{
        fontSize: 10,
        color: T.text.secondary,
        lineHeight: 1.5,
        fontFamily: "system-ui, sans-serif",
      }}>{description}</div>

      {/* Equip button */}
      <button style={{
        background: equipped ? "rgba(0, 240, 240, 0.08)" : T.bg.button,
        border: `1px solid ${equipped ? T.accent.cyan + "44" : T.border.subtle}`,
        borderRadius: T.radius.sm,
        padding: "7px 0",
        color: equipped ? T.accent.cyan : T.text.secondary,
        fontFamily: T.font.display,
        fontSize: 9,
        fontWeight: 700,
        letterSpacing: 2,
        cursor: "pointer",
        transition: "all 0.2s",
      }}>{equipped ? "EQUIPPED" : "EQUIP"}</button>
    </div>
  );
}

// ============================================================
// COMPONENT: Primary Button
// ============================================================
function PrimaryButton({ children, color = T.accent.cyan }) {
  return (
    <button style={{
      width: "100%",
      padding: "12px 0",
      background: T.bg.button,
      border: `1px solid ${color}33`,
      borderRadius: T.radius.md,
      color,
      fontFamily: T.font.display,
      fontSize: 12,
      fontWeight: 700,
      letterSpacing: 3,
      cursor: "pointer",
      textShadow: `0 0 10px ${color}44`,
      transition: "all 0.2s",
    }}>{children}</button>
  );
}

// ============================================================
// COMPONENT: Victory / Defeat Screen
// ============================================================
function ResultScreen({ victory = true }) {
  const color = victory ? T.accent.green : T.accent.red;
  const title = victory ? "VICTORY" : "DEFEAT";
  return (
    <div style={{
      textAlign: "center",
      padding: "8px 0",
    }}>
      {/* Title */}
      <div style={{
        fontSize: 32,
        fontWeight: 900,
        fontFamily: T.font.display,
        color,
        textShadow: `0 0 30px ${color}66, 0 0 60px ${color}22`,
        letterSpacing: 6,
        marginBottom: 24,
      }}>{title}</div>

      {/* Stats */}
      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 20 }}>
        {[
          { label: "Score", value: "4,280" },
          { label: "Lines Cleared", value: "12" },
          { label: "Stars Earned", value: "190", color: T.accent.purple },
        ].map((s) => (
          <div key={s.label} style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            padding: "10px 16px",
            background: T.bg.card,
            borderRadius: T.radius.md,
          }}>
            <span style={{
              fontSize: 11,
              color: T.text.secondary,
              fontFamily: T.font.body,
              letterSpacing: 1,
            }}>{s.label}</span>
            <span style={{
              fontSize: 14,
              fontWeight: 700,
              color: s.color || T.text.primary,
              fontFamily: T.font.mono,
              textShadow: s.color ? `0 0 8px ${s.color}44` : "none",
            }}>{s.value}</span>
          </div>
        ))}
      </div>

      {/* Rewards section */}
      <div style={{
        background: "rgba(0, 240, 140, 0.04)",
        border: `1px solid ${T.accent.green}18`,
        borderRadius: T.radius.md,
        padding: 14,
        marginBottom: 20,
      }}>
        <div style={{
          fontSize: 9,
          fontWeight: 700,
          color: T.accent.green,
          letterSpacing: 3,
          marginBottom: 10,
          fontFamily: T.font.display,
        }}>REWARDS</div>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
          <span style={{ fontSize: 11, color: T.text.secondary }}>Coins Earned</span>
          <span style={{ fontSize: 12, fontWeight: 700, color: T.accent.yellow, fontFamily: T.font.mono }}>+100</span>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <span style={{ fontSize: 11, color: T.text.secondary }}>Total Balance</span>
          <span style={{ fontSize: 12, fontWeight: 700, color: T.accent.yellow, fontFamily: T.font.mono }}>184,140</span>
        </div>
      </div>

      <PrimaryButton color={T.accent.cyan}>CONTINUE</PrimaryButton>
    </div>
  );
}

// ============================================================
// COMPONENT: Coins Display (header badge)
// ============================================================
function CoinsBadge({ amount }) {
  return (
    <div style={{
      display: "flex",
      alignItems: "center",
      gap: 6,
      padding: "5px 12px",
      background: "rgba(240, 224, 0, 0.06)",
      border: `1px solid ${T.accent.yellow}22`,
      borderRadius: 20,
    }}>
      <span style={{
        fontSize: 11,
        fontWeight: 700,
        color: T.accent.yellow,
        fontFamily: T.font.mono,
        textShadow: `0 0 8px ${T.accent.yellow}33`,
      }}>{amount.toLocaleString()}</span>
      <span style={{ fontSize: 8, color: T.accent.yellow + "88" }}>✦</span>
    </div>
  );
}

// ============================================================
// SHOWCASE: All screens using the design system
// ============================================================
export default function DesignSystem() {
  const [view, setView] = useState("all");
  const [friendTab, setFriendTab] = useState("FRIENDS");
  const [abilityEquipped, setAbilityEquipped] = useState([0, 3]);

  const abilities = [
    { char: "震", name: "Earthquake", cost: 40, desc: "Shift opponent's rows 1 cell left or right randomly" },
    { char: "揺", name: "Screen Shake", cost: 40, desc: "Shake opponent's screen for 5 seconds" },
    { char: "墨", name: "Ink Splash", cost: 35, desc: "Splatter 5 opaque ink blobs on opponent's board for 4 seconds" },
    { char: "縮", name: "Mini Blocks", cost: 35, desc: "Your next 5 pieces become 2-cell dominoes" },
    { char: "満", name: "Fill Holes", cost: 75, desc: "Fill up to 4 enclosed empty cells on your board" },
    { char: "消", name: "Clear Rows", cost: 100, desc: "Instantly clear your bottom 4 rows" },
    { char: "雨", name: "Garbage Rain", cost: 55, desc: "Add 2 garbage rows to opponent's board" },
    { char: "速", name: "Speed Up", cost: 60, desc: "Opponent's pieces fall 2.5x faster for 8 seconds" },
    { char: "盾", name: "Shield", cost: 80, desc: "Block the next enemy ability. Lasts 15 seconds" },
  ];

  return (
    <div style={{
      minHeight: "100vh",
      background: T.bg.deep,
      fontFamily: T.font.body,
      padding: "20px",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      gap: 20,
    }}>
      <link href="https://fonts.googleapis.com/css2?family=Orbitron:wght@400;700;900&family=Noto+Sans+SC:wght@400;700&family=JetBrains+Mono:wght@400;700&display=swap" rel="stylesheet" />

      {/* Nav */}
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", justifyContent: "center" }}>
        {["all", "tokens", "friends", "profile", "abilities", "victory", "defeat"].map((v) => (
          <button key={v} onClick={() => setView(v)} style={{
            background: view === v ? T.bg.cardHover : T.bg.button,
            border: `1px solid ${view === v ? T.accent.cyan + "33" : T.border.subtle}`,
            borderRadius: 6,
            padding: "6px 14px",
            color: view === v ? T.accent.cyan : T.text.secondary,
            fontFamily: T.font.display,
            fontSize: 9,
            fontWeight: 600,
            letterSpacing: 2,
            cursor: "pointer",
            textTransform: "uppercase",
          }}>{v}</button>
        ))}
      </div>

      {/* ---- TOKENS REFERENCE ---- */}
      {(view === "all" || view === "tokens") && (
        <div style={{ width: "100%", maxWidth: 600 }}>
          <SectionTitle>Design Tokens</SectionTitle>

          {/* Colors */}
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
            {Object.entries(T.accent).map(([name, color]) => (
              <div key={name} style={{ textAlign: "center" }}>
                <div style={{
                  width: 40, height: 40, borderRadius: 8,
                  background: color,
                  boxShadow: `0 0 12px ${color}44`,
                  marginBottom: 4,
                }} />
                <div style={{ fontSize: 7, color: T.text.tertiary, letterSpacing: 1 }}>{name.toUpperCase()}</div>
              </div>
            ))}
          </div>

          {/* Typography */}
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 16 }}>
            <div style={{ fontSize: 28, fontWeight: 900, fontFamily: T.font.display, color: T.text.primary }}>Display 900</div>
            <div style={{ fontSize: 18, fontWeight: 700, fontFamily: T.font.display, color: T.text.primary }}>Heading 700</div>
            <div style={{ fontSize: 12, fontWeight: 600, fontFamily: T.font.display, color: T.text.secondary, letterSpacing: 2 }}>LABEL 600</div>
            <div style={{ fontSize: 12, fontFamily: T.font.mono, color: T.text.secondary }}>Mono — numbers, data, code</div>
            <div style={{ fontSize: 22, fontFamily: T.font.chinese, color: T.text.primary }}>震 揺 墨 縮 満 消 — skill icons</div>
          </div>

          {/* Surfaces */}
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
            {[
              { name: "card", bg: T.bg.card },
              { name: "card hover", bg: T.bg.cardHover },
              { name: "input", bg: T.bg.input },
              { name: "button", bg: T.bg.button },
            ].map((s) => (
              <div key={s.name} style={{
                background: s.bg,
                border: `1px solid ${T.border.subtle}`,
                borderRadius: T.radius.md,
                padding: "14px 18px",
                fontSize: 9,
                color: T.text.secondary,
                letterSpacing: 1,
              }}>{s.name}</div>
            ))}
          </div>

          {/* Component primitives */}
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <Input placeholder="Input field..." button="SEND" />
            <div style={{ display: "flex", gap: 8 }}>
              <PrimaryButton color={T.accent.cyan}>PRIMARY</PrimaryButton>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <PrimaryButton color={T.accent.green}>WIN STATE</PrimaryButton>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <PrimaryButton color={T.accent.red}>DANGER</PrimaryButton>
            </div>
            <CoinsBadge amount={184040} />
          </div>
        </div>
      )}

      {/* ---- FRIENDS SCREEN ---- */}
      {(view === "all" || view === "friends") && (
        <Panel title="FRIENDS" onClose={() => {}}>
          <Tabs
            tabs={["FRIENDS", "REQUESTS", "ADD FRIEND"]}
            active={friendTab}
            onChange={setFriendTab}
          />
          {friendTab === "ADD FRIEND" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div>
                <Label>Add by username</Label>
                <Input placeholder="Enter username..." button="SEND" />
              </div>
              <div>
                <Label>Search players</Label>
                <Input placeholder="Search by username..." />
              </div>
            </div>
          )}
          {friendTab === "FRIENDS" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {["cyberstacker", "blockmaster", "tetrix_pro"].map((name) => (
                <div key={name} style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "10px 14px",
                  background: T.bg.card,
                  borderRadius: T.radius.md,
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <div style={{
                      width: 6, height: 6, borderRadius: "50%",
                      background: T.accent.green,
                      boxShadow: `0 0 6px ${T.accent.green}88`,
                    }} />
                    <span style={{ fontSize: 11, color: T.text.primary, fontFamily: T.font.mono }}>{name}</span>
                  </div>
                  <button style={{
                    background: T.bg.button,
                    border: `1px solid ${T.accent.cyan}33`,
                    borderRadius: T.radius.sm,
                    color: T.accent.cyan,
                    fontFamily: T.font.display,
                    fontSize: 8,
                    fontWeight: 700,
                    padding: "5px 12px",
                    cursor: "pointer",
                    letterSpacing: 2,
                  }}>CHALLENGE</button>
                </div>
              ))}
            </div>
          )}
          {friendTab === "REQUESTS" && (
            <div style={{ fontSize: 11, color: T.text.tertiary, textAlign: "center", padding: 20 }}>
              No pending requests
            </div>
          )}
        </Panel>
      )}

      {/* ---- PROFILE SCREEN ---- */}
      {(view === "all" || view === "profile") && (
        <Panel title="laptop" onClose={() => {}}>
          {/* Stats row - no boxes, just numbers */}
          <div style={{
            display: "flex",
            gap: 4,
            marginBottom: 20,
            padding: "8px 0",
          }}>
            <StatBadge value="184k" label="COINS" color={T.accent.yellow} />
            <StatBadge value="10" label="GAMES" color={T.accent.cyan} />
            <StatBadge value="5-5" label="W/L" color={T.accent.green} />
            <StatBadge value="1" label="STREAK" color={T.accent.pink} />
            <StatBadge value="50%" label="WIN RATE" color={T.accent.purple} />
          </div>

          {/* Section label */}
          <div style={{
            fontSize: 10,
            fontWeight: 700,
            color: T.accent.cyan,
            letterSpacing: 3,
            marginBottom: 10,
            fontFamily: T.font.display,
          }}>RECENT MATCHES</div>

          <MatchRow result="WIN" opponent="laptopss" date="2/19/2026" coins={100} />
          <MatchRow result="LOSS" opponent="laptopss" date="2/19/2026" coins={30} />
          <MatchRow result="WIN" opponent="safari" date="2/19/2026" coins={100} />
          <MatchRow result="WIN" opponent="Unknown" date="2/19/2026" coins={40} />
          <MatchRow result="LOSS" opponent="Unknown" date="2/19/2026" coins={10} />
        </Panel>
      )}

      {/* ---- ABILITIES SCREEN ---- */}
      {(view === "all" || view === "abilities") && (
        <Panel title="ABILITIES" onClose={() => {}}>
          <div style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 14,
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 10, color: T.text.secondary }}>Loadout (1/6):</span>
            </div>
            <CoinsBadge amount={184040} />
          </div>

          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, 1fr)",
            gap: 8,
          }}>
            {abilities.map((a, i) => (
              <AbilityCard
                key={a.char}
                char={a.char}
                name={a.name}
                cost={a.cost}
                description={a.desc}
                equipped={abilityEquipped.includes(i)}
              />
            ))}
          </div>
        </Panel>
      )}

      {/* ---- VICTORY SCREEN ---- */}
      {(view === "all" || view === "victory") && (
        <Panel title="">
          <ResultScreen victory={true} />
        </Panel>
      )}

      {/* ---- DEFEAT SCREEN ---- */}
      {(view === "all" || view === "defeat") && (
        <Panel title="">
          <ResultScreen victory={false} />
        </Panel>
      )}
    </div>
  );
}

function SectionTitle({ children }) {
  return (
    <div style={{
      fontSize: 10,
      fontWeight: 700,
      color: "#ffffff33",
      letterSpacing: 4,
      marginBottom: 12,
      paddingBottom: 6,
      borderBottom: "1px solid #ffffff0a",
      fontFamily: "'Orbitron', sans-serif",
    }}>{children}</div>
  );
}
