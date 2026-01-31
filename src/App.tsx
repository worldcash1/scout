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
  Download,
  MessageCircleHeart,
  Paperclip,
  FileText,
  Image,
  File,
  Filter,
  Calendar,
  User,
  Check,
  Send,
  FileSpreadsheet,
  Presentation,
  Film,
  Music,
  Archive,
  Eye,
  EyeOff,
  Clock,
  ArrowUpDown,
  Trash2,
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

interface DropboxAccount {
  type: "dropbox";
  email: string;
  accessToken: string;
  color: string;
}

interface SlackAccount {
  type: "slack";
  email: string;
  team: string;
  accessToken: string;
  color: string;
}

type ConnectedAccount = GmailAccount | DropboxAccount | SlackAccount;

// Dropbox OAuth config
const DROPBOX_CLIENT_ID = "3b2bjbmi8dml44w";
const DROPBOX_REDIRECT_URI = window.location.origin;

// Slack OAuth config
const SLACK_CLIENT_ID = "10398366226727.10442113554736";
const SLACK_REDIRECT_URI = window.location.origin;

interface Attachment {
  id: string;
  filename: string;
  mimeType: string;
  size: number;
}

interface SearchResult {
  id: string;
  source: "gmail" | "dropbox" | "slack" | "drive" | "whatsapp";
  sourceLabel: string;
  sourceColor: string;
  title: string;
  subtitle: string;
  snippet: string;
  body?: string;
  bodyHtml?: string;
  attachments?: Attachment[];
  date: string;
  url?: string;
  threadId?: string;
  metadata?: Record<string, string>;
}

// Decode HTML entities
const decodeHTML = (html: string): string => {
  const txt = document.createElement("textarea");
  txt.innerHTML = html;
  return txt.value;
};

// Properly decode base64 with UTF-8 support
const decodeBase64UTF8 = (base64: string): string => {
  try {
    // Convert base64 to binary
    const binary = atob(base64.replace(/-/g, '+').replace(/_/g, '/'));
    // Convert binary to UTF-8
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    // Decode as UTF-8
    return new TextDecoder('utf-8').decode(bytes);
  } catch (e) {
    // Fallback to simple atob
    return atob(base64.replace(/-/g, '+').replace(/_/g, '/'));
  }
};

// App version
const APP_VERSION = "6.4";

// Format date to relative time
const formatRelativeDate = (dateStr: string): string => {
  try {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffSecs = Math.floor(diffMs / 1000);
    const diffMins = Math.floor(diffSecs / 60);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);
    
    if (diffSecs < 60) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays === 1) return "Yesterday";
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
    
    // Show month and day for older emails
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  } catch {
    return dateStr;
  }
};

