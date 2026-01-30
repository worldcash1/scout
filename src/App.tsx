import { useState, useEffect } from "react";
import "./App.css";

// Types
interface GmailAccount {
  type: "gmail";
  email: string;
  accessToken: string;
  color: string;
}

type ConnectedAccount = GmailAccount; // Will add Dropbox, Slack, etc.

interface SearchResult {
  id: string;
  source: "gmail" | "dropbox" | "slack" | "drive" | "whatsapp";
  sourceLabel: string;
  sourceColor: string;
  title: string;
  subtitle: string;
  snippet: string;
  date: string;
  url?: string;
  metadata?: Record<string, string>;
}

const SOURCE_CONFIG = {
  gmail: { label: "Gmail", icon: "📧", color: "#ea4335" },
  dropbox: { label: "Dropbox", icon: "📦", color: "#0061fe" },
  slack: { label: "Slack", icon: "💬", color: "#4a154b" },
  drive: { label: "Drive", icon: "📁", color: "#1a73e8" },
  whatsapp: { label: "WhatsApp", icon: "💚", color: "#25d366" },
};

const GMAIL_CLIENT_ID = "1063241264534-laueuqofg3pd192jt13uep2okkf7raq1.apps.googleusercontent.com";
const GMAIL_CLIENT_SECRET = "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";
const GMAIL_SCOPES = "https://www.googleapis.com/auth/gmail.readonly email";

