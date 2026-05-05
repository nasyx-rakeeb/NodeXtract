import { useState, useEffect, useRef } from 'react';
import { MemoryRouter as Router, Routes, Route, NavLink } from 'react-router-dom';
import './App.css';
// @ts-ignore
import logoIcon from '../../assets/icon.png';

type LinkStatus = 'pending' | 'opening' | 'waiting_start' | 'intercepting' | 'success' | 'failed';

interface LinkItem {
  url: string;
  status: LinkStatus;
  downloadUrl?: string;
  error?: string;
  attempt?: number;
}

interface LogEntry {
  id: number;
  level: 'info' | 'warn' | 'error';
  message: string;
}

function Sidebar() {
  return (
    <div className="sidebar">
      <div className="sidebar-header">
        <img src={logoIcon} alt="NodeXtract Logo" className="logo-img" />
        <h2>NodeXtract</h2>
      </div>
      <nav className="sidebar-nav">
        <NavLink to="/" className={({ isActive }) => (isActive ? 'nav-item active' : 'nav-item')}>
          Extraction
        </NavLink>
        <NavLink to="/settings" className={({ isActive }) => (isActive ? 'nav-item active' : 'nav-item')}>
          Settings
        </NavLink>
        <NavLink to="/help" className={({ isActive }) => (isActive ? 'nav-item active' : 'nav-item')}>
          Help Guide
        </NavLink>
      </nav>
      <div className="sidebar-footer">
        v1.0.0 Pro
      </div>
    </div>
  );
}

// --- Views ---

