import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { marked } from "marked";
import DOMPurify from "dompurify";

// This UI is inspired by `linkedin-chatbot.jsx`, but wired to your FastAPI backend:
// - POST /api/process-profile -> returns { session_id }
// - POST /api/chat -> returns { reply }

const DEFAULT_API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";


const SUGGESTIONS = [
  "Summarise their career in 3 bullets",
  "What are their strongest technical skills?",
  "Which companies has she worked at?",
  "What did they study and where?",
  "Is this person a good fit for a senior role?",
];

function now() {
  return new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}


function MessageBubble({ msg }) {
  const isUser = msg.role === "user";
  const renderedAssistantHtml = useMemo(() => {
    if (isUser) return "";
    const text = typeof msg.content === "string" ? msg.content : String(msg.content || "");
    const html = marked.parse(text, { gfm: true, breaks: true });
    return DOMPurify.sanitize(html);
  }, [isUser, msg.content]);

  return (
    <div
      style={{
        display: "flex",
        gap: 12,
        marginBottom: 20,
        flexDirection: isUser ? "row-reverse" : "row",
        alignItems: "flex-start",
      }}
    >
      {isUser ? (
        <div
          style={{
            width: 32,
            height: 32,
            borderRadius: "50%",
            background: "#1a2540",
            border: "1px solid #2a3a60",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          <span style={{ fontSize: 14 }}>👤</span>
        </div>
      ) : (
        <div
          style={{
            width: 32,
            height: 32,
            borderRadius: "50%",
            background: "linear-gradient(135deg, #0077b5, #00a0dc)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
            fontSize: 14,
          }}
        >
          🤖
        </div>
      )}

      <div
        style={{
          maxWidth: "70%",
          background: isUser ? "#0d1a35" : "#0a1628",
          border: `1px solid ${isUser ? "#1e3a6e" : "#1a2540"}`,
          borderRadius: isUser ? "16px 4px 16px 16px" : "4px 16px 16px 16px",
          padding: "12px 16px",
        }}
      >
        {msg.thinking && (
          <div
            style={{
              fontFamily: "'DM Mono', monospace",
              fontSize: 11,
              color: "#3a5a80",
              marginBottom: 8,
              display: "flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            <span
              style={{
                display: "inline-block",
                width: 6,
                height: 6,
                borderRadius: "50%",
                background: "#0077b5",
                animation: "pulse 1s infinite",
              }}
            />
            Analysing profile...
          </div>
        )}

        <div
          style={{
            fontFamily: "'DM Sans', sans-serif",
            fontSize: 14,
            color: isUser ? "#a0b0d0" : "#c8d0e0",
            lineHeight: 1.7,
            whiteSpace: "normal",
            wordBreak: "break-word",
          }}
        >
          {isUser ? (
            msg.content
          ) : (
            <div
              className="assistantMarkdown"
              // LLM output is rendered as Markdown; we sanitize HTML for safety.
              dangerouslySetInnerHTML={{ __html: renderedAssistantHtml }}
            />
          )}
        </div>

        <div
          style={{
            fontFamily: "'DM Mono', monospace",
            fontSize: 10,
            color: "#2a3a56",
            marginTop: 6,
            textAlign: isUser ? "right" : "left",
          }}
        >
          {msg.time}
        </div>
      </div>
    </div>
  );
}

function ConnectScreen({ apiBase, onConnect }) {
  const [linkedinUrl, setLinkedinUrl] = useState("");
  const [twitterUrl, setTwitterUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState(0);
  const [error, setError] = useState("");

  const steps = ["Starting...", "Scraping profile...", "Processing profile..."];

  const handleConnect = async () => {
    if (!linkedinUrl && !twitterUrl) return;

    setError("");
    setLoading(true);
    setStep(0);

    // Light progress animation (real backend call happens in parallel).
    for (let i = 0; i < steps.length - 1; i++) {
      setStep(i + 1);
      await new Promise((r) => setTimeout(r, 450));
    }

    // Long-running request (no timeout — backend may take time)
    let res;
    try {
      res = await fetch(`${apiBase}/api/process-profile`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          linkedin_url: linkedinUrl || null,
          twitter_url: twitterUrl || null,
        }),
      });
    } catch (err) {
      setError("Backend unreachable");
      setLoading(false);
      setStep(0);
      return;
    }

    const data = await res.json().catch(() => null);
    if (!res.ok) {
      setError(data?.detail || `HTTP ${res.status}`);
      setLoading(false);
      setStep(0);
      return;
    }

    setStep(steps.length - 1);
    setLoading(false);
    onConnect({ profile: {}, sessionId: data.session_id });
  };

  return (
    <div
      style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        background: "#060c1a",
        padding: 40,
      }}
    >
      <div style={{ marginBottom: 48, textAlign: "center" }}>
        <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 11, color: "#0077b5", letterSpacing: 4, marginBottom: 12 }}>
        AI-Powered Career Intelligence
        </div>
        <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 36, fontWeight: 700, color: "#e8eaf0", lineHeight: 1.1 }}>
        Don’t just view profiles<br />
          <span style={{ color: "#0077b5" }}>talk to them</span>
        </div>
        <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 15, color: "#4a5a7a", marginTop: 16, maxWidth: 420, lineHeight: 1.6 }}>
        Turn any professional’s digital footprint into a conversation powered by real data.
        </div>
      </div>

      <div style={{ background: "#0a0f1e", border: "1px solid #1a2540", borderRadius: 16, padding: 28, width: "100%", maxWidth: 620 }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div>
            <label style={{ fontFamily: "'DM Mono', monospace", fontSize: 11, color: "#3a5a80", letterSpacing: 2, display: "block", marginBottom: 10 }}>
              LINKEDIN URL
            </label>
            <input
              value={linkedinUrl}
              onChange={(e) => setLinkedinUrl(e.target.value)}
              placeholder="https://www.linkedin.com/in/kunal-kushwaha/"
              style={{
                width: "100%",
                background: "#060c1a",
                border: "1px solid #1a2540",
                borderRadius: 8,
                padding: "12px 16px",
                fontFamily: "'DM Mono', monospace",
                fontSize: 13,
                color: "#c8d0e0",
                outline: "none",
              }}
              disabled={loading}
            />
          </div>

          <div>
            <label style={{ fontFamily: "'DM Mono', monospace", fontSize: 11, color: "#3a5a80", letterSpacing: 2, display: "block", marginBottom: 10 }}>
              X / TWITTER URL (optional)
            </label>
            <input
              value={twitterUrl}
              onChange={(e) => setTwitterUrl(e.target.value)}
              placeholder="https://x.com/kunalstwt"
              style={{
                width: "100%",
                background: "#060c1a",
                border: "1px solid #1a2540",
                borderRadius: 8,
                padding: "12px 16px",
                fontFamily: "'DM Mono', monospace",
                fontSize: 13,
                color: "#c8d0e0",
                outline: "none",
              }}
              disabled={loading}
            />
          </div>
        </div>

        <div style={{ marginTop: 16, display: "flex", gap: 10, alignItems: "center" }}>
          {!loading ? (
            <>
              <button
                onClick={handleConnect}
                disabled={!linkedinUrl && !twitterUrl}
                style={{
                  background: "#0077b5",
                  color: "#fff",
                  border: "none",
                  borderRadius: 10,
                  padding: "12px 18px",
                  fontFamily: "'DM Sans', sans-serif",
                  fontWeight: 600,
                  fontSize: 14,
                  cursor: !linkedinUrl && !twitterUrl ? "not-allowed" : "pointer",
                }}
              >
                Start Chatting →
              </button>
              
            </>
          ) : (
            <div style={{ width: "100%" }}>
              {steps.map((s, i) => (
                <div
                  key={i}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    padding: "10px 0",
                    opacity: i <= step ? 1 : 0.2,
                    transition: "opacity 0.4s",
                  }}
                >
                  <div
                    style={{
                      width: 20,
                      height: 20,
                      borderRadius: "50%",
                      background: i < step ? "#0077b5" : i === step ? "#0d3a5a" : "#0d1629",
                      border: `1px solid ${i <= step ? "#0077b5" : "#1a2540"}`,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 10,
                      color: "#fff",
                      transition: "all 0.4s",
                    }}
                  >
                    {i < step ? "✓" : ""}
                  </div>
                  <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 12, color: i <= step ? "#7aa2f7" : "#2a3a60" }}>
                    {s}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {error ? (
          <div
            style={{
              marginTop: 12,
              padding: "10px 12px",
              borderRadius: 10,
              border: "1px solid rgba(255, 106, 106, 0.35)",
              background: "rgba(255, 106, 106, 0.12)",
              color: "rgba(255, 180, 180, 0.95)",
              fontFamily: "'DM Mono', monospace",
              fontSize: 12,
              whiteSpace: "pre-wrap",
            }}
          >
            Error: {error}
          </div>
        ) : null}
      </div>
    </div>
  );
}

