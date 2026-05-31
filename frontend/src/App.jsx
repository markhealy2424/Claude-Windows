import { NavLink, Link, Outlet } from "react-router-dom";

const NAV_ITEMS = [
  { to: "/", label: "Dashboard", end: true },
  { to: "/projects", label: "Projects" },
  { to: "/sales", label: "Sales" },
  { to: "/catalog", label: "Catalog" },
  { to: "/financials", label: "Financials" },
];

export default function App() {
  return (
    <div className="layout">
      <aside className="sidebar">
        <Link to="/" className="brand" aria-label="Window Stream — home">
          <img className="brand-logo" src="/window-stream-logo-cropped.png" alt="" aria-hidden="true" />
          <span className="brand-name">Window Stream</span>
        </Link>
        <nav className="sidebar-nav">
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
      </aside>
      <main className="main">
        <Outlet />
      </main>
    </div>
  );
}
