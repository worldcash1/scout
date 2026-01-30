import { useState, useEffect } from "react";
import {
  Search,
  Mail,
  Box,
  MessageSquare,
  FolderOpen,
  MessageCircle,
  Plus,
  X,
  ExternalLink,
  Loader2,
  ChevronRight,
  Sun,
  Moon,
  Menu,
  ArrowLeft,
  Square,
  CheckSquare,
  Download,
  MessageCircleHeart,
} from "lucide-react";
import { IllustrationConnect, IllustrationSearch, IllustrationNoResults } from "./Illustrations";
import "./App.css";

// Types
interface GmailAccount {
  type: "gmail";
  email: string;
  accessToken: string;
  color: string;
}

type ConnectedAccount = GmailAccount;

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
  gmail: { label: "Gmail", icon: Mail, color: "#ea4335" },
  dropbox: { label: "Dropbox", icon: Box, color: "#0061fe" },
  slack: { label: "Slack", icon: MessageSquare, color: "#4a154b" },
  drive: { label: "Drive", icon: FolderOpen, color: "#1a73e8" },
  whatsapp: { label: "WhatsApp", icon: MessageCircle, color: "#25d366" },
};

const GMAIL_CLIENT_ID = "1063241264534-20soj16a1sv7u78212f4k3qn4khcbf05.apps.googleusercontent.com";
const GMAIL_CLIENT_SECRET = "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";
const GMAIL_SCOPES = "https://www.googleapis.com/auth/gmail.readonly email";

type Theme = "light" | "dark" | "system";