export default function App() {
  const apiBase = import.meta.env.VITE_API_BASE_URL || DEFAULT_API_BASE;
  const [profile, setProfile] = useState(null);
  const [sessionId, setSessionId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  const bottomRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleConnect = useCallback(({ profile: p, sessionId: sid }) => {
    setProfile(p);
    setSessionId(sid);
    setMessages([
      {
        role: "assistant",
        content: `Profile loaded! Ask me anything about their career, skills, and education.`,
        time: now(),
      },
    ]);
  }, []);

  const askBackend = useCallback(
    async (question) => {
      if (!sessionId) throw new Error("Missing session_id. Connect first.");

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 15000);

      let res;
      try {
        res = await fetch(`${apiBase}/api/chat`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            session_id: sessionId,
            message: question,
          }),
          signal: controller.signal,
        });
      } catch (err) {
        clearTimeout(timeout);
        throw new Error("Backend unreachable or request timed out");
      }
      clearTimeout(timeout);

      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.detail || `HTTP ${res.status}`);

      return data?.reply || "";
    },
    [apiBase, sessionId]
  );

  const send = useCallback(
    async (text) => {
      const q = (text || input).trim();
      if (!q || loading) return;

      setInput("");
      const userMsg = { role: "user", content: q, time: now() };
      const thinkingMsg = { role: "assistant", content: "", thinking: true, time: now() };

      setMessages((prev) => [...prev, userMsg, thinkingMsg]);
      setLoading(true);

      try {
        const reply = await askBackend(q);
        setMessages((prev) => [...prev.slice(0, -1), { role: "assistant", content: reply, time: now() }]);
      } catch (e) {
        const msg = e && e.message ? e.message : String(e);
        setMessages((prev) => [...prev.slice(0, -1), { role: "assistant", content: `⚠ ${msg}`, time: now() }]);
      }

      setLoading(false);
      inputRef.current?.focus();
    },
    [askBackend, input, loading]
  );

  const suggestions = useMemo(() => SUGGESTIONS, []);

  return (
    <div
      style={{
        height: "100vh",
        display: "flex",
        flexDirection: "column",
        background: "#060c1a",
        fontFamily: "'DM Sans', sans-serif",
      }}
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=DM+Mono:wght@400;500&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: #060c1a; }
        ::-webkit-scrollbar-thumb { background: #1a2540; border-radius: 2px; }
        input::placeholder { color: #2a3a60; }
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.3} }
        /* Rendered LLM markdown styling */
        .assistantMarkdown table { width: 100%; border-collapse: collapse; margin: 10px 0; }
        .assistantMarkdown th, .assistantMarkdown td { border: 1px solid rgba(232, 238, 252, 0.14); padding: 6px 8px; vertical-align: top; }
        .assistantMarkdown th { background: rgba(255,255,255,0.04); color: #e8eefc; font-weight: 700; }
        .assistantMarkdown ul { padding-left: 18px; }
        .assistantMarkdown li { margin: 4px 0; }
        .assistantMarkdown code { background: rgba(255,255,255,0.04); border: 1px solid rgba(232, 238, 252, 0.14); padding: 2px 6px; border-radius: 6px; font-family: 'DM Mono', monospace; font-size: 0.95em; }
        .assistantMarkdown pre { background: rgba(255,255,255,0.03); border: 1px solid rgba(232, 238, 252, 0.14); padding: 12px; overflow: auto; border-radius: 12px; }
        .assistantMarkdown pre code { background: transparent; border: none; padding: 0; }
      `}</style>

      <div
        style={{
          height: 52,
          borderBottom: "1px solid #0d1629",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 18px",
          background: "#060c1a",
          flexShrink: 0,
          gap: 12,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div
            style={{
              width: 28,
              height: 28,
              borderRadius: 6,
              background: "#0077b5",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 14,
            }}
          >
            💼
          </div>
          <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 13, color: "#4a6a9a", letterSpacing: 1 }}>
            Digital<span style={{ color: "#0077b5" }}>Persona</span>
          </span>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>

          {profile && (
            <button
              onClick={() => {
                setProfile(null);
                setSessionId(null);
                setMessages([]);
              }}
              style={{
                background: "transparent",
                border: "1px solid #1a2540",
                borderRadius: 6,
                color: "#4a5a7a",
                fontFamily: "'DM Mono', monospace",
                fontSize: 11,
                padding: "6px 10px",
                cursor: "pointer",
                whiteSpace: "nowrap",
              }}
            >
              New profile
            </button>
          )}
        </div>
      </div>

      <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
        {!profile ? (
          <ConnectScreen apiBase={apiBase} onConnect={handleConnect} />
        ) : (
          <>
            

            <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
              <div style={{ flex: 1, overflowY: "auto", padding: "28px 32px" }}>
                {messages.map((m, i) => (
                  <MessageBubble key={i} msg={m} />
                ))}
                <div ref={bottomRef} />
              </div>

              {messages.length <= 1 && (
                <div style={{ padding: "0 32px 16px", display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {suggestions.map((s, i) => (
                    <button
                      key={i}
                      onClick={() => send(s)}
                      disabled={loading}
                      style={{
                        background: "#0a0f1e",
                        border: "1px solid #1a2540",
                        borderRadius: 20,
                        padding: "7px 14px",
                        fontFamily: "'DM Sans', sans-serif",
                        fontSize: 12,
                        color: "#6a82aa",
                        cursor: loading ? "not-allowed" : "pointer",
                        transition: "all 0.15s",
                      }}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              )}

              <div
                style={{
                  borderTop: "1px solid #0d1629",
                  padding: "16px 32px",
                  display: "flex",
                  gap: 12,
                  alignItems: "center",
                  background: "#060c1a",
                }}
              >
                <div
                  style={{
                    flex: 1,
                    display: "flex",
                    alignItems: "center",
                    background: "#0a0f1e",
                    border: "1px solid #1a2540",
                    borderRadius: 12,
                    padding: "10px 16px",
                    gap: 10,
                  }}
                >
                  <span style={{ fontSize: 16 }}>💬</span>
                  <input
                    ref={inputRef}
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && send()}
                    placeholder="Ask about their career..."
                    disabled={loading}
                    style={{
                      flex: 1,
                      background: "transparent",
                      border: "none",
                      outline: "none",
                      fontFamily: "'DM Sans', sans-serif",
                      fontSize: 14,
                      color: "#c8d0e0",
                    }}
                  />
                </div>
                <button
                  onClick={() => send()}
                  disabled={!input.trim() || loading}
                  style={{
                    background: input.trim() && !loading ? "#0077b5" : "#0d1629",
                    border: "none",
                    borderRadius: 10,
                    width: 44,
                    height: 44,
                    cursor: input.trim() && !loading ? "pointer" : "default",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 18,
                    transition: "background 0.2s",
                  }}
                >
                  {loading ? (
                    <span
                      style={{
                        width: 16,
                        height: 16,
                        border: "2px solid #0077b5",
                        borderTopColor: "transparent",
                        borderRadius: "50%",
                        display: "inline-block",
                        animation: "pulse 0.8s linear infinite",
                      }}
                    />
                  ) : (
                    "→"
                  )}
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