function App() {
  const [accounts, setAccounts] = useState<ConnectedAccount[]>([]);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedResult, setSelectedResult] = useState<SearchResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeFilters, setActiveFilters] = useState<string[]>(["gmail", "dropbox", "slack", "drive", "whatsapp"]);

  // Load saved accounts
  useEffect(() => {
    const saved = localStorage.getItem("unified-search-accounts");
    if (saved) setAccounts(JSON.parse(saved));
  }, []);

  // Save accounts
  useEffect(() => {
    localStorage.setItem("unified-search-accounts", JSON.stringify(accounts));
  }, [accounts]);

  const getRedirectUri = () => {
    return window.location.origin + window.location.pathname;
  };

  const connectGmail = () => {
    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?` +
      `client_id=${GMAIL_CLIENT_ID}&` +
      `redirect_uri=${encodeURIComponent(getRedirectUri())}&` +
      `response_type=code&` +
      `scope=${encodeURIComponent(GMAIL_SCOPES)}&` +
      `access_type=offline&` +
      `prompt=select_account`;
    
    window.location.href = authUrl;
  };

  // Handle OAuth callback
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get("code");
    
    if (code) {
      // Clear URL
      window.history.replaceState({}, "", window.location.pathname);
      handleGmailCallback(code);
    }
  }, []);

  const handleGmailCallback = async (code: string) => {
    setLoading(true);
    setError(null);
    
    try {
      const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          client_id: GMAIL_CLIENT_ID,
          client_secret: GMAIL_CLIENT_SECRET,
          code,
          grant_type: "authorization_code",
          redirect_uri: getRedirectUri(),
        }),
      });

      const tokenData = await tokenRes.json();
      if (!tokenRes.ok) throw new Error(tokenData.error_description || "Auth failed");

      const userRes = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
        headers: { Authorization: `Bearer ${tokenData.access_token}` }
      });
      
      if (!userRes.ok) throw new Error("Failed to get user info");
      const user = await userRes.json();

      const colors = ["#ea4335", "#4285f4", "#fbbc05", "#34a853", "#ff6d01", "#46bdc6"];
      const newAccount: GmailAccount = {
        type: "gmail",
        email: user.email,
        accessToken: tokenData.access_token,
        color: colors[accounts.filter(a => a.type === "gmail").length % colors.length]
      };

      setAccounts(prev => {
        const existing = prev.findIndex(a => a.type === "gmail" && a.email === user.email);
        if (existing >= 0) {
          const updated = [...prev];
          updated[existing] = newAccount;
          return updated;
        }
        return [...prev, newAccount];
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to connect");
    } finally {
      setLoading(false);
    }
  };

  const removeAccount = (account: ConnectedAccount) => {
    setAccounts(prev => prev.filter(a => !(a.type === account.type && a.email === account.email)));
  };

  const search = async () => {
    if (!query.trim()) return;
    
    setLoading(true);
    setResults([]);
    setSelectedResult(null);
    
    const allResults: SearchResult[] = [];

    // Search Gmail accounts
    if (activeFilters.includes("gmail")) {
      const gmailAccounts = accounts.filter(a => a.type === "gmail") as GmailAccount[];
      
      await Promise.all(gmailAccounts.map(async (account) => {
        try {
          const searchRes = await fetch(
            `https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${encodeURIComponent(query)}&maxResults=20`,
            { headers: { Authorization: `Bearer ${account.accessToken}` } }
          );

          if (!searchRes.ok) return;
          const searchData = await searchRes.json();
          const messages = searchData.messages || [];

          await Promise.all(messages.slice(0, 10).map(async (msg: { id: string }) => {
            const detailRes = await fetch(
              `https://gmail.googleapis.com/gmail/v1/users/me/messages/${msg.id}?format=metadata&metadataHeaders=From&metadataHeaders=Subject&metadataHeaders=Date`,
              { headers: { Authorization: `Bearer ${account.accessToken}` } }
            );
            
            if (detailRes.ok) {
              const detail = await detailRes.json();
              const headers = detail.payload?.headers || [];
              const getHeader = (name: string) => 
                headers.find((h: {name: string, value: string}) => h.name.toLowerCase() === name.toLowerCase())?.value || "";

              const from = getHeader("From");
              const fromName = from.match(/^([^<]+)/)?.[1]?.trim().replace(/"/g, "") || from;

              allResults.push({
                id: `gmail-${account.email}-${detail.id}`,
                source: "gmail",
                sourceLabel: account.email,
                sourceColor: account.color,
                title: getHeader("Subject") || "(No subject)",
                subtitle: fromName,
                snippet: detail.snippet || "",
                date: getHeader("Date"),
                url: `https://mail.google.com/mail/u/?authuser=${account.email}#inbox/${detail.threadId}`,
                metadata: { account: account.email }
              });
            }
          }));
        } catch (e) {
          console.error(`Gmail search error for ${account.email}:`, e);
        }
      }));
    }

    // Sort by date
    allResults.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    setResults(allResults);
    setLoading(false);
  };

  const formatDate = (dateStr: string) => {
    try {
      const date = new Date(dateStr);
      const now = new Date();
      const diff = now.getTime() - date.getTime();
      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      
      if (days === 0) return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
      if (days === 1) return "Yesterday";
      if (days < 7) return date.toLocaleDateString([], { weekday: "short" });
      return date.toLocaleDateString([], { month: "short", day: "numeric" });
    } catch {
      return "";
    }
  };

  const toggleFilter = (source: string) => {
    setActiveFilters(prev => 
      prev.includes(source) 
        ? prev.filter(f => f !== source)
        : [...prev, source]
    );
  };

  const gmailCount = accounts.filter(a => a.type === "gmail").length;

  return (
    <div className="app">
      {/* Sidebar */}
      <aside className="sidebar">
        <div className="sidebar-header">
          <div className="logo">
            <span className="logo-icon">🐕</span>
            <span className="logo-text">Scout</span>
          </div>
        </div>

        <div className="sidebar-section">
          <div className="sidebar-label">Connected Sources</div>
          
          {/* Gmail */}
          <div className="source-group">
            <div className="source-header">
              <span>{SOURCE_CONFIG.gmail.icon} Gmail</span>
              <span className="source-count">{gmailCount}</span>
            </div>
            {accounts.filter(a => a.type === "gmail").map((account) => (
              <div key={account.email} className="source-item">
                <div className="source-dot" style={{ backgroundColor: account.color }} />
                <span className="source-email">{account.email}</span>
                <button className="source-remove" onClick={() => removeAccount(account)}>×</button>
              </div>
            ))}
            <button className="add-source-btn" onClick={connectGmail}>
              + Add Gmail
            </button>
          </div>

          {/* Coming Soon */}
          <div className="source-group coming-soon">
            <div className="source-header">
              <span>{SOURCE_CONFIG.dropbox.icon} Dropbox</span>
              <span className="badge">Soon</span>
            </div>
          </div>
          
          <div className="source-group coming-soon">
            <div className="source-header">
              <span>{SOURCE_CONFIG.slack.icon} Slack</span>
              <span className="badge">Soon</span>
            </div>
          </div>
          
          <div className="source-group coming-soon">
            <div className="source-header">
              <span>{SOURCE_CONFIG.drive.icon} Google Drive</span>
              <span className="badge">Soon</span>
            </div>
          </div>
          
          <div className="source-group coming-soon">
            <div className="source-header">
              <span>{SOURCE_CONFIG.whatsapp.icon} WhatsApp</span>
              <span className="badge">Soon</span>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="main">
        {/* Search Header */}
        <header className="search-header">
          <div className="search-box">
            <span className="search-icon">🔍</span>
            <input
              type="text"
              placeholder="Search across all your accounts..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && search()}
            />
            {query && (
              <button className="search-clear" onClick={() => setQuery("")}>×</button>
            )}
          </div>
          <button className="search-btn" onClick={search} disabled={loading || accounts.length === 0}>
            {loading ? "Searching..." : "Search"}
          </button>
        </header>

        {/* Filter Bar */}
        <div className="filter-bar">
          <span className="filter-label">Filter:</span>
          {Object.entries(SOURCE_CONFIG).map(([key, config]) => (
            <button
              key={key}
              className={`filter-chip ${activeFilters.includes(key) ? "active" : ""}`}
              onClick={() => toggleFilter(key)}
              style={{ 
                borderColor: activeFilters.includes(key) ? config.color : undefined,
                backgroundColor: activeFilters.includes(key) ? `${config.color}15` : undefined
              }}
            >
              {config.icon} {config.label}
            </button>
          ))}
        </div>

        {/* Results */}
        <div className="results-container">
          {/* Results List */}
          <div className="results-list">
            {loading && (
              <div className="loading-state">
                <div className="spinner" />
                <span>Searching {accounts.length} account{accounts.length !== 1 ? "s" : ""}...</span>
              </div>
            )}

            {!loading && accounts.length === 0 && (
              <div className="empty-state">
                <div className="empty-icon">🔗</div>
                <h3>Connect your accounts</h3>
                <p>Add Gmail, Dropbox, Slack, and more to search across all your data.</p>
                <button className="primary-btn" onClick={connectGmail}>
                  {SOURCE_CONFIG.gmail.icon} Connect Gmail
                </button>
              </div>
            )}

            {!loading && accounts.length > 0 && results.length === 0 && query === "" && (
              <div className="empty-state">
                <div className="empty-icon">🔍</div>
                <h3>Ready to search</h3>
                <p>Search across {accounts.length} connected account{accounts.length !== 1 ? "s" : ""}.</p>
              </div>
            )}

            {!loading && results.length === 0 && query !== "" && (
              <div className="empty-state">
                <div className="empty-icon">📭</div>
                <h3>No results found</h3>
                <p>Try different keywords or check your filters.</p>
              </div>
            )}

            {results.length > 0 && (
              <>
                <div className="results-header">
                  <span>{results.length} results</span>
                </div>
                {results.map(result => (
                  <div
                    key={result.id}
                    className={`result-item ${selectedResult?.id === result.id ? "selected" : ""}`}
                    onClick={() => setSelectedResult(result)}
                  >
                    <div className="result-source">
                      <span 
                        className="source-badge"
                        style={{ backgroundColor: result.sourceColor }}
                      >
                        {SOURCE_CONFIG[result.source].icon} {result.sourceLabel.split("@")[0]}
                      </span>
                      <span className="result-date">{formatDate(result.date)}</span>
                    </div>
                    <div className="result-title">{result.title}</div>
                    <div className="result-subtitle">{result.subtitle}</div>
                    <div className="result-snippet">{result.snippet}</div>
                  </div>
                ))}
              </>
            )}
          </div>

          {/* Preview Panel */}
          <div className="preview-panel">
            {!selectedResult ? (
              <div className="preview-empty">
                <div className="preview-empty-icon">✉️</div>
                <p>Select an item to preview</p>
              </div>
            ) : (
              <div className="preview-content">
                <div className="preview-header">
                  <span 
                    className="source-badge large"
                    style={{ backgroundColor: selectedResult.sourceColor }}
                  >
                    {SOURCE_CONFIG[selectedResult.source].icon} {selectedResult.sourceLabel}
                  </span>
                </div>
                <h2 className="preview-title">{selectedResult.title}</h2>
                <div className="preview-meta">
                  <span className="preview-from">{selectedResult.subtitle}</span>
                  <span className="preview-date">{selectedResult.date}</span>
                </div>
                <div className="preview-body">
                  {selectedResult.snippet}
                </div>
                {selectedResult.url && (
                  <a 
                    href={selectedResult.url} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="preview-open-btn"
                  >
                    Open in {SOURCE_CONFIG[selectedResult.source].label} →
                  </a>
                )}
              </div>
            )}
          </div>
        </div>
      </main>

      {error && (
        <div className="toast error">
          {error}
          <button onClick={() => setError(null)}>×</button>
        </div>
      )}
    </div>
  );
}

export default App;
