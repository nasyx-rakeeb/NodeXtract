import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import {
  MemoryRouter as Router,
  NavLink,
  Route,
  Routes,
} from 'react-router-dom';
import type {
  DevEngineMode,
  ElectronHandler,
  EngineHealth,
  LinkStatus,
  UpdaterEvent as UpdaterState,
} from '../main/preload';
import './App.css';
// @ts-ignore
import logoIcon from '../../assets/icon.png';

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

interface CompletionSummary {
  ready: number;
  failed: number;
  total: number;
}

type ThemeMode = 'light' | 'dark';

interface StoredSession {
  linksInput: string;
  links: LinkItem[];
  concurrency: number;
  retries: number;
  headless: boolean;
  themeMode: ThemeMode;
  devEngineMode: DevEngineMode;
  completionSummary: CompletionSummary | null;
}

interface ExtractionViewProps {
  linksInput: string;
  setLinksInput: (value: string) => void;
  links: LinkItem[];
  logs: LogEntry[];
  isRunning: boolean;
  handleStart: () => void;
  handleRetryFailed: () => void;
  handleRetryLink: (url: string) => void;
  handleImportLinks: () => void;
  handleExportReady: () => void;
  handleStop: () => void;
  completionSummary: CompletionSummary | null;
  notify: (message: string) => void;
}

interface SettingsViewProps {
  concurrency: number;
  setConcurrency: (value: number) => void;
  retries: number;
  setRetries: (value: number) => void;
  headless: boolean;
  setHeadless: (value: boolean) => void;
  themeMode: ThemeMode;
  setThemeMode: (value: ThemeMode) => void;
  devEngineMode: DevEngineMode;
  setDevEngineMode: (value: DevEngineMode) => void;
  isRunning: boolean;
  engineHealth: EngineHealth | null;
  refreshEngineHealth: () => void;
}

const statusLabels: Record<string, string> = {
  pending: 'Pending',
  opening: 'Opening',
  verifying: 'Verifying',
  waiting_free: 'Waiting',
  waiting_start: 'Starting',
  intercepting: 'Capturing',
  success: 'Ready',
  failed: 'Failed',
};

const fallbackIpcRenderer: ElectronHandler['ipcRenderer'] = {
  sendMessage: () => {},
  on: () => () => {},
  once: () => {},
  invoke: (async (channel: string, ...args: unknown[]) => {
    if (channel === 'engine:get-health') {
      return {
        appVersion: 'test',
        platform: 'test',
        packaged: false,
        enginePath: '',
        engineExists: false,
        engineMode: 'script',
        browserMode: 'playwright-chromium',
        browserNote: 'Engine health is unavailable outside Electron.',
      };
    }

    if (channel === 'links:import') {
      return { canceled: true };
    }

    if (channel === 'links:export') {
      const payload = args[0] as { links: string[] };
      return {
        canceled: false,
        filePath: '',
        count: payload.links.length,
      };
    }

    throw new Error(`Unsupported IPC channel: ${channel}`);
  }) as ElectronHandler['ipcRenderer']['invoke'],
};

const sessionStorageKey = 'nodextract.session.v1';

function readStoredSession(): StoredSession | null {
  try {
    const raw = window.localStorage.getItem(sessionStorageKey);
    return raw ? (JSON.parse(raw) as StoredSession) : null;
  } catch {
    return null;
  }
}

function getReadyLinks(links: LinkItem[]) {
  return links
    .filter((link) => link.status === 'success' && link.downloadUrl)
    .map((link) => link.downloadUrl as string);
}

function summarizeLinks(links: LinkItem[]): CompletionSummary {
  return {
    ready: links.filter((link) => link.status === 'success').length,
    failed: links.filter((link) => link.status === 'failed').length,
    total: links.length,
  };
}

function getStatusLabel(status: LinkStatus) {
  if (status.startsWith('attempt_')) {
    return `Attempt ${status.replace('attempt_', '')}`;
  }

  return statusLabels[status] || 'Working';
}