function App() {
  const [accounts, setAccounts] = useState<ConnectedAccount[]>([]);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedResult, setSelectedResult] = useState<SearchResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeFilters, setActiveFilters] = useState<string[]>(["gmail", "dropbox", "slack", "drive", "whatsapp"]);
  const [collapsedSources, setCollapsedSources] = useState<string[]>([]);
  const [theme, setTheme] = useState<Theme>(() => {
    const saved = localStorage.getItem("scout-theme");
    return (saved as Theme) || "system";
  });
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // Apply theme
  useEffect(() => {
    const root = document.documentElement;
    if (theme === "system") {
      root.removeAttribute("data-theme");
    } else {
      root.setAttribute("data-theme", theme);
    }
    localStorage.setItem("scout-theme", theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => {
      if (prev === "light") return "dark";
      if (prev === "dark") return "system";
      return "light";
    });
  };

  const getThemeIcon = () => {
    if (theme === "light") return <Sun size={18} />;
    if (theme === "dark") return <Moon size={18} />;
    // System - show based on actual preference
    return window.matchMedia("(prefers-color-scheme: dark)").matches 
      ? <Moon size={18} /> 
      : <Sun size={18} />;
  };

  useEffect(() => {
    const saved = localStorage.getItem("unified-search-accounts");
    if (saved) setAccounts(JSON.parse(saved));
  }, []);

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

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get("code");
    
    if (code) {
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

  // Bulk selection helpers
  const isSelected = (id: string) => selectedIds.includes(id);
  const isAllSelected = results.length > 0 && selectedIds.length === results.length;
  const isSelectionMode = selectedIds.length > 0;

  const toggleSelection = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (isSelected(id)) {
      setSelectedIds(selectedIds.filter(itemId => itemId !== id));
    } else {
      setSelectedIds([...selectedIds, id]);
    }
  };

  const toggleSelectAll = () => {
    if (isAllSelected) {
      setSelectedIds([]);
    } else {
      setSelectedIds(results.map(r => r.id));
    }
  };

  const clearSelection = () => setSelectedIds([]);

  const openSelectedResults = () => {
    results.filter(r => selectedIds.includes(r.id)).forEach(r => {
      if (r.url) window.open(r.url, '_blank');
    });
  };

  const toggleCollapse = (source: string) => {
    setCollapsedSources(prev => 
      prev.includes(source) 
        ? prev.filter(s => s !== source)
        : [...prev, source]
    );
  };

  // Skeleton loader component
  const ResultSkeleton = () => (
    <div className="result-skeleton">
      <div className="skeleton-header">
        <div className="skeleton skeleton-badge" />
        <div className="skeleton skeleton-date" />
      </div>
      <div className="skeleton skeleton-title" />
      <div className="skeleton skeleton-subtitle" />
      <div className="skeleton skeleton-snippet" />
    </div>
  );

  return (
    <div className="app">
      {/* Mobile Sidebar Overlay */}
      <div 
        className={`sidebar-overlay ${isSidebarOpen ? 'active' : ''}`}
        onClick={() => setIsSidebarOpen(false)}
      />
      
      {/* Sidebar */}
      <aside className={`sidebar ${isSidebarOpen ? 'mobile-open' : ''}`}>
        <div className="sidebar-header">
          <div className="logo">
            <img src="/logo.svg" alt="Scout" className="logo-full" />
          </div>
          <div className="header-actions">
            <button 
              className="theme-toggle" 
              onClick={toggleTheme}
              title={`Theme: ${theme}`}
            >
              {getThemeIcon()}
            </button>
            <button 
              className="sidebar-close mobile-only"
              onClick={() => setIsSidebarOpen(false)}
            >
              <X size={20} />
            </button>
          </div>
        </div>

        <div className="sidebar-section">
          <div className="sidebar-label">Connected Sources</div>
          
          {/* Gmail */}
          <div className="source-group">
            <div 
              className="source-header clickable"
              onClick={() => toggleCollapse('gmail')}
            >
              <div className="source-header-left">
                <span className="collapse-icon">{collapsedSources.includes('gmail') ? '▶' : '▼'}</span>
                <Mail size={16} />
                <span>Gmail</span>
              </div>
              {gmailCount > 0 && <span className="source-count">{gmailCount}</span>}
            </div>
            {!collapsedSources.includes('gmail') && (
              <>
                {accounts.filter(a => a.type === "gmail").map((account) => (
                  <div key={account.email} className="source-item">
                    <div className="source-dot" style={{ backgroundColor: account.color }} />
                    <span className="source-email">{account.email}</span>
                    <button className="source-remove" onClick={(e) => { e.stopPropagation(); removeAccount(account); }}>
                      <X size={14} />
                    </button>
                  </div>
                ))}
                <button className="add-source-btn" onClick={connectGmail}>
                  <Plus size={14} />
                  <span>Add Gmail Account</span>
                </button>
              </>
            )}
          </div>

          {/* Coming Soon Sources */}
          {(["dropbox", "slack", "drive", "whatsapp"] as const).map((source) => {
            const config = SOURCE_CONFIG[source];
            const Icon = config.icon;
            return (
              <div key={source} className="source-group coming-soon">
                <div className="source-header">
                  <div className="source-header-left">
                    <Icon size={16} />
                    <span>{config.label}</span>
                  </div>
                  <span className="badge">Soon</span>
                </div>
              </div>
            );
          })}
        </div>

        <div className="sidebar-footer">
          <a 
            href="mailto:namhhca@yahoo.com?subject=Scout%20Feedback&body=Hi%2C%0A%0AI%20have%20some%20feedback%20about%20Scout%3A%0A%0A" 
            className="feedback-btn"
          >
            <MessageCircleHeart size={16} />
            <span>Send Feedback</span>
          </a>
          <div className="version-badge">v1.3</div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="main">
        {/* Search Header */}
        <header className="search-header">
          <button 
            className="hamburger-btn mobile-only"
            onClick={() => setIsSidebarOpen(true)}
          >
            <Menu size={24} />
          </button>
          <div className="search-box">
            <Search size={20} className="search-icon" />
            <input
              type="text"
              placeholder="Search across all your accounts..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && search()}
            />
            {query && (
              <button className="search-clear" onClick={() => setQuery("")}>
                <X size={16} />
              </button>
            )}
          </div>
          <button className="search-btn" onClick={search} disabled={loading || accounts.length === 0}>
            {loading ? (
              <>
                <Loader2 size={18} className="spin" />
                <span>Searching</span>
              </>
            ) : (
              <>
                <Search size={18} />
                <span>Search</span>
              </>
            )}
          </button>
        </header>

        {/* Filter Bar */}
        <div className="filter-bar">
          <span className="filter-label">Sources</span>
          <div className="filter-chips">
            {Object.entries(SOURCE_CONFIG).map(([key, config]) => {
              const Icon = config.icon;
              const isActive = activeFilters.includes(key);
              return (
                <button
                  key={key}
                  className={`filter-chip ${isActive ? "active" : ""}`}
                  onClick={() => toggleFilter(key)}
                  style={{ 
                    "--chip-color": config.color,
                  } as React.CSSProperties}
                >
                  <Icon size={14} />
                  <span>{config.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Results */}
        <div className="results-container">
          {/* Results List */}
          <div className="results-list">
            {loading && (
              <div className="results-loading">
                <ResultSkeleton />
                <ResultSkeleton />
                <ResultSkeleton />
                <ResultSkeleton />
              </div>
            )}

            {!loading && accounts.length === 0 && (
              <div className="empty-state anim-fade-in">
                <IllustrationConnect width={140} height={140} className="empty-illustration" />
                <h3>Connect your accounts</h3>
                <p>Add Gmail, Dropbox, Slack, and more to search across all your data in one place.</p>
                <button className="primary-btn" onClick={connectGmail}>
                  <Mail size={18} />
                  <span>Connect Gmail</span>
                </button>
              </div>
            )}

            {!loading && accounts.length > 0 && results.length === 0 && query === "" && (
              <div className="empty-state anim-fade-in">
                <IllustrationSearch width={140} height={140} className="empty-illustration" />
                <h3>Ready to search</h3>
                <p>Search across {accounts.length} connected account{accounts.length !== 1 ? "s" : ""} instantly.</p>
              </div>
            )}

            {!loading && results.length === 0 && query !== "" && (
              <div className="empty-state anim-fade-in">
                <IllustrationNoResults width={140} height={140} className="empty-illustration" />
                <h3>No results found</h3>
                <p>Try different keywords or adjust your source filters.</p>
              </div>
            )}

            {results.length > 0 && (
              <>
                <div className="results-header">
                  <button 
                    className={`select-all-btn ${isAllSelected ? 'checked' : ''}`}
                    onClick={toggleSelectAll}
                  >
                    {isAllSelected ? <CheckSquare size={18} /> : <Square size={18} />}
                  </button>
                  <span className="results-count">
                    {isSelectionMode ? `${selectedIds.length} selected` : `${results.length} results`}
                  </span>
                </div>
                <div className={`results-scroll ${isSelectionMode ? 'selection-active' : ''}`}>
                  {results.map((result, index) => {
                    const Icon = SOURCE_CONFIG[result.source].icon;
                    return (
                      <div
                        key={result.id}
                        className={`result-item anim-stagger-item ${selectedResult?.id === result.id ? "selected" : ""} ${isSelected(result.id) ? "bulk-selected" : ""}`}
                        style={{ animationDelay: `${Math.min(index * 50, 500)}ms` }}
                        onClick={() => setSelectedResult(result)}
                      >
                        <button 
                          className={`item-checkbox ${isSelected(result.id) ? 'checked' : ''}`}
                          onClick={(e) => toggleSelection(result.id, e)}
                        >
                          {isSelected(result.id) ? <CheckSquare size={18} /> : <Square size={18} />}
                        </button>
                        <div className="result-content">
                          <div className="result-source">
                            <span 
                              className="source-badge"
                              style={{ backgroundColor: result.sourceColor }}
                            >
                              <Icon size={12} />
                              <span>{result.sourceLabel.split("@")[0]}</span>
                            </span>
                            <span className="result-date">{formatDate(result.date)}</span>
                          </div>
                          <div className="result-title">{result.title}</div>
                          <div className="result-subtitle">{result.subtitle}</div>
                          <div className="result-snippet">{result.snippet}</div>
                        </div>
                        <ChevronRight size={16} className="result-arrow" />
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>

          {/* Preview Panel */}
          <div className={`preview-panel ${selectedResult ? 'active' : ''}`}>
            {!selectedResult ? (
              <div className="preview-empty">
                <div className="preview-empty-icon">
                  <Mail size={40} strokeWidth={1.5} />
                </div>
                <p>Select a message to preview</p>
              </div>
            ) : (
              <div className="preview-content">
                {/* Mobile Back Button */}
                <div className="preview-mobile-header mobile-only">
                  <button className="back-btn" onClick={() => setSelectedResult(null)}>
                    <ArrowLeft size={20} />
                    <span>Back to Results</span>
                  </button>
                </div>
                <div className="preview-card">
                  <div className="preview-header">
                    <span 
                      className="source-badge large"
                      style={{ backgroundColor: selectedResult.sourceColor }}
                    >
                      {(() => {
                        const Icon = SOURCE_CONFIG[selectedResult.source].icon;
                        return <Icon size={14} />;
                      })()}
                      <span>{selectedResult.sourceLabel}</span>
                    </span>
                  </div>
                  <h2 className="preview-title">{selectedResult.title}</h2>
                  <div className="preview-meta">
                    <div className="preview-from">
                      <span className="preview-from-label">From</span>
                      <span className="preview-from-value">{selectedResult.subtitle}</span>
                    </div>
                    <div className="preview-date-block">
                      <span className="preview-date-label">Date</span>
                      <span className="preview-date-value">{selectedResult.date}</span>
                    </div>
                  </div>
                  <div className="preview-body">
                    <p>{selectedResult.snippet}</p>
                  </div>
                  {selectedResult.url && (
                    <a 
                      href={selectedResult.url} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="preview-open-btn"
                    >
                      <span>Open in {SOURCE_CONFIG[selectedResult.source].label}</span>
                      <ExternalLink size={16} />
                    </a>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </main>

      {error && (
        <div className="toast error">
          <span>{error}</span>
          <button onClick={() => setError(null)}>
            <X size={18} />
          </button>
        </div>
      )}

      {/* Bulk Action Bar */}
      <div className={`bulk-action-bar ${isSelectionMode ? 'visible' : ''}`}>
        <div className="selection-count">
          <CheckSquare size={18} />
          <span>{selectedIds.length} selected</span>
        </div>
        <div className="action-buttons">
          <button className="action-btn" onClick={openSelectedResults}>
            <ExternalLink size={16} />
            <span>Open All</span>
          </button>
          <button className="action-btn">
            <Download size={16} />
            <span>Export</span>
          </button>
        </div>
        <button className="close-selection-btn" onClick={clearSelection}>
          <X size={18} />
        </button>
      </div>
    </div>
  );
}

export default App;
// trigger deploy
