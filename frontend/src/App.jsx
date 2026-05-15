import { NavLink, Link, Outlet } from "react-router-dom";

const NAV_ITEMS = [
  { to: "/", label: "Dashboard", end: true },
  { to: "/projects", label: "Projects" },
  { to: "/sales", label: "Sales" },
  { to: "/financials", label: "Financials" },
];

export default function App() {
  return (
    <div className="layout">
      <aside className="sidebar">
        <Link to="/" className="brand" aria-label="Healy Windows and Doors — home">
          <span className="brand-mark" aria-hidden="true"><span>H</span></span>
          <span className="brand-name">
            Healy Windows<span className="brand-amp">&amp;</span>Doors
          </span>
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
