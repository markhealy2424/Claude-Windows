import { Link, Outlet } from "react-router-dom";

export default function App() {
  return (
    <div className="layout">
      <nav className="nav">
        <Link to="/">Dashboard</Link>
        <Link to="/sketch">Sketch Generator</Link>
      </nav>
      <main className="main">
        <Outlet />
      </main>
    </div>
  );
}
