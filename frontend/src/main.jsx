import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import App from "./App.jsx";
import Dashboard from "./pages/Dashboard.jsx";
import Projects from "./pages/Projects.jsx";
import Sales from "./pages/Sales.jsx";
import ProjectView from "./pages/ProjectView.jsx";
import SketchGenerator from "./pages/SketchGenerator.jsx";
import Financials from "./pages/Financials.jsx";
import InvoiceDetail from "./pages/InvoiceDetail.jsx";
import "./styles.css";

ReactDOM.createRoot(document.getElementById("root")).render(
  <BrowserRouter>
    <Routes>
      <Route element={<App />}>
        <Route index element={<Dashboard />} />
        <Route path="projects" element={<Projects />} />
        <Route path="projects/:id" element={<ProjectView />} />
        <Route path="sales" element={<Sales initialTab="Pipeline" />} />
        <Route path="sales/agent" element={<Sales initialTab="AI Agent" />} />
        <Route path="sales/resources" element={<Sales initialTab="Resources" />} />
        <Route path="leads" element={<Sales initialTab="Pipeline" />} />
        <Route path="financials" element={<Financials initialTab="Overview" />} />
        <Route path="salespeople" element={<Financials initialTab="Salespeople" />} />
        <Route path="invoices/:id" element={<InvoiceDetail />} />
        <Route path="sketch" element={<SketchGenerator />} />
      </Route>
    </Routes>
  </BrowserRouter>
);