function clampNumber(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function getUpdaterActionLabel(type: UpdaterState['type']) {
  if (type === 'available') return 'Queued';
  if (type === 'downloaded') return 'Restart';
  if (type === 'checking') return 'Checking';
  if (type === 'downloading') return 'Downloading';
  return 'Check';
}

function getUpdaterTitle(state: UpdaterState) {
  if (state.type === 'available') return `Version ${state.version} available`;
  if (state.type === 'downloaded') return 'Update ready';
  if (state.type === 'checking') return 'Checking updates';
  if (state.type === 'downloading') {
    return `Downloading ${Math.round(state.percent || 0)}%`;
  }
  if (state.type === 'not-available') return 'App is current';
  if (state.type === 'error') return 'Update check failed';
  if (state.type === 'disabled') return 'Dev build';
  return `v${state.currentVersion}`;
}

function UpdateCard({
  state,
  onCheck,
  onInstall,
}: {
  state: UpdaterState;
  onCheck: () => void;
  onInstall: () => void;
}) {
  const isBusy = state.type === 'checking' || state.type === 'downloading';
  const isAutoQueued = state.type === 'available';
  const actionLabel = getUpdaterActionLabel(state.type);
  const handleAction = () => {
    if (state.type === 'downloaded') {
      onInstall();
    } else {
      onCheck();
    }
  };

  return (
    <div className={`update-card ${state.type}`}>
      <div>
        <span
          className={`status-dot ${state.type === 'error' ? 'danger' : 'online'}`}
        />
        <div>
          <strong>{getUpdaterTitle(state)}</strong>
          <small>
            {state.message || 'Updates checked through GitHub releases.'}
          </small>
        </div>
      </div>
      {state.type === 'downloading' && (
        <div className="update-progress">
          <span style={{ width: `${Math.round(state.percent || 0)}%` }} />
        </div>
      )}
      <button
        className="update-action"
        type="button"
        onClick={handleAction}
        disabled={isBusy || isAutoQueued || state.type === 'disabled'}
      >
        {actionLabel}
      </button>
    </div>
  );
}

function Sidebar({
  updaterState,
  onCheckUpdate,
  onInstallUpdate,
}: {
  updaterState: UpdaterState;
  onCheckUpdate: () => void;
  onInstallUpdate: () => void;
}) {
  return (
    <aside className="sidebar" aria-label="Primary navigation">
      <div className="brand-lockup">
        <img src={logoIcon} alt="" className="brand-mark" />
        <div>
          <h1>NodeXtract</h1>
          <p>Link workflow utility</p>
        </div>
      </div>

      <nav className="sidebar-nav">
        <NavLink
          to="/"
          className={({ isActive }) =>
            isActive ? 'nav-item active' : 'nav-item'
          }
          end
        >
          <span className="nav-glyph" aria-hidden="true" />
          <span>Extraction</span>
        </NavLink>
        <NavLink
          to="/settings"
          className={({ isActive }) =>
            isActive ? 'nav-item active' : 'nav-item'
          }
        >
          <span className="nav-glyph settings" aria-hidden="true" />
          <span>Settings</span>
        </NavLink>
        <NavLink
          to="/help"
          className={({ isActive }) =>
            isActive ? 'nav-item active' : 'nav-item'
          }
        >
          <span className="nav-glyph help" aria-hidden="true" />
          <span>Guide</span>
        </NavLink>
        <NavLink
          to="/about"
          className={({ isActive }) =>
            isActive ? 'nav-item active' : 'nav-item'
          }
        >
          <span className="nav-glyph about" aria-hidden="true" />
          <span>About</span>
        </NavLink>
      </nav>

      <div className="sidebar-footer-stack">
        <UpdateCard
          state={updaterState}
          onCheck={onCheckUpdate}
          onInstall={onInstallUpdate}
        />
        <div className="sidebar-status">
          <span className="status-dot online" />
          <span>Engine ready</span>
        </div>
      </div>
    </aside>
  );
}

function AppChrome({
  children,
  notice,
  updaterState,
  onCheckUpdate,
  onInstallUpdate,
}: {
  children: ReactNode;
  notice: string | null;
  updaterState: UpdaterState;
  onCheckUpdate: () => void;
  onInstallUpdate: () => void;
}) {
  return (
    <div className="app-layout">
      <Sidebar
        updaterState={updaterState}
        onCheckUpdate={onCheckUpdate}
        onInstallUpdate={onInstallUpdate}
      />
      <main className="main-content">
        {notice && <div className="notice-toast">{notice}</div>}
        {children}
      </main>
    </div>
  );
}

function MetricTile({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: string;
}) {
  return (
    <div className={`metric-tile ${tone || ''}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function ExtractionView({
  linksInput,
  setLinksInput,
  links,
  logs,
  isRunning,
  handleStart,
  handleRetryFailed,
  handleRetryLink,
  handleImportLinks,
  handleExportReady,
  handleStop,
  completionSummary,
  notify,
}: ExtractionViewProps) {
  const logsEndRef = useRef<HTMLDivElement>(null);
  const lastReadyRowRef = useRef<HTMLTableRowElement | null>(null);
  const parsedCount = linksInput
    .split('\n')
    .map((link) => link.trim())
    .filter(Boolean).length;

  const successCount = links.filter((link) => link.status === 'success').length;
  const failedCount = links.filter((link) => link.status === 'failed').length;
  const activeCount = links.filter(
    (link) => !['pending', 'success', 'failed'].includes(link.status),
  ).length;

  const copySuccessLinks = async () => {
    const successLinks = getReadyLinks(links);

    if (successLinks.length > 0) {
      await navigator.clipboard.writeText(successLinks.join('\n'));
      notify('Copied ready links to clipboard.');
    }
  };

  useEffect(() => {
    if (isRunning && logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs, isRunning]);

  const lastReadyIndex = links.reduce(
    (lastIndex, link, index) => (link.status === 'success' ? index : lastIndex),
    -1,
  );

  useEffect(() => {
    if (isRunning && lastReadyRowRef.current) {
      lastReadyRowRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
      });
    }
  }, [lastReadyIndex, isRunning]);

  const renderQueueResult = (link: LinkItem) => {
    if (link.downloadUrl) {
      return (
        <a
          href={link.downloadUrl}
          target="_blank"
          rel="noreferrer"
          className="download-link"
        >
          Ready Link
        </a>
      );
    }

    if (link.status === 'failed' && !isRunning) {
      return (
        <button
          className="row-action"
          type="button"
          onClick={() => handleRetryLink(link.url)}
        >
          Retry
        </button>
      );
    }

    return <span className="error-text">{link.error || '-'}</span>;
  };

  return (
    <div className="view-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">Extraction</p>
          <h2>Process supported links</h2>
        </div>
        <div className="run-state">
          <span className={`status-dot ${isRunning ? 'busy' : 'online'}`} />
          <span>{isRunning ? 'Running' : 'Idle'}</span>
        </div>
      </header>

      <section className="overview-grid">
        <MetricTile
          label="Queued"
          value={links.length || parsedCount}
          tone=""
        />
        <MetricTile label="Active" value={activeCount} tone="accent" />
        <MetricTile label="Ready" value={successCount} tone="success" />
        <MetricTile label="Failed" value={failedCount} tone="danger" />
      </section>

      {completionSummary && !isRunning && links.length > 0 && (
        <section className="summary-strip">
          <div>
            <strong>Extraction complete</strong>
            <span>
              {completionSummary.ready} ready, {completionSummary.failed} failed
              from {completionSummary.total} link(s).
            </span>
          </div>
          <div className="summary-actions">
            <button
              className="btn secondary compact"
              type="button"
              onClick={handleExportReady}
              disabled={successCount === 0}
            >
              Export Ready
            </button>
            {failedCount > 0 && (
              <button
                className="btn secondary compact"
                type="button"
                onClick={handleRetryFailed}
              >
                Retry Failed
              </button>
            )}
          </div>
        </section>
      )}

      <section className="workspace-grid">
        <div className="input-panel">
          <div className="panel-header">
            <div>
              <p className="eyebrow">Source</p>
              <h3>Input links</h3>
            </div>
            <span className="count-pill">{parsedCount} lines</span>
          </div>

          <textarea
            value={linksInput}
            onChange={(event) => setLinksInput(event.target.value)}
            placeholder="Paste supported URLs, one per line"
            className="link-input"
            disabled={isRunning}
          />

          <div className="action-row">
            {isRunning ? (
              <button className="btn danger" type="button" onClick={handleStop}>
                Stop
              </button>
            ) : (
              <button
                className="btn primary"
                type="button"
                onClick={handleStart}
                disabled={!linksInput.trim()}
              >
                Start Extraction
              </button>
            )}
            <button
              className="btn secondary"
              type="button"
              onClick={handleImportLinks}
              disabled={isRunning}
            >
              Import TXT
            </button>
            {!isRunning && failedCount > 0 && (
              <button
                className="btn secondary"
                type="button"
                onClick={handleRetryFailed}
              >
                Retry Failed
              </button>
            )}
          </div>
        </div>

        <div className="log-panel">
          <div className="panel-header">
            <div>
              <p className="eyebrow">Runtime</p>
              <h3>Engine log</h3>
            </div>
            <span className="count-pill">{logs.length} events</span>
          </div>
          <div className="terminal-body">
            {logs.map((log) => (
              <div key={log.id} className={`log-line ${log.level}`}>
                <span className="log-time">
                  [{new Date(log.id).toLocaleTimeString()}]
                </span>
                <span className="log-msg">{log.message}</span>
              </div>
            ))}
            {logs.length === 0 && (
              <div className="log-line info">
                <span className="log-msg">Engine output will appear here.</span>
              </div>
            )}
            <div ref={logsEndRef} />
          </div>
        </div>
      </section>

      <section className="queue-section">
        <div className="panel-header">
          <div>
            <p className="eyebrow">Queue</p>
            <h3>Ready handoff</h3>
          </div>
          <div className="queue-actions">
            <button
              className="btn secondary compact"
              type="button"
              onClick={handleExportReady}
              disabled={successCount === 0}
            >
              Export Ready
            </button>
            <button
              className="btn secondary compact"
              type="button"
              onClick={copySuccessLinks}
              disabled={successCount === 0}
            >
              Copy Ready
            </button>
            {!isRunning && failedCount > 0 && (
              <button
                className="btn secondary compact"
                type="button"
                onClick={handleRetryFailed}
              >
                Retry Failed
              </button>
            )}
          </div>
        </div>

        <div className="table-container">
          <table>
            <colgroup>
              <col className="source-col-width" />
              <col className="status-col-width" />
              <col className="result-col-width" />
            </colgroup>
            <thead>
              <tr>
                <th>Source URL</th>
                <th>Status</th>
                <th>Result</th>
              </tr>
            </thead>
            <tbody>
              {links.map((link, index) => (
                <tr
                  key={link.url}
                  ref={index === lastReadyIndex ? lastReadyRowRef : null}
                  className={`row-status-${link.status}`}
                >
                  <td className="url-col" title={link.url}>
                    {link.url}
                  </td>
                  <td className="status-col">
                    <span className={`badge ${link.status}`}>
                      {getStatusLabel(link.status)}
                    </span>
                  </td>
                  <td className="result-col">{renderQueueResult(link)}</td>
                </tr>
              ))}
              {links.length === 0 && (
                <tr>
                  <td colSpan={3} className="empty-table">
                    Paste supported links to build a queue.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function SettingsView({
  concurrency,
  setConcurrency,
  retries,
  setRetries,
  headless,
  setHeadless,
  themeMode,
  setThemeMode,
  devEngineMode,
  setDevEngineMode,
  isRunning,
  engineHealth,
  refreshEngineHealth,
}: SettingsViewProps) {
  const isDevBuild = engineHealth ? !engineHealth.packaged : false;

  return (
    <div className="view-shell narrow">
      <header className="topbar">
        <div>
          <p className="eyebrow">Preferences</p>
          <h2>Engine controls</h2>
        </div>
        <div className="run-state">
          <span className={`status-dot ${isRunning ? 'busy' : 'online'}`} />
          <span>{isRunning ? 'Locked while running' : 'Editable'}</span>
        </div>
      </header>

      <section className="settings-panel">
        <div className="setting-row">
          <span>
            <strong>Appearance</strong>
            <small>Choose the interface theme</small>
          </span>
          <div className="segmented-control" role="group" aria-label="Theme">
            <button
              type="button"
              className={themeMode === 'light' ? 'active' : ''}
              onClick={() => setThemeMode('light')}
            >
              Light
            </button>
            <button
              type="button"
              className={themeMode === 'dark' ? 'active' : ''}
              onClick={() => setThemeMode('dark')}
            >
              Dark
            </button>
          </div>
        </div>

        <label className="setting-row" htmlFor="setting-concurrency">
          <span>
            <strong>Concurrency</strong>
            <small>Simultaneous browser pages</small>
          </span>
          <input
            id="setting-concurrency"
            type="number"
            min="1"
            max="10"
            value={concurrency}
            onChange={(event) =>
              setConcurrency(
                clampNumber(parseInt(event.target.value, 10) || 1, 1, 10),
              )
            }
            disabled={isRunning}
            className="setting-input"
          />
        </label>

        <label className="setting-row" htmlFor="setting-retries">
          <span>
            <strong>Max retries</strong>
            <small>Attempts before a link fails</small>
          </span>
          <input
            id="setting-retries"
            type="number"
            min="0"
            max="5"
            value={retries}
            onChange={(event) =>
              setRetries(
                clampNumber(parseInt(event.target.value, 10) || 0, 0, 5),
              )
            }
            disabled={isRunning}
            className="setting-input"
          />
        </label>

        <label className="setting-row" htmlFor="setting-headless">
          <span>
            <strong>Headless mode</strong>
            <small>Run browser automation off-screen</small>
          </span>
          <span className="toggle-switch">
            <input
              id="setting-headless"
              type="checkbox"
              checked={headless}
              onChange={(event) => setHeadless(event.target.checked)}
              disabled={isRunning}
            />
            <span className="slider" />
          </span>
        </label>

        {isDevBuild && (
          <div className="setting-row">
            <span>
              <strong>Development engine</strong>
              <small>Switch between source script and packaged binary</small>
            </span>
            <div
              className="segmented-control wide"
              role="group"
              aria-label="Development engine"
            >
              <button
                type="button"
                className={devEngineMode === 'script' ? 'active' : ''}
                onClick={() => setDevEngineMode('script')}
                disabled={isRunning}
              >
                Script
              </button>
              <button
                type="button"
                className={devEngineMode === 'binary' ? 'active' : ''}
                onClick={() => setDevEngineMode('binary')}
                disabled={isRunning}
              >
                Binary
              </button>
            </div>
          </div>
        )}
      </section>

      <section className="engine-health-panel">
        <div className="panel-header">
          <div>
            <p className="eyebrow">Engine</p>
            <h3>Health check</h3>
          </div>
          <button
            className="btn secondary compact"
            type="button"
            onClick={refreshEngineHealth}
          >
            Refresh
          </button>
        </div>
        <div className="health-grid">
          <div>
            <span>Engine file</span>
            <strong className={engineHealth?.engineExists ? 'ok' : 'bad'}>
              {engineHealth?.engineExists ? 'Found' : 'Missing'}
            </strong>
          </div>
          <div>
            <span>Engine mode</span>
            <strong>{engineHealth?.engineMode || devEngineMode}</strong>
          </div>
          <div>
            <span>Platform</span>
            <strong>{engineHealth?.platform || '-'}</strong>
          </div>
          <div>
            <span>App version</span>
            <strong>{engineHealth?.appVersion || '-'}</strong>
          </div>
        </div>
        <p className="health-note">
          {engineHealth?.browserNote ||
            'Engine health is checked through the Electron main process.'}
        </p>
      </section>
    </div>
  );
}

function HelpView() {
  return (
    <div className="view-shell narrow">
      <header className="topbar">
        <div>
          <p className="eyebrow">Guide</p>
          <h2>How to use ready links</h2>
        </div>
      </header>

      <section className="guide-stack">
        <div className="guide-callout">
          <h3>What NodeXtract gives you</h3>
          <p>
            NodeXtract prepares supported source URLs and returns ready links in
            the queue. A ready link is meant to be opened in your regular
            browser so the browser can continue the session-aware download
            workflow.
          </p>
        </div>

        <div className="guide-tip">
          <strong>Opening many links</strong>
          <p>
            If the queue has many ready links, install a browser extension such
            as Open Multiple URLs. Copy the ready links from NodeXtract, paste
            them into the extension, and use the extension open action.
          </p>
        </div>

        {[
          [
            '1',
            'Paste source links',
            'Open Extraction, paste supported URLs into the input box, then click Start Extraction.',
          ],
          [
            '2',
            'Wait for Ready status',
            'Watch the Queue section. Rows marked Ready have a prepared link available in the Result column.',
          ],
          [
            '3',
            'Copy or export',
            'Use Copy Ready to place all ready links on the clipboard, or Export Ready to save them as a text file.',
          ],
          [
            '4',
            'Open in your browser',
            'Paste the copied ready links into your browser or into Open Multiple URLs, then open them.',
          ],
          [
            '5',
            'Continue normally',
            'After the links open in your browser, let your usual browser or download tool handle the files.',
          ],
        ].map(([step, title, body]) => (
          <div className="guide-row" key={step}>
            <span>{step}</span>
            <div>
              <strong>{title}</strong>
              <p>{body}</p>
            </div>
          </div>
        ))}
      </section>
    </div>
  );
}

function AboutView() {
  return (
    <div className="view-shell narrow">
      <header className="topbar">
        <div>
          <p className="eyebrow">About</p>
          <h2>NodeXtract</h2>
        </div>
      </header>

      <section className="about-stack">
        <div className="about-card">
          <h3>Desktop link workflow utility</h3>
          <p>
            NodeXtract helps organize supported URL queues, run a local browser
            preparation engine, and hand ready links back to your normal browser
            workflow from a focused desktop interface.
          </p>
        </div>

        <div className="about-card">
          <h3>What it does</h3>
          <ul className="about-list">
            <li>
              Processes supported links locally using a bundled browser engine.
            </li>
            <li>
              Shows live queue states, engine logs, retries, and failed rows.
            </li>
            <li>Copies or exports ready links for browser handoff.</li>
            <li>Checks for app updates in packaged builds.</li>
          </ul>
        </div>

        <div className="about-card">
          <h3>Responsible use</h3>
          <p>
            Use NodeXtract only with links, files, and services you are
            authorized to access. You are responsible for following the terms,
            policies, and legal requirements that apply to the content and
            services you use with this app.
          </p>
        </div>

        <div className="about-grid">
          <a
            className="about-link"
            href="https://github.com/nasyx-rakeeb/NodeXtract"
            target="_blank"
            rel="noreferrer"
          >
            <span>GitHub</span>
            <strong>View source and releases</strong>
          </a>
          <a
            className="about-link"
            href="https://github.com/sponsors/nasyx-rakeeb"
            target="_blank"
            rel="noreferrer"
          >
            <span>Support</span>
            <strong>GitHub Sponsors</strong>
          </a>
          <a
            className="about-link"
            href="https://github.com/nasyx-rakeeb/NodeXtract/issues/new"
            target="_blank"
            rel="noreferrer"
          >
            <span>Issues</span>
            <strong>Report a bug or request</strong>
          </a>
        </div>
      </section>
    </div>
  );
}

function MainApp() {
  const storedSession = useMemo(() => readStoredSession(), []);
  const [linksInput, setLinksInput] = useState(storedSession?.linksInput || '');
  const [links, setLinks] = useState<LinkItem[]>(storedSession?.links || []);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [completionSummary, setCompletionSummary] =
    useState<CompletionSummary | null>(
      storedSession?.completionSummary || null,
    );
  const [engineHealth, setEngineHealth] = useState<EngineHealth | null>(null);
  const [updaterState, setUpdaterState] = useState<UpdaterState>({
    type: 'idle',
    currentVersion: '1.0.0',
    message: 'Updates have not been checked yet.',
  });
  const [concurrency, setConcurrency] = useState(
    storedSession?.concurrency ?? 5,
  );
  const [retries, setRetries] = useState(storedSession?.retries ?? 3);
  const [headless, setHeadless] = useState(storedSession?.headless ?? true);
  const [themeMode, setThemeMode] = useState<ThemeMode>(
    storedSession?.themeMode || 'dark',
  );
  const [devEngineMode, setDevEngineMode] = useState<DevEngineMode>(
    storedSession?.devEngineMode || 'script',
  );

  const ipc = useMemo(
    () => window.electron?.ipcRenderer || fallbackIpcRenderer,
    [],
  );

  const notify = useCallback((message: string) => {
    setNotice(message);
    window.setTimeout(() => setNotice(null), 2800);
  }, []);

  const refreshEngineHealth = useCallback(async () => {
    try {
      setEngineHealth(await ipc.invoke('engine:get-health', { devEngineMode }));
    } catch (error) {
      notify(error instanceof Error ? error.message : 'Engine health failed.');
    }
  }, [devEngineMode, ipc, notify]);

  useEffect(() => {
    if (window.electron) {
      refreshEngineHealth();
    }
  }, [refreshEngineHealth]);

  useEffect(() => {
    document.documentElement.dataset.theme = themeMode;
  }, [themeMode]);

  useEffect(() => {
    const session: StoredSession = {
      linksInput,
      links,
      concurrency,
      retries,
      headless,
      themeMode,
      devEngineMode,
      completionSummary,
    };

    window.localStorage.setItem(sessionStorageKey, JSON.stringify(session));
  }, [
    completionSummary,
    concurrency,
    devEngineMode,
    headless,
    links,
    linksInput,
    retries,
    themeMode,
  ]);

  useEffect(() => {
    const removeExtractionListener = ipc.on('extraction-event', (data) => {
      if (data.type === 'log') {
        const level = data.level === 'warning' ? 'warn' : data.level || 'info';
        setLogs((previous) => [
          ...previous,
          { id: Date.now() + Math.random(), level, message: data.message },
        ]);
      } else if (data.type === 'progress') {
        setLinks((previous) =>
          previous.map((item) =>
            item.url === data.link
              ? {
                  ...item,
                  status: data.status,
                  attempt: data.attempt || item.attempt,
                }
              : item,
          ),
        );
      } else if (data.type === 'result') {
        setLinks((previous) =>
          previous.map((item) =>
            item.url === data.link
              ? {
                  ...item,
                  status: data.status === 'success' ? 'success' : 'failed',
                  downloadUrl: data.download_url,
                  error: data.error,
                }
              : item,
          ),
        );
      } else if (data.type === 'done') {
        setLinks((previous) => {
          const summary = summarizeLinks(previous);
          setCompletionSummary(summary);
          notify(
            `Extraction complete: ${summary.ready} ready, ${summary.failed} failed.`,
          );
          return previous;
        });
        setIsRunning(false);
      }
    });
    const removeUpdaterListener = ipc.on('updater-event', (data) => {
      setUpdaterState(data);

      if (
        data.type === 'available' ||
        data.type === 'downloaded' ||
        data.type === 'error'
      ) {
        notify(data.message || 'Update status changed.');
      }
    });

    ipc.sendMessage('update:get-status');

    return () => {
      removeExtractionListener();
      removeUpdaterListener();
    };
  }, [ipc, notify]);

  const handleStart = () => {
    if (!linksInput.trim()) return;

    const parsedLinks = linksInput
      .split('\n')
      .map((link) => link.trim())
      .filter(Boolean);

    const supportedLinks = parsedLinks.filter((link) =>
      link.includes('datanodes.to'),
    );
    const validLinks = Array.from(new Set(supportedLinks));
    const invalidCount = parsedLinks.length - supportedLinks.length;
    const duplicateCount = supportedLinks.length - validLinks.length;

    if (validLinks.length === 0) {
      notify(
        'NodeXtract currently only supports datanodes.to links. Please provide valid URLs.',
      );
      return;
    }

    const cleanupMessages = [];
    if (invalidCount > 0) {
      cleanupMessages.push(
        `removed ${invalidCount} unsupported link(s); currently only datanodes.to links are supported`,
      );
    }
    if (duplicateCount > 0) {
      cleanupMessages.push(`removed ${duplicateCount} duplicate link(s)`);
    }
    if (cleanupMessages.length > 0) {
      notify(`Input cleaned: ${cleanupMessages.join(', ')}.`);
    }

    setLinks(validLinks.map((url) => ({ url, status: 'pending' })));
    setLogs([]);
    setCompletionSummary(null);
    setIsRunning(true);

    ipc.sendMessage('start-extraction', {
      links: validLinks,
      config: { concurrency, retries, headless, devEngineMode },
    });
  };

  const startLinksExtraction = (targetLinks: string[], message: string) => {
    if (targetLinks.length === 0 || isRunning) return;

    setLogs([]);
    setCompletionSummary(null);
    setIsRunning(true);
    notify(message);

    ipc.sendMessage('start-extraction', {
      links: targetLinks,
      config: { concurrency, retries, headless, devEngineMode },
    });
  };

  const handleRetryFailed = () => {
    const failedLinks = links
      .filter((link) => link.status === 'failed')
      .map((link) => link.url);

    if (failedLinks.length === 0 || isRunning) return;

    setLinks((previous) =>
      previous.map((link) =>
        link.status === 'failed'
          ? {
              url: link.url,
              status: 'pending',
            }
          : link,
      ),
    );
    startLinksExtraction(
      failedLinks,
      `Retrying ${failedLinks.length} failed link(s).`,
    );
  };

  const handleRetryLink = (url: string) => {
    if (isRunning) return;

    setLinks((previous) =>
      previous.map((link) =>
        link.url === url
          ? {
              url: link.url,
              status: 'pending',
            }
          : link,
      ),
    );
    startLinksExtraction([url], 'Retrying selected link.');
  };

  const handleImportLinks = async () => {
    if (isRunning) return;

    try {
      const result = await ipc.invoke('links:import');
      if (result.canceled) return;

      setLinksInput(result.links.join('\n'));
      setLinks([]);
      setLogs([]);
      setCompletionSummary(null);
      notify(`Imported ${result.links.length} link(s).`);
    } catch (error) {
      notify(error instanceof Error ? error.message : 'Import failed.');
    }
  };

  const handleExportReady = async () => {
    const readyLinks = getReadyLinks(links);
    if (readyLinks.length === 0) return;

    try {
      const result = await ipc.invoke('links:export', { links: readyLinks });
      if (!result.canceled) {
        notify(`Exported ${result.count} ready link(s).`);
      }
    } catch (error) {
      notify(error instanceof Error ? error.message : 'Export failed.');
    }
  };

  const handleStop = () => {
    ipc.sendMessage('stop-extraction');
    setIsRunning(false);
  };

  return (
    <AppChrome
      notice={notice}
      updaterState={updaterState}
      onCheckUpdate={() => ipc.sendMessage('update:check')}
      onInstallUpdate={() => ipc.sendMessage('update:install')}
    >
      <Routes>
        <Route
          path="/"
          element={
            <ExtractionView
              linksInput={linksInput}
              setLinksInput={setLinksInput}
              links={links}
              logs={logs}
              isRunning={isRunning}
              handleStart={handleStart}
              handleRetryFailed={handleRetryFailed}
              handleRetryLink={handleRetryLink}
              handleImportLinks={handleImportLinks}
              handleExportReady={handleExportReady}
              handleStop={handleStop}
              completionSummary={completionSummary}
              notify={notify}
            />
          }
        />
        <Route
          path="/settings"
          element={
            <SettingsView
              concurrency={concurrency}
              setConcurrency={setConcurrency}
              retries={retries}
              setRetries={setRetries}
              headless={headless}
              setHeadless={setHeadless}
              themeMode={themeMode}
              setThemeMode={setThemeMode}
              devEngineMode={devEngineMode}
              setDevEngineMode={setDevEngineMode}
              isRunning={isRunning}
              engineHealth={engineHealth}
              refreshEngineHealth={refreshEngineHealth}
            />
          }
        />
        <Route path="/help" element={<HelpView />} />
        <Route path="/about" element={<AboutView />} />
      </Routes>
    </AppChrome>
  );
}

export default function App() {
  return (
    <Router>
      <MainApp />
    </Router>
  );
}