// Clean up email body for display
const cleanEmailBody = (text: string): string => {
  if (!text) return "";
  
  let cleaned = text
    // Remove style tags and their content
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    // Remove script tags and their content
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    // Remove HTML comments
    .replace(/<!--[\s\S]*?-->/g, '')
    // Remove remaining HTML tags
    .replace(/<[^>]+>/g, ' ')
    // Fix common encoding issues
    .replace(/â€™/g, "'")
    .replace(/â€œ/g, '"')
    .replace(/â€/g, '"')
    .replace(/â€"/g, '—')
    .replace(/â€"/g, '–')
    .replace(/Â /g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    // Remove [image: ...] placeholders
    .replace(/\[image:[^\]]*\]/gi, '')
    // Clean up URLs in angle brackets
    .replace(/<(https?:\/\/[^>]+)>/g, '$1')
    // Remove CSS-like content that might have leaked through
    .replace(/\{[^}]*\}/g, ' ')
    .replace(/@media[^{]*\{[^}]*\}/g, '')
    // Remove multiple consecutive spaces
    .replace(/[ \t]+/g, ' ')
    // Preserve line breaks but clean up excessive ones
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  
  return cleaned;
};

const SOURCE_CONFIG = {
  gmail: { label: "Gmail", icon: Mail, color: "#ea4335" },
  dropbox: { label: "Dropbox", icon: Box, color: "#0061fe" },
  slack: { label: "Slack", icon: MessageSquare, color: "#4a154b" },
  drive: { label: "Google Drive", icon: FolderOpen, color: "#1a73e8" },
  whatsapp: { label: "WhatsApp", icon: MessageCircle, color: "#25d366" },
};

const GMAIL_CLIENT_ID = "1063241264534-20soj16a1sv7u78212f4k3qn4khcbf05.apps.googleusercontent.com";
const GMAIL_CLIENT_SECRET = "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";
const GMAIL_SCOPES = "https://www.googleapis.com/auth/gmail.readonly https://www.googleapis.com/auth/drive.readonly email";

type Theme = "light" | "dark" | "system";

// Search filter types
interface SearchFilters {
  dateRange: "any" | "day" | "week" | "month" | "year";
  hasAttachment: boolean;
  from: string;
}

function App() {
  const [accounts, setAccounts] = useState<ConnectedAccount[]>(() => {
    // Load saved accounts from localStorage (without tokens - those need re-auth)
    const saved = localStorage.getItem("scout-accounts");
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch { return []; }
    }
    return [];
  });
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedResult, setSelectedResult] = useState<SearchResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeFilters, setActiveFilters] = useState<string[]>(["gmail", "dropbox", "slack", "drive", "whatsapp"]);
  const [collapsedSources, setCollapsedSources] = useState<string[]>([]);
  const [theme, setTheme] = useState<Theme>(() => {
    const saved = localStorage.getItem("scout-theme");
    return (saved as Theme) || "light";
  });
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [privacyMode, setPrivacyMode] = useState(false);
  const [loadingBody, setLoadingBody] = useState(false);
  const [searchHistory, setSearchHistory] = useState<string[]>(() => {
    const saved = localStorage.getItem("scout-search-history");
    if (saved) {
      try { return JSON.parse(saved); } catch { return []; }
    }
    return [];
  });
  const [showHistory, setShowHistory] = useState(false);
  const [sortBy, setSortBy] = useState<"newest" | "oldest">("newest");
  const [showAddAccount, setShowAddAccount] = useState(false);
  const viewHtml = true; // Always use Rich HTML view
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState<SearchFilters>({
    dateRange: "any",
    hasAttachment: false,
    from: ""
  });
  const [listWidth, setListWidth] = useState(() => {
    const saved = localStorage.getItem("scout-list-width");
    return saved ? parseInt(saved) : 420;
  });
  const [isResizing, setIsResizing] = useState(false);
  const [showFeedback, setShowFeedback] = useState(false);
  const [feedbackText, setFeedbackText] = useState("");
  const [feedbackSending, setFeedbackSending] = useState(false);
  const [feedbackSent, setFeedbackSent] = useState(false);
  const [nextPageToken, setNextPageToken] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  
  // Save accounts to localStorage when they change
  useEffect(() => {
    if (accounts.length > 0) {
      localStorage.setItem("scout-accounts", JSON.stringify(accounts));
    }
  }, [accounts]);

  // Download attachment
  const downloadAttachment = async (messageId: string, attachmentId: string, filename: string, accountEmail: string) => {
    const account = accounts.find(a => a.type === "gmail" && a.email === accountEmail);
    if (!account) return;

    try {
      const res = await fetch(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}/attachments/${attachmentId}`,
        { headers: { Authorization: `Bearer ${account.accessToken}` } }
      );

      if (res.ok) {
        const data = await res.json();
        // Decode base64 attachment data
        const byteCharacters = atob(data.data.replace(/-/g, '+').replace(/_/g, '/'));
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        const blob = new Blob([byteArray]);
        
        // Create download link
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
      }
    } catch (e) {
      console.error("Failed to download attachment:", e);
      setError("Failed to download attachment");
    }
  };

  // Download Google Drive file
  const downloadDriveFile = async (fileId: string, fileName: string, mimeType: string, accountEmail: string) => {
    const account = accounts.find(a => a.type === "gmail" && a.email === accountEmail);
    if (!account) return;

    try {
      let downloadUrl: string;
      let finalFileName = fileName;
      
      // Google Workspace files need to be exported
      const isGoogleFile = mimeType.startsWith("application/vnd.google-apps.");
      
      if (isGoogleFile) {
        // Export Google Docs/Sheets/Slides as PDF
        const exportMimeTypes: Record<string, { mime: string; ext: string }> = {
          "application/vnd.google-apps.document": { mime: "application/pdf", ext: ".pdf" },
          "application/vnd.google-apps.spreadsheet": { mime: "application/pdf", ext: ".pdf" },
          "application/vnd.google-apps.presentation": { mime: "application/pdf", ext: ".pdf" },
          "application/vnd.google-apps.drawing": { mime: "application/pdf", ext: ".pdf" },
        };
        
        const exportType = exportMimeTypes[mimeType];
        if (!exportType) {
          // Can't export this type, open in Drive instead
          window.open(`https://drive.google.com/file/d/${fileId.replace('drive-', '')}/view`, '_blank');
          return;
        }
        
        downloadUrl = `https://www.googleapis.com/drive/v3/files/${fileId.replace('drive-', '')}/export?mimeType=${encodeURIComponent(exportType.mime)}`;
        // Add extension if not present
        if (!finalFileName.toLowerCase().endsWith(exportType.ext)) {
          finalFileName += exportType.ext;
        }
      } else {
        // Regular files - direct download
        downloadUrl = `https://www.googleapis.com/drive/v3/files/${fileId.replace('drive-', '')}?alt=media`;
      }

      const res = await fetch(downloadUrl, {
        headers: { Authorization: `Bearer ${account.accessToken}` }
      });

      if (res.ok) {
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = finalFileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
      } else {
        throw new Error("Download failed");
      }
    } catch (e) {
      console.error("Failed to download Drive file:", e);
      setError("Failed to download file");
    }
  };

  // Send feedback email
  const sendFeedback = async () => {
    if (!feedbackText.trim()) return;
    
    setFeedbackSending(true);
    try {
      // Using Formspree - free email form service
      const res = await fetch("https://formspree.io/f/mdazjnzz", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: "scout-feedback@app.com",
          message: feedbackText,
          _subject: "Scout App Feedback",
          _replyto: accounts[0]?.email || "anonymous"
        })
      });
      
      if (res.ok) {
        setFeedbackSent(true);
        setTimeout(() => {
          setShowFeedback(false);
          setFeedbackText("");
          setFeedbackSent(false);
        }, 2000);
      }
    } catch (e) {
      console.error("Failed to send feedback:", e);
    } finally {
      setFeedbackSending(false);
    }
  };

  // Handle list panel resize
  const handleResizeStart = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
    
    const startX = e.clientX;
    const startWidth = listWidth;
    
    const handleMouseMove = (e: MouseEvent) => {
      const diff = e.clientX - startX;
      const newWidth = Math.min(Math.max(startWidth + diff, 280), 600);
      setListWidth(newWidth);
    };
    
    const handleMouseUp = () => {
      setIsResizing(false);
      localStorage.setItem("scout-list-width", listWidth.toString());
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
    
    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
  };

  // Fetch full email body when selected
  const fetchFullEmail = async (result: SearchResult) => {
    if (result.body || result.source !== "gmail") {
      setSelectedResult(result);
      return;
    }

    setSelectedResult(result);
    setLoadingBody(true);

    try {
      const account = accounts.find(a => a.type === "gmail" && a.email === result.sourceLabel);
      if (!account) return;

      const res = await fetch(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages/${result.id}?format=full`,
        { headers: { Authorization: `Bearer ${account.accessToken}` } }
      );

      if (res.ok) {
        const data = await res.json();
        
        let plainText = "";
        let htmlBody = "";
        const attachments: Attachment[] = [];
        
        // Extract content from parts recursively
        const extractContent = (payload: any) => {
          // Check for attachments
          if (payload.filename && payload.body?.attachmentId) {
            attachments.push({
              id: payload.body.attachmentId,
              filename: payload.filename,
              mimeType: payload.mimeType || "application/octet-stream",
              size: payload.body.size || 0
            });
          }
          
          // Extract text content
          if (payload.body?.data) {
            const decoded = decodeBase64UTF8(payload.body.data);
            if (payload.mimeType === "text/plain") {
              plainText = decoded;
            } else if (payload.mimeType === "text/html") {
              htmlBody = decoded;
            }
          }
          
          // Process nested parts
          if (payload.parts) {
            for (const part of payload.parts) {
              extractContent(part);
            }
          }
        };

        extractContent(data.payload);
        
        // Use plain text if available, otherwise strip HTML
        // Convert HTML to plain text properly
        const htmlToText = (html: string): string => {
          return html
            // Remove style and script tags with content
            .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
            .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
            // Remove HTML comments
            .replace(/<!--[\s\S]*?-->/g, '')
            // Convert br and p tags to newlines
            .replace(/<br\s*\/?>/gi, '\n')
            .replace(/<\/p>/gi, '\n\n')
            .replace(/<\/div>/gi, '\n')
            // Remove all other tags
            .replace(/<[^>]+>/g, ' ')
            // Clean up whitespace
            .replace(/[ \t]+/g, ' ')
            .replace(/\n +/g, '\n')
            .replace(/ +\n/g, '\n')
            .replace(/\n{3,}/g, '\n\n')
            .trim();
        };
        
        const body = plainText || (htmlBody ? htmlToText(htmlBody) : "");
        
        const updates = { body, bodyHtml: htmlBody, attachments };
        
        // Update both results and selectedResult
        setResults(prev => prev.map(r => 
          r.id === result.id && r.sourceLabel === result.sourceLabel 
            ? { ...r, ...updates } 
            : r
        ));
        setSelectedResult(prev => prev ? { ...prev, ...updates } : null);
      }
    } catch (e) {
      console.error("Failed to fetch email body:", e);
    } finally {
      setLoadingBody(false);
    }
  };

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
      `prompt=select_account&` +
      `state=gmail`;
    
    window.location.href = authUrl;
  };

  const connectDropbox = () => {
    const scopes = "account_info.read files.metadata.read files.content.read";
    const authUrl = `https://www.dropbox.com/oauth2/authorize?` +
      `client_id=${DROPBOX_CLIENT_ID}&` +
      `redirect_uri=${encodeURIComponent(DROPBOX_REDIRECT_URI)}&` +
      `response_type=code&` +
      `token_access_type=offline&` +
      `scope=${encodeURIComponent(scopes)}&` +
      `state=dropbox`;
    
    window.location.href = authUrl;
  };

  const connectSlack = () => {
    const scopes = "search:read,users:read,users:read.email";
    const authUrl = `https://slack.com/oauth/v2/authorize?` +
      `client_id=${SLACK_CLIENT_ID}&` +
      `redirect_uri=${encodeURIComponent(SLACK_REDIRECT_URI)}&` +
      `user_scope=${encodeURIComponent(scopes)}&` +
      `state=slack`;
    
    window.location.href = authUrl;
  };

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get("code");
    const state = urlParams.get("state");
    
    if (code) {
      window.history.replaceState({}, "", window.location.pathname);
      if (state === "dropbox") {
        handleDropboxCallback(code);
      } else if (state === "slack") {
        handleSlackCallback(code);
      } else {
        handleGmailCallback(code);
      }
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

  const handleDropboxCallback = async (code: string) => {
    setLoading(true);
    setError(null);
    
    try {
      const tokenRes = await fetch("https://api.dropboxapi.com/oauth2/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          code,
          grant_type: "authorization_code",
          redirect_uri: DROPBOX_REDIRECT_URI,
          client_id: DROPBOX_CLIENT_ID,
          client_secret: "u4l4im2y3i3i1v4",
        }),
      });

      const tokenData = await tokenRes.json();
      console.log("Dropbox token response:", tokenData);
      if (!tokenRes.ok) throw new Error(tokenData.error_description || tokenData.error || "Dropbox auth failed");

      // Get user info
      const userRes = await fetch("https://api.dropboxapi.com/2/users/get_current_account", {
        method: "POST",
        headers: { 
          Authorization: `Bearer ${tokenData.access_token}`,
        },
        body: null
      });
      
      if (!userRes.ok) {
        const errData = await userRes.json().catch(() => ({}));
        console.error("Dropbox user info error:", errData);
        throw new Error(errData.error_summary || "Failed to get Dropbox user info");
      }
      const user = await userRes.json();

      const newAccount: DropboxAccount = {
        type: "dropbox",
        email: user.email,
        accessToken: tokenData.access_token,
        color: "#0061fe" // Dropbox blue
      };

      setAccounts(prev => {
        const existing = prev.findIndex(a => a.type === "dropbox" && a.email === user.email);
        if (existing >= 0) {
          const updated = [...prev];
          updated[existing] = newAccount;
          return updated;
        }
        return [...prev, newAccount];
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to connect Dropbox");
    } finally {
      setLoading(false);
    }
  };

  const handleSlackCallback = async (code: string) => {
    setLoading(true);
    setError(null);
    
    try {
      // Use our API route to handle Slack OAuth (avoids CORS issues)
      const tokenRes = await fetch("/api/slack-oauth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code,
          redirect_uri: SLACK_REDIRECT_URI,
        }),
      });

      const data = await tokenRes.json();
      console.log("Slack OAuth response:", data);
      if (!data.ok) throw new Error(data.error || "Slack auth failed");

      const newAccount: SlackAccount = {
        type: "slack",
        email: data.user?.email || data.user?.name || "Slack User",
        team: data.team?.name || "Workspace",
        accessToken: data.access_token,
        color: "#4a154b" // Slack purple
      };

      setAccounts(prev => {
        const existing = prev.findIndex(a => a.type === "slack" && a.email === newAccount.email);
        if (existing >= 0) {
          const updated = [...prev];
          updated[existing] = newAccount;
          return updated;
        }
        return [...prev, newAccount];
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to connect Slack");
    } finally {
      setLoading(false);
    }
  };

  const removeAccount = (account: ConnectedAccount) => {
    setAccounts(prev => prev.filter(a => !(a.type === account.type && a.email === account.email)));
  };

  const search = async () => {
    if (!query.trim()) return;
    
    // Save to search history
    const trimmedQuery = query.trim();
    const newHistory = [trimmedQuery, ...searchHistory.filter(h => h !== trimmedQuery)].slice(0, 10);
    setSearchHistory(newHistory);
    localStorage.setItem("scout-search-history", JSON.stringify(newHistory));
    setShowHistory(false);
    
    setLoading(true);
    setResults([]);
    setSelectedResult(null);
    
    const allResults: SearchResult[] = [];

    if (activeFilters.includes("gmail")) {
      const gmailAccounts = accounts.filter(a => a.type === "gmail") as GmailAccount[];
      
      await Promise.all(gmailAccounts.map(async (account) => {
        try {
          // Build Gmail query with filters
          let gmailQuery = query;
          
          // Date range filter
          if (filters.dateRange !== "any") {
            const now = new Date();
            let afterDate: Date;
            switch (filters.dateRange) {
              case "day": afterDate = new Date(now.setDate(now.getDate() - 1)); break;
              case "week": afterDate = new Date(now.setDate(now.getDate() - 7)); break;
              case "month": afterDate = new Date(now.setMonth(now.getMonth() - 1)); break;
              case "year": afterDate = new Date(now.setFullYear(now.getFullYear() - 1)); break;
              default: afterDate = new Date(0);
            }
            const formatted = afterDate.toISOString().split('T')[0].replace(/-/g, '/');
            gmailQuery += ` after:${formatted}`;
          }
          
          // Has attachment filter
          if (filters.hasAttachment) {
            gmailQuery += " has:attachment";
          }
          
          // From filter
          if (filters.from.trim()) {
            gmailQuery += ` from:${filters.from.trim()}`;
          }
          
          const searchRes = await fetch(
            `https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${encodeURIComponent(gmailQuery)}&maxResults=50`,
            { headers: { Authorization: `Bearer ${account.accessToken}` } }
          );

          if (!searchRes.ok) return;
          const searchData = await searchRes.json();
          const messages = searchData.messages || [];
          
          // Store page token for "Load More"
          if (searchData.nextPageToken) {
            setNextPageToken(searchData.nextPageToken);
          } else {
            setNextPageToken(null);
          }

          await Promise.all(messages.map(async (msg: { id: string }) => {
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
              const fromEmail = from.match(/<([^>]+)>/)?.[1] || "";

              allResults.push({
                id: detail.id,
                source: "gmail",
                sourceLabel: account.email,
                sourceColor: SOURCE_CONFIG.gmail.color,
                title: getHeader("Subject") || "(No subject)",
                subtitle: fromName,
                snippet: detail.snippet || "",
                date: getHeader("Date"),
                url: `https://mail.google.com/mail/u/?authuser=${account.email}#inbox/${detail.threadId}`,
                threadId: detail.threadId,
                metadata: { account: account.email, messageId: detail.id, fromEmail }
              });
            }
          }));
        } catch (e) {
          console.error(`Gmail search error for ${account.email}:`, e);
        }
      }));
    }

    // Search Google Drive
    if (activeFilters.includes("drive")) {
      const gmailAccounts = accounts.filter(a => a.type === "gmail") as GmailAccount[];
      
      // Helper to get friendly file type
      const getFileType = (mimeType: string): string => {
        const types: Record<string, string> = {
          "application/vnd.google-apps.document": "Google Doc",
          "application/vnd.google-apps.spreadsheet": "Google Sheet",
          "application/vnd.google-apps.presentation": "Google Slides",
          "application/vnd.google-apps.form": "Google Form",
          "application/vnd.google-apps.folder": "Folder",
          "application/pdf": "PDF",
          "image/jpeg": "Image",
          "image/png": "Image",
          "image/gif": "Image",
          "video/mp4": "Video",
          "audio/mpeg": "Audio",
          "text/plain": "Text File",
          "text/html": "HTML",
          "text/css": "CSS",
          "text/javascript": "JavaScript",
          "application/javascript": "JavaScript",
          "application/json": "JSON",
          "text/markdown": "Markdown",
          "application/zip": "ZIP Archive",
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "Word Doc",
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "Excel",
          "application/vnd.openxmlformats-officedocument.presentationml.presentation": "PowerPoint",
        };
        return types[mimeType] || mimeType.split("/").pop()?.split(".").pop() || "File";
      };
      
      // Helper to format file size
      const formatFileSize = (bytes: number): string => {
        if (!bytes) return "";
        if (bytes < 1024) return `${bytes} B`;
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
        if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
        return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
      };
      
      await Promise.all(gmailAccounts.map(async (account) => {
        try {
          // Drive search query
          const driveQuery = `fullText contains '${query.replace(/'/g, "\\'")}'`;
          
          const searchRes = await fetch(
            `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(driveQuery)}&fields=files(id,name,mimeType,modifiedTime,webViewLink,iconLink,owners,size,thumbnailLink)&pageSize=20`,
            { headers: { Authorization: `Bearer ${account.accessToken}` } }
          );

          if (!searchRes.ok) return;
          const searchData = await searchRes.json();
          const files = searchData.files || [];

          files.forEach((file: { id: string; name: string; mimeType: string; modifiedTime: string; webViewLink: string; owners?: { displayName: string }[]; size?: string; thumbnailLink?: string }) => {
            const fileType = getFileType(file.mimeType);
            const fileSize = file.size ? formatFileSize(parseInt(file.size)) : "";
            
            allResults.push({
              id: `drive-${file.id}`,
              source: "drive",
              sourceLabel: account.email,
              sourceColor: SOURCE_CONFIG.drive.color,
              title: file.name,
              subtitle: file.owners?.[0]?.displayName || "Me",
              snippet: fileSize ? `${fileType} • ${fileSize}` : fileType,
              date: file.modifiedTime,
              url: file.webViewLink,
              metadata: { 
                account: account.email,
                fileType,
                fileSize,
                thumbnailLink: file.thumbnailLink || "",
                mimeType: file.mimeType
              }
            });
          });
        } catch (e) {
          console.error(`Drive search error for ${account.email}:`, e);
        }
      }));
    }

    // Search Dropbox
    if (activeFilters.includes("dropbox")) {
      const dropboxAccounts = accounts.filter(a => a.type === "dropbox") as DropboxAccount[];
      
      await Promise.all(dropboxAccounts.map(async (account) => {
        try {
          const searchRes = await fetch("https://api.dropboxapi.com/2/files/search_v2", {
            method: "POST",
            headers: { 
              Authorization: `Bearer ${account.accessToken}`,
              "Content-Type": "application/json"
            },
            body: JSON.stringify({
              query: query,
              options: {
                max_results: 50,
                file_status: "active",
                filename_only: false
              }
            })
          });

          if (!searchRes.ok) return;
          const searchData = await searchRes.json();
          const matches = searchData.matches || [];

          matches.forEach((match: { metadata: { metadata: { id: string; name: string; path_display: string; client_modified: string; size?: number; ".tag": string } } }) => {
            const file = match.metadata.metadata;
            if (file[".tag"] !== "file") return; // Skip folders
            
            const ext = file.name.split('.').pop()?.toLowerCase() || "";
            const fileTypes: Record<string, string> = {
              pdf: "PDF", doc: "Word", docx: "Word", xls: "Excel", xlsx: "Excel",
              ppt: "PowerPoint", pptx: "PowerPoint", txt: "Text", md: "Markdown",
              jpg: "Image", jpeg: "Image", png: "Image", gif: "Image",
              mp4: "Video", mp3: "Audio", zip: "Archive"
            };
            const fileType = fileTypes[ext] || ext.toUpperCase() || "File";
            const fileSize = file.size ? (file.size < 1024 * 1024 
              ? `${(file.size / 1024).toFixed(1)} KB` 
              : `${(file.size / (1024 * 1024)).toFixed(1)} MB`) : "";

            allResults.push({
              id: `dropbox-${file.id}`,
              source: "dropbox",
              sourceLabel: account.email,
              sourceColor: SOURCE_CONFIG.dropbox.color,
              title: file.name,
              subtitle: file.path_display.replace(`/${file.name}`, "") || "/",
              snippet: fileSize ? `${fileType} • ${fileSize}` : fileType,
              date: file.client_modified,
              url: `https://www.dropbox.com/home${file.path_display}`,
              metadata: { 
                account: account.email,
                fileType,
                path: file.path_display
              }
            });
          });
        } catch (e) {
          console.error(`Dropbox search error for ${account.email}:`, e);
        }
      }));
    }

    // Search Slack
    if (activeFilters.includes("slack")) {
      const slackAccounts = accounts.filter(a => a.type === "slack") as SlackAccount[];
      
      await Promise.all(slackAccounts.map(async (account) => {
        try {
          const searchRes = await fetch(`https://slack.com/api/search.messages?query=${encodeURIComponent(query)}&count=50`, {
            headers: { Authorization: `Bearer ${account.accessToken}` },
          });

          const searchData = await searchRes.json();
          if (!searchData.ok) {
            console.error("Slack search error:", searchData.error);
            return;
          }

          const messages = searchData.messages?.matches || [];
          messages.forEach((msg: { iid: string; ts: string; text: string; channel: { name: string; id: string }; username: string; permalink: string }) => {
            allResults.push({
              id: `slack-${msg.iid || msg.ts}`,
              source: "slack",
              sourceLabel: account.team,
              sourceColor: SOURCE_CONFIG.slack.color,
              title: `#${msg.channel?.name || "channel"}`,
              subtitle: msg.username || "Unknown",
              snippet: msg.text?.substring(0, 200) || "",
              date: new Date(parseFloat(msg.ts) * 1000).toISOString(),
              url: msg.permalink,
              metadata: { 
                account: account.email,
                channel: msg.channel?.name
              }
            });
          });
        } catch (e) {
          console.error(`Slack search error for ${account.email}:`, e);
        }
      }));
    }

    allResults.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    setResults(allResults);
    setLoading(false);
  };

  // Load more results
  const loadMore = async () => {
    if (!nextPageToken || loadingMore) return;
    
    setLoadingMore(true);
    const moreResults: SearchResult[] = [];
    
    const gmailAccounts = accounts.filter(a => a.type === "gmail") as GmailAccount[];
    
    // Build query with filters
    let gmailQuery = query;
    if (filters.dateRange !== "any") {
      const now = new Date();
      let afterDate: Date;
      switch (filters.dateRange) {
        case "day": afterDate = new Date(now.setDate(now.getDate() - 1)); break;
        case "week": afterDate = new Date(now.setDate(now.getDate() - 7)); break;
        case "month": afterDate = new Date(now.setMonth(now.getMonth() - 1)); break;
        case "year": afterDate = new Date(now.setFullYear(now.getFullYear() - 1)); break;
        default: afterDate = new Date(0);
      }
      const formatted = afterDate.toISOString().split('T')[0].replace(/-/g, '/');
      gmailQuery += ` after:${formatted}`;
    }
    if (filters.hasAttachment) gmailQuery += " has:attachment";
    if (filters.from.trim()) gmailQuery += ` from:${filters.from.trim()}`;
    
    for (const account of gmailAccounts) {
      try {
        const searchRes = await fetch(
          `https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${encodeURIComponent(gmailQuery)}&maxResults=50&pageToken=${nextPageToken}`,
          { headers: { Authorization: `Bearer ${account.accessToken}` } }
        );

        if (!searchRes.ok) continue;
        const searchData = await searchRes.json();
        const messages = searchData.messages || [];
        
        if (searchData.nextPageToken) {
          setNextPageToken(searchData.nextPageToken);
        } else {
          setNextPageToken(null);
        }

        await Promise.all(messages.map(async (msg: { id: string }) => {
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
            const fromEmail = from.match(/<([^>]+)>/)?.[1] || "";

            moreResults.push({
              id: detail.id,
              source: "gmail",
              sourceLabel: account.email,
              sourceColor: SOURCE_CONFIG.gmail.color,
              title: getHeader("Subject") || "(No subject)",
              subtitle: fromName,
              snippet: detail.snippet || "",
              date: getHeader("Date"),
              url: `https://mail.google.com/mail/u/?authuser=${account.email}#inbox/${detail.threadId}`,
              threadId: detail.threadId,
              metadata: { account: account.email, messageId: detail.id, fromEmail }
            });
          }
        }));
      } catch (e) {
        console.error(`Gmail load more error for ${account.email}:`, e);
      }
    }
    
    moreResults.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    setResults(prev => [...prev, ...moreResults]);
    setLoadingMore(false);
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

  // Sort results
  const sortedResults = [...results].sort((a, b) => {
    const dateA = new Date(a.date || 0).getTime();
    const dateB = new Date(b.date || 0).getTime();
    return sortBy === "newest" ? dateB - dateA : dateA - dateB;
  });

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
              className={`privacy-toggle ${privacyMode ? 'active' : ''}`}
              onClick={() => setPrivacyMode(!privacyMode)}
              title={privacyMode ? 'Show content' : 'Hide content'}
            >
              {privacyMode ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
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
          
          {/* Google (Gmail + Drive) */}
          <div className="source-group">
            <div 
              className="source-header clickable"
              onClick={() => toggleCollapse('gmail')}
            >
              <div className="source-header-left">
                <span className="collapse-icon">{collapsedSources.includes('gmail') ? '▶' : '▼'}</span>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                </svg>
                <span>Google</span>
              </div>
              {gmailCount > 0 && <span className="source-count">{gmailCount}</span>}
            </div>
            {!collapsedSources.includes('gmail') && (
              <div className="source-accounts">
                {accounts.filter(a => a.type === "gmail").map((account) => (
                  <div key={account.email} className="source-item compact google-account">
                    <Check size={14} className="connected-check" />
                    <div className="account-info">
                      <span className="source-email">{account.email}</span>
                      <div className="connected-services">
                        <span className="service-badge gmail"><Mail size={10} /> Gmail</span>
                        <span className="service-badge drive"><FolderOpen size={10} /> Drive</span>
                      </div>
                    </div>
                    <button className="source-remove" onClick={(e) => { e.stopPropagation(); removeAccount(account); }}>
                      <X size={12} />
                    </button>
                  </div>
                ))}
                <div className="add-account-wrapper">
                  <button 
                    className="add-source-btn compact" 
                    onClick={() => setShowAddAccount(!showAddAccount)}
                  >
                    <Plus size={12} />
                    <span>Add account</span>
                  </button>
                  {showAddAccount && (
                    <div className="add-account-dropdown">
                      <button onClick={() => { connectGmail(); setShowAddAccount(false); }}>
                        <Mail size={16} />
                        <span>Google (Gmail + Drive)</span>
                      </button>
                      <button onClick={() => { connectDropbox(); setShowAddAccount(false); }}>
                        <Box size={16} />
                        <span>Dropbox</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Dropbox Section */}
          <div className="source-group dropbox-group">
            <div className="source-header">
              <div className="source-header-left">
                <Box size={16} style={{ color: "#0061fe" }} />
                <span>Dropbox</span>
              </div>
              {accounts.filter(a => a.type === "dropbox").length > 0 && (
                <span className="source-count">{accounts.filter(a => a.type === "dropbox").length}</span>
              )}
            </div>
            <div className="source-accounts">
              {accounts.filter(a => a.type === "dropbox").length > 0 ? (
                accounts.filter(a => a.type === "dropbox").map((account) => (
                  <div key={account.email} className="source-item compact">
                    <Check size={14} className="connected-check" />
                    <div className="account-info">
                      <span className="source-email">{account.email}</span>
                      <div className="connected-services">
                        <span className="service-badge dropbox"><Box size={10} /> Files</span>
                      </div>
                    </div>
                    <button className="source-remove" onClick={(e) => { e.stopPropagation(); removeAccount(account); }}>
                      <X size={12} />
                    </button>
                  </div>
                ))
              ) : (
                <button className="connect-source-btn" onClick={connectDropbox}>
                  <Plus size={14} />
                  <span>Connect Dropbox</span>
                </button>
              )}
            </div>
          </div>

          {/* Slack Section */}
          <div className="source-group slack-group">
            <div className="source-header">
              <div className="source-header-left">
                <MessageSquare size={16} style={{ color: "#4a154b" }} />
                <span>Slack</span>
              </div>
              {accounts.filter(a => a.type === "slack").length > 0 && (
                <span className="source-count">{accounts.filter(a => a.type === "slack").length}</span>
              )}
            </div>
            <div className="source-accounts">
              {accounts.filter(a => a.type === "slack").length > 0 ? (
                accounts.filter(a => a.type === "slack").map((account) => (
                  <div key={account.email} className="source-item compact">
                    <Check size={14} className="connected-check" />
                    <div className="account-info">
                      <span className="source-email">{(account as SlackAccount).team}</span>
                      <div className="connected-services">
                        <span className="service-badge slack"><MessageSquare size={10} /> Messages</span>
                      </div>
                    </div>
                    <button className="source-remove" onClick={(e) => { e.stopPropagation(); removeAccount(account); }}>
                      <X size={12} />
                    </button>
                  </div>
                ))
              ) : (
                <button className="connect-source-btn" onClick={connectSlack}>
                  <Plus size={14} />
                  <span>Connect Slack</span>
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="sidebar-footer">
          <button 
            className="feedback-btn"
            onClick={() => setShowFeedback(true)}
          >
            <MessageCircleHeart size={16} />
            <span>Feedback & Requests</span>
          </button>
          <div className="version-badge">v{APP_VERSION}</div>
        </div>
      </aside>

      {/* Main Content */}
      <main className={`main ${isResizing ? 'resizing' : ''} ${privacyMode ? 'privacy-blur' : ''}`}>
        {/* Search Header */}
        <header className="search-header">
          <button 
            className="hamburger-btn mobile-only"
            onClick={() => setIsSidebarOpen(true)}
          >
            <Menu size={24} />
          </button>
          <div className="search-box-wrapper">
            <div className="search-box">
              <Search size={20} className="search-icon" />
              <input
                type="text"
                placeholder="Search across all your accounts..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && search()}
                onFocus={() => searchHistory.length > 0 && setShowHistory(true)}
                onBlur={() => setTimeout(() => setShowHistory(false), 150)}
              />
              {query && (
                <button className="search-clear" onClick={() => setQuery("")}>
                  <X size={16} />
                </button>
              )}
            </div>
            {showHistory && searchHistory.length > 0 && (
              <div className="search-history-dropdown">
                <div className="history-header">
                  <span><Clock size={14} /> Recent searches</span>
                  <button 
                    className="clear-history-btn"
                    onClick={() => {
                      setSearchHistory([]);
                      localStorage.removeItem("scout-search-history");
                      setShowHistory(false);
                    }}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
                {searchHistory.map((item, i) => (
                  <button
                    key={i}
                    className="history-item"
                    onMouseDown={() => {
                      setQuery(item);
                      setShowHistory(false);
                    }}
                  >
                    <Clock size={14} />
                    <span>{item}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
          <button 
            className={`filter-toggle-btn ${showFilters ? 'active' : ''} ${(filters.dateRange !== 'any' || filters.hasAttachment || filters.from) ? 'has-filters' : ''}`}
            onClick={() => setShowFilters(!showFilters)}
            title="Search filters"
          >
            <Filter size={18} />
          </button>
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

        {/* Search Filters Panel */}
        {showFilters && (
          <div className="search-filters-panel">
            <div className="filter-group">
              <label><Calendar size={14} /> Date Range</label>
              <select 
                value={filters.dateRange} 
                onChange={(e) => setFilters({...filters, dateRange: e.target.value as SearchFilters['dateRange']})}
              >
                <option value="any">Any time</option>
                <option value="day">Past 24 hours</option>
                <option value="week">Past week</option>
                <option value="month">Past month</option>
                <option value="year">Past year</option>
              </select>
            </div>
            <div className="filter-group">
              <label><User size={14} /> From</label>
              <input 
                type="text" 
                placeholder="sender@email.com"
                value={filters.from}
                onChange={(e) => setFilters({...filters, from: e.target.value})}
              />
            </div>
            <div className="filter-group checkbox">
              <label>
                <input 
                  type="checkbox" 
                  checked={filters.hasAttachment}
                  onChange={(e) => setFilters({...filters, hasAttachment: e.target.checked})}
                />
                <Paperclip size={14} />
                Has attachment
              </label>
            </div>
            <button 
              className="clear-filters-btn"
              onClick={() => setFilters({ dateRange: "any", hasAttachment: false, from: "" })}
            >
              Clear filters
            </button>
          </div>
        )}

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
        <div className={`results-container ${isResizing ? 'resizing' : ''}`}>
          {/* Results List */}
          <div className="results-list" style={{ width: `${listWidth}px` }}>
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
                  <span>Connect Google</span>
                </button>
              </div>
            )}

            {!loading && accounts.length > 0 && results.length === 0 && query === "" && (
              <div className="empty-state anim-fade-in">
                <IllustrationSearch width={160} height={160} className="empty-illustration" />
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
                  <span className="results-count">{results.length} results</span>
                  <div className="sort-dropdown">
                    <ArrowUpDown size={14} />
                    <select 
                      value={sortBy} 
                      onChange={(e) => setSortBy(e.target.value as "newest" | "oldest")}
                    >
                      <option value="newest">Newest first</option>
                      <option value="oldest">Oldest first</option>
                    </select>
                  </div>
                </div>
                <div className="results-scroll">
                  {sortedResults.map((result, index) => {
                    return (
                      <div
                        key={result.id}
                        className={`result-item anim-stagger-item ${selectedResult?.id === result.id ? "selected" : ""}`}
                        style={{ animationDelay: `${Math.min(index * 50, 500)}ms` }}
                        onClick={() => fetchFullEmail(result)}
                      >
                        <div className="result-content">
                          <div className="result-row-1">
                            <div className="result-row-1-left">
                              <span className={`source-indicator ${result.source}`}>
                                {result.source === "gmail" && <Mail size={10} />}
                                {result.source === "drive" && <FolderOpen size={10} />}
                                {result.source === "dropbox" && <Box size={10} />}
                                {result.source === "slack" && <MessageSquare size={10} />}
                              </span>
                              <span className="result-sender">{result.subtitle}</span>
                            </div>
                            <div className="result-row-1-right">
                              {result.attachments && result.attachments.length > 0 && (
                                <Paperclip size={14} className="attachment-indicator" />
                              )}
                              <span className="result-date">{formatDate(result.date)}</span>
                            </div>
                          </div>
                          <div className="result-row-2">
                            {result.source === "drive" && (
                              <span className="file-type-icon">
                                {result.metadata?.mimeType?.includes("spreadsheet") || result.metadata?.mimeType?.includes("excel") ? (
                                  <FileSpreadsheet size={14} className="icon-sheet" />
                                ) : result.metadata?.mimeType?.includes("presentation") || result.metadata?.mimeType?.includes("powerpoint") ? (
                                  <Presentation size={14} className="icon-slides" />
                                ) : result.metadata?.mimeType?.includes("document") || result.metadata?.mimeType?.includes("word") ? (
                                  <FileText size={14} className="icon-doc" />
                                ) : result.metadata?.mimeType?.includes("image") ? (
                                  <Image size={14} className="icon-image" />
                                ) : result.metadata?.mimeType?.includes("video") ? (
                                  <Film size={14} className="icon-video" />
                                ) : result.metadata?.mimeType?.includes("audio") ? (
                                  <Music size={14} className="icon-audio" />
                                ) : result.metadata?.mimeType?.includes("zip") || result.metadata?.mimeType?.includes("archive") ? (
                                  <Archive size={14} className="icon-archive" />
                                ) : result.metadata?.mimeType?.includes("pdf") ? (
                                  <FileText size={14} className="icon-pdf" />
                                ) : (
                                  <File size={14} className="icon-file" />
                                )}
                              </span>
                            )}
                            <span className="result-title">{result.title}</span>
                            <span className="result-snippet-inline"> — {decodeHTML(result.snippet)}</span>
                          </div>
                          <div className="result-account">
                            <span 
                              className="source-dot"
                              style={{ backgroundColor: SOURCE_CONFIG[result.source].color }}
                            />
                            <span>{result.sourceLabel}</span>
                          </div>
                        </div>
                        <ChevronRight size={16} className="result-arrow" />
                      </div>
                    );
                  })}
                  
                  {/* Load More Button */}
                  {nextPageToken && (
                    <div className="load-more-container">
                      <button 
                        className="load-more-btn"
                        onClick={loadMore}
                        disabled={loadingMore}
                      >
                        {loadingMore ? (
                          <>
                            <Loader2 size={16} className="spin" />
                            <span>Loading...</span>
                          </>
                        ) : (
                          <span>Load More</span>
                        )}
                      </button>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>

          {/* Resize Handle */}
          <div 
            className="resize-handle"
            onMouseDown={handleResizeStart}
          />

          {/* Preview Panel */}
          <div className={`preview-panel ${selectedResult ? 'active' : ''}`}>
            {!selectedResult ? (
              <div className="preview-empty">
                <div className="preview-empty-icon">
                  <Mail size={48} strokeWidth={1.5} />
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
                  {/* Compact Header */}
                  <div className="preview-header-compact">
                    <span 
                      className="source-badge"
                      style={{ backgroundColor: SOURCE_CONFIG[selectedResult.source].color }}
                    >
                      {(() => {
                        const Icon = SOURCE_CONFIG[selectedResult.source].icon;
                        return <Icon size={12} />;
                      })()}
                      <span>{selectedResult.sourceLabel}</span>
                    </span>
                    <span className="preview-date-compact">{formatRelativeDate(selectedResult.date)}</span>
                  </div>
                  <h2 className="preview-title-compact">{selectedResult.title}</h2>
                  
                  {/* Drive File Preview */}
                  {selectedResult.source === "drive" ? (
                    <div className="drive-preview">
                      <div className="preview-meta-compact">
                        <span className="meta-item">
                          <User size={14} />
                          <span>{selectedResult.subtitle}</span>
                        </span>
                        <span className="meta-separator">•</span>
                        <span className="meta-item">
                          {selectedResult.metadata?.mimeType?.includes("spreadsheet") ? (
                            <FileSpreadsheet size={14} className="icon-sheet" />
                          ) : selectedResult.metadata?.mimeType?.includes("presentation") ? (
                            <Presentation size={14} className="icon-slides" />
                          ) : selectedResult.metadata?.mimeType?.includes("document") ? (
                            <FileText size={14} className="icon-doc" />
                          ) : selectedResult.metadata?.mimeType?.includes("pdf") ? (
                            <FileText size={14} className="icon-pdf" />
                          ) : (
                            <File size={14} />
                          )}
                          <span>{selectedResult.metadata?.fileType || "File"}</span>
                        </span>
                        {selectedResult.metadata?.fileSize && (
                          <>
                            <span className="meta-separator">•</span>
                            <span className="meta-item">{selectedResult.metadata.fileSize}</span>
                          </>
                        )}
                      </div>

                      {/* Thumbnail if available */}
                      {selectedResult.metadata?.thumbnailLink && (
                        <div className="file-thumbnail">
                          <img 
                            src={selectedResult.metadata.thumbnailLink} 
                            alt="File preview"
                            onError={(e) => (e.currentTarget.style.display = 'none')}
                          />
                        </div>
                      )}

                      {/* Drive Actions */}
                      <div className="preview-actions drive-actions">
                        <button
                          type="button"
                          className="action-btn"
                          onClick={() => downloadDriveFile(
                            selectedResult.id,
                            selectedResult.title,
                            selectedResult.metadata?.mimeType || "",
                            selectedResult.sourceLabel
                          )}
                        >
                          <Download size={16} />
                          <span>Download{selectedResult.metadata?.mimeType?.startsWith("application/vnd.google-apps.") ? " as PDF" : ""}</span>
                        </button>
                        <a 
                          href={selectedResult.url} 
                          target="_blank"
                          rel="noopener noreferrer"
                          className="action-btn primary source-colored"
                          style={{ backgroundColor: SOURCE_CONFIG.drive.color, borderColor: SOURCE_CONFIG.drive.color }}
                        >
                          <ExternalLink size={16} />
                          <span>Open in Google Drive</span>
                        </a>
                      </div>
                    </div>
                  ) : (
                    /* Email Preview - Compact Meta */
                    <div className="preview-meta-compact">
                      <span className="meta-item">
                        <User size={14} />
                        <span>{selectedResult.subtitle}</span>
                        {selectedResult.metadata?.fromEmail && (
                          <span className="meta-email">&lt;{selectedResult.metadata.fromEmail}&gt;</span>
                        )}
                      </span>
                    </div>
                  )}

                  {/* Email-specific content */}
                  {selectedResult.source === "gmail" && (
                    <>
                  {/* Attachments */}
                  {selectedResult.attachments && selectedResult.attachments.length > 0 && (
                    <div className="attachments-section">
                      <div className="attachments-header">
                        <Paperclip size={16} />
                        <span>{selectedResult.attachments.length} Attachment{selectedResult.attachments.length > 1 ? 's' : ''}</span>
                      </div>
                      <div className="attachments-list">
                        {selectedResult.attachments.map((att, idx) => {
                          const getIcon = () => {
                            if (att.mimeType.startsWith("image/")) return <Image size={18} />;
                            if (att.mimeType.includes("pdf") || att.mimeType.includes("document")) return <FileText size={18} />;
                            return <File size={18} />;
                          };
                          const formatSize = (bytes: number) => {
                            if (bytes < 1024) return `${bytes} B`;
                            if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
                            return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
                          };
                          return (
                            <div 
                              key={idx} 
                              className="attachment-item"
                              onClick={() => downloadAttachment(
                                selectedResult.id, 
                                att.id, 
                                att.filename, 
                                selectedResult.sourceLabel
                              )}
                              title="Click to download"
                            >
                              {getIcon()}
                              <span className="attachment-name">{att.filename}</span>
                              <span className="attachment-size">{formatSize(att.size)}</span>
                              <Download size={16} className="attachment-download" />
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Email Body */}
                  <div className="preview-body">
                    {loadingBody ? (
                      <div className="preview-skeleton">
                        <div className="skeleton skeleton-line w-full" />
                        <div className="skeleton skeleton-line w-90" />
                        <div className="skeleton skeleton-line w-95" />
                        <div className="skeleton skeleton-line w-80" />
                        <div className="skeleton skeleton-line w-full" />
                        <div className="skeleton skeleton-line w-70" />
                      </div>
                    ) : viewHtml && selectedResult.bodyHtml ? (
                      <iframe
                        srcDoc={selectedResult.bodyHtml}
                        className="email-iframe"
                        sandbox="allow-same-origin"
                        title="Email content"
                      />
                    ) : (
                      <p>{cleanEmailBody(decodeHTML(selectedResult.body || selectedResult.snippet))}</p>
                    )}
                  </div>
                    </>
                  )}

                  {/* Action Button */}
                  {selectedResult.source === "gmail" && (
                    <div className="preview-actions">
                      <a 
                        href={selectedResult.url} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="action-btn primary source-colored"
                        style={{ backgroundColor: SOURCE_CONFIG.gmail.color, borderColor: SOURCE_CONFIG.gmail.color }}
                      >
                        <ExternalLink size={16} />
                        <span>Open in Gmail</span>
                      </a>
                    </div>
                  )}
                  
                  {selectedResult.source !== "gmail" && selectedResult.source !== "drive" && selectedResult.url && (
                    <a 
                      href={selectedResult.url} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="action-btn primary source-colored"
                      style={{ backgroundColor: SOURCE_CONFIG[selectedResult.source].color, borderColor: SOURCE_CONFIG[selectedResult.source].color }}
                    >
                      <ExternalLink size={16} />
                      <span>Open in {SOURCE_CONFIG[selectedResult.source].label}</span>
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

      {/* Feedback Modal */}
      {showFeedback && (
        <div className="modal-overlay" onClick={() => !feedbackSending && setShowFeedback(false)}>
          <div className="feedback-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Feedback & Requests</h3>
              <button className="modal-close" onClick={() => setShowFeedback(false)}>
                <X size={20} />
              </button>
            </div>
            <div className="modal-body">
              <textarea
                placeholder="Request a feature, report a bug, or ask a question..."
                value={feedbackText}
                onChange={(e) => setFeedbackText(e.target.value)}
                rows={5}
                disabled={feedbackSending || feedbackSent}
              />
            </div>
            <div className="modal-footer">
              <button 
                className={`send-feedback-btn ${feedbackSent ? 'success' : ''}`}
                onClick={sendFeedback}
                disabled={!feedbackText.trim() || feedbackSending || feedbackSent}
              >
                {feedbackSent ? (
                  <>
                    <Check size={18} />
                    <span>Sent!</span>
                  </>
                ) : feedbackSending ? (
                  <>
                    <Loader2 size={18} className="spin" />
                    <span>Sending...</span>
                  </>
                ) : (
                  <>
                    <Send size={18} />
                    <span>Submit</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
// trigger deploy