function ExtractionView({ 
  linksInput, setLinksInput, links, logs, isRunning, handleStart, handleStop 
}: any) {
  const logsEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isRunning && logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs, isRunning]);

  return (
    <div className="view-container">
      {!isRunning ? (
        <div className="input-section">
          <textarea
            value={linksInput}
            onChange={(e) => setLinksInput(e.target.value)}
            placeholder="Paste datanodes.to URLs (one per line)..."
            className="link-input"
          />
          <div className="input-actions">
            <button className="btn primary" onClick={handleStart} disabled={!linksInput.trim()}>
              Start Extraction
            </button>
          </div>
        </div>
      ) : (
        <div className="terminal-container">
          <div className="terminal-header">
            <div className="terminal-dots">
              <span className="dot red"></span>
              <span className="dot yellow"></span>
              <span className="dot green"></span>
            </div>
            <span className="terminal-title">System Logs</span>
            <button className="btn danger small stop-btn" onClick={handleStop}>
              Stop / Cancel
            </button>
          </div>
          <div className="terminal-body">
            {logs.map((log: LogEntry) => (
              <div key={log.id} className={`log-line ${log.level}`}>
                <span className="log-time">[{new Date(log.id).toLocaleTimeString()}]</span>
                <span className="log-msg">{log.message}</span>
              </div>
            ))}
            {logs.length === 0 && <div className="log-line info">Spinning up extraction engine...</div>}
            <div ref={logsEndRef} />
          </div>
        </div>
      )}

      <div className="table-section">
        <div className="table-header">
          <h2>Download Queue</h2>
          <button
            className="btn secondary small"
            onClick={() => {
              const successLinks = links.filter((l: any) => l.status === 'success' && l.downloadUrl).map((l: any) => l.downloadUrl);
              if (successLinks.length > 0) {
                navigator.clipboard.writeText(successLinks.join('\n'));
                alert('Copied to clipboard!');
              }
            }}
            disabled={links.filter((l: any) => l.status === 'success').length === 0}
          >
            Copy All Links
          </button>
        </div>
        
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Source URL</th>
                <th>Status</th>
                <th>Result</th>
              </tr>
            </thead>
            <tbody>
              {links.map((link: LinkItem, idx: number) => (
                <tr key={idx} className={`row-status-${link.status}`}>
                  <td className="url-col" title={link.url}>{link.url}</td>
                  <td className="status-col">
                    <div className="status-indicator">
                      {link.status === 'pending' && <span className="badge pending">Pending</span>}
                      {link.status === 'opening' && <span className="badge opening">Opening</span>}
                      {link.status === 'waiting_start' && <span className="badge waiting">Waiting</span>}
                      {link.status === 'intercepting' && <span className="badge intercepting">Intercepting</span>}
                      {link.status === 'success' && <span className="badge success">Success</span>}
                      {link.status === 'failed' && <span className="badge failed">Failed</span>}
                    </div>
                  </td>
                  <td className="result-col">
                    {link.downloadUrl ? (
                      <a href={link.downloadUrl} target="_blank" rel="noreferrer" className="download-link">Direct Link</a>
                    ) : (
                      <span className="error-text">{link.error || '-'}</span>
                    )}
                  </td>
                </tr>
              ))}
              {links.length === 0 && (
                <tr>
                  <td colSpan={3} className="empty-table">No links in queue. Paste links above to begin.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function SettingsView({ concurrency, setConcurrency, retries, setRetries, headless, setHeadless, isRunning }: any) {
  return (
    <div className="view-container">
      <div className="view-header">
        <h1>Preferences</h1>
      </div>
      <div className="settings-panel">
        <div className="setting-row">
          <div className="setting-info">
            <h3>Concurrency</h3>
            <p>Number of browser tabs to open simultaneously.</p>
          </div>
          <input
            type="number"
            min="1"
            max="10"
            value={concurrency}
            onChange={(e) => setConcurrency(parseInt(e.target.value) || 1)}
            disabled={isRunning}
            className="setting-input"
          />
        </div>
        <div className="setting-divider"></div>
        <div className="setting-row">
          <div className="setting-info">
            <h3>Max Retries</h3>
            <p>Number of times to retry a link before failing.</p>
          </div>
          <input
            type="number"
            min="0"
            max="5"
            value={retries}
            onChange={(e) => setRetries(parseInt(e.target.value) || 0)}
            disabled={isRunning}
            className="setting-input"
          />
        </div>
        <div className="setting-divider"></div>
        <div className="setting-row">
          <div className="setting-info">
            <h3>Headless Mode</h3>
            <p>Run browser in background without showing windows.</p>
          </div>
          <label className="toggle-switch">
            <input
              type="checkbox"
              checked={headless}
              onChange={(e) => setHeadless(e.target.checked)}
              disabled={isRunning}
            />
            <span className="slider"></span>
          </label>
        </div>
      </div>
    </div>
  );
}

function HelpView() {
  return (
    <div className="view-container">
      <div className="view-header">
        <h1>How to Download</h1>
        <p className="subtitle">Read this carefully before downloading extracted links.</p>
      </div>
      <div className="help-content">
        <div className="warning-card">
          <h2>⚠️ Why can't I just paste links into IDM?</h2>
          <p>
            File hosts like Datanodes use security tokens. If you paste a direct link straight into a download manager, the server will block it. <strong>The link must be opened in a web browser first</strong> so the server can verify your session.
          </p>
        </div>
        
        <div className="steps-container">
          <div className="step">
            <div className="step-number">1</div>
            <div className="step-text">
              <h3>Install Internet Download Manager (IDM)</h3>
              <p>Download and install IDM. Make sure the <strong>"IDM Integration Module"</strong> extension is turned ON in your Chrome, Edge, or Brave browser. This allows IDM to automatically catch downloads.</p>
            </div>
          </div>
          <div className="step">
            <div className="step-number">2</div>
            <div className="step-text">
              <h3>Install "Open Multiple URLs" Extension</h3>
              <p>Go to the Chrome Web Store and install the free extension called <strong>"Open Multiple URLs"</strong>. This tool lets you open dozens of links at the exact same time with one click.</p>
            </div>
          </div>
          <div className="step">
            <div className="step-number">3</div>
            <div className="step-text">
              <h3>Copy Extracted Links</h3>
              <p>After NodeXtract successfully extracts your links, click the <strong>"Copy All Links"</strong> button located above the Download Queue table.</p>
            </div>
          </div>
          <div className="step">
            <div className="step-number">4</div>
            <div className="step-text">
              <h3>Open & Auto-Download!</h3>
              <p>Click the <strong>Open Multiple URLs</strong> extension icon in your browser, paste your copied links into the box, and check "Open tabs in groups of 5". Click Open. The browser will open the tabs, verify the security tokens instantly, and IDM will automatically pop up and start downloading them all!</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// --- Main App Logic ---

function MainApp() {
  const [linksInput, setLinksInput] = useState('');
  const [links, setLinks] = useState<LinkItem[]>([]);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [updateInfo, setUpdateInfo] = useState<{ type: string; version?: string; percent?: number; message?: string } | null>(null);

  const [concurrency, setConcurrency] = useState(5);
  const [retries, setRetries] = useState(3);
  const [headless, setHeadless] = useState(false);

  useEffect(() => {
    const removeExtractionListener = window.electron.ipcRenderer.on('extraction-event', (data: any) => {
      if (data.type === 'log') {
        setLogs((prev) => [...prev, { id: Date.now(), level: data.level || 'info', message: data.message }]);
      } else if (data.type === 'progress') {
        setLinks((prev) =>
          prev.map((item) => (item.url === data.link ? { ...item, status: data.status, attempt: data.attempt || item.attempt } : item))
        );
      } else if (data.type === 'result') {
        setLinks((prev) =>
          prev.map((item) =>
            item.url === data.link
              ? { ...item, status: data.status === 'success' ? 'success' : 'failed', downloadUrl: data.download_url, error: data.error }
              : item
          )
        );
      } else if (data.type === 'done') {
        setIsRunning(false);
      }
    });

    const removeUpdateListener = window.electron.ipcRenderer.on('update-status', (data: any) => {
      setUpdateInfo(data);
      if (data.type === 'downloaded') {
        // Automatically hide success message after 10 seconds
        setTimeout(() => setUpdateInfo(null), 10000);
      }
    });

    return () => {
      removeExtractionListener();
      removeUpdateListener();
    };
  }, []);

  const handleStart = () => {
    if (!linksInput.trim()) return;

    let parsedLinks = linksInput.split('\n').map((l) => l.trim()).filter((l) => l);
    if (parsedLinks.length === 0) return;

    const validLinks = parsedLinks.filter((l) => l.includes('datanodes.to'));
    const invalidCount = parsedLinks.length - validLinks.length;

    if (validLinks.length === 0) {
      window.alert('NodeXtract currently only supports datanodes.to links. Please provide valid URLs.');
      return;
    }

    if (invalidCount > 0) {
      window.alert(`Removed ${invalidCount} invalid link(s). NodeXtract only supports datanodes.to.`);
    }

    parsedLinks = validLinks;

    setLinks(parsedLinks.map((url) => ({ url, status: 'pending' })));
    setLogs([]);
    setIsRunning(true);

    window.electron.ipcRenderer.sendMessage('start-extraction', {
      links: parsedLinks,
      config: { concurrency, retries, headless },
    });
  };

  const handleStop = () => {
    window.electron.ipcRenderer.sendMessage('stop-extraction');
    setIsRunning(false);
  };

  return (
    <div className="app-shell">
      {updateInfo && (
        <div className={`update-banner ${updateInfo.type}`}>
          <div className="update-content">
            {updateInfo.type === 'available' && <span>New version {updateInfo.version} is available. Downloading...</span>}
            {updateInfo.type === 'progress' && (
              <div className="update-progress-container">
                <span>Downloading update... {Math.round(updateInfo.percent || 0)}%</span>
                <div className="update-progress-bar">
                  <div className="update-progress-fill" style={{ width: `${updateInfo.percent}%` }}></div>
                </div>
              </div>
            )}
            {updateInfo.type === 'downloaded' && <span>Version {updateInfo.version} ready. It will install on next restart.</span>}
            {updateInfo.type === 'error' && <span className="update-error">Update error: {updateInfo.message}</span>}
          </div>
          <button className="close-banner" onClick={() => setUpdateInfo(null)}>✕</button>
        </div>
      )}
      <TopNav />
      <main className="main-viewport">
        <Routes>
          <Route path="/" element={<ExtractionView linksInput={linksInput} setLinksInput={setLinksInput} links={links} logs={logs} isRunning={isRunning} handleStart={handleStart} handleStop={handleStop} />} />
          <Route path="/settings" element={<SettingsView concurrency={concurrency} setConcurrency={setConcurrency} retries={retries} setRetries={setRetries} headless={headless} setHeadless={setHeadless} isRunning={isRunning} />} />
          <Route path="/help" element={<HelpView />} />
        </Routes>
      </main>
    </div>
  );
}

export default function App() {
  return (
    <Router>
      <MainApp />
    </Router>
  );
}
