import { Link, Outlet } from "react-router-dom";

export default function App() {
  return (
    <div className="layout">
      <nav className="nav">
        <Link to="/" className="brand" aria-label="Healy Windows and Doors — home">
          <span className="brand-mark" aria-hidden="true"><span>H</span></span>
          <span className="brand-name">
            Healy Windows<span className="brand-amp">&amp;</span>Doors
          </span>
        </Link>
        <Link to="/">Dashboard</Link>
        <Link to="/sketch">Sketch Generator</Link>
      </nav>
      <main className="main">
        <Outlet />
      </main>
    </div>
  );
}
