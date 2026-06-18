import { NavLink, Link, Outlet } from "react-router-dom";

const NAV_ITEMS = [
  { to: "/", label: "Dashboard", end: true },
  { to: "/projects", label: "Projects" },
  { to: "/sales", label: "Sales" },
  { to: "/catalog", label: "Catalog" },
  { to: "/financials", label: "Financials" },
];

function GearIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  );
}

export default function App() {
  return (
    <div className="app">
      <header className="topnav">
        <Link to="/" className="topnav-brand" aria-label="Window Stream — home">
          <img className="topnav-logo" src="/window-stream-logo-cropped.png" alt="" aria-hidden="true" />
          <span className="topnav-brand-name">Window Stream</span>
        </Link>
        <nav className="topnav-nav">
          {NAV_ITEMS.map((it) => (
            <NavLink
              key={it.to}
              to={it.to}
              end={it.end}
              className={({ isActive }) => (isActive ? "active" : "")}
            >
              {it.label}
            </NavLink>
          ))}
        </nav>
        <div className="topnav-right">
          <span className="topnav-pilot" title="Window Stream is in pilot — no charge yet, and you can export all your data on request.">
            Pilot · free during beta
          </span>
          <NavLink
            to="/settings/company-info"
            className={({ isActive }) => `topnav-settings${isActive ? " active" : ""}`}
            title="Company Info"
          >
            <GearIcon />
            <span>Company Info</span>
          </NavLink>
        </div>
      </header>
      <main className="main">
        <Outlet />
      </main>
    </div>
  );
}
