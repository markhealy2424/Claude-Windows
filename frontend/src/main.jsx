import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import App from "./App.jsx";
import Dashboard from "./pages/Dashboard.jsx";
import ProjectView from "./pages/ProjectView.jsx";
import SketchGenerator from "./pages/SketchGenerator.jsx";
import Financials from "./pages/Financials.jsx";
import Salespeople from "./pages/Salespeople.jsx";
import InvoiceDetail from "./pages/InvoiceDetail.jsx";
import "./styles.css";

ReactDOM.createRoot(document.getElementById("root")).render(
  <BrowserRouter>
    <Routes>
      <Route element={<App />}>
        <Route index element={<Dashboard />} />
        <Route path="projects/:id" element={<ProjectView />} />
        <Route path="financials" element={<Financials />} />
        <Route path="salespeople" element={<Salespeople />} />
        <Route path="invoices/:id" element={<InvoiceDetail />} />
        <Route path="sketch" element={<SketchGenerator />} />
      </Route>
    </Routes>
  </BrowserRouter>
);
