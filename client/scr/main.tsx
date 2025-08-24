// client/src/main.tsx
import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

const container = document.getElementById("root");
if (!container) {
  throw new Error("Could not find element with id 'root'");
}

createRoot(container).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);