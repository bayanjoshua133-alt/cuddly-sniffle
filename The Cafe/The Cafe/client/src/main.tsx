import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

// Global error handler for unhandled promise rejections
window.addEventListener('unhandledrejection', (event) => {
  console.error('Unhandled promise rejection:', event.reason);
});

// Global error handler for runtime errors
window.addEventListener('error', (event) => {
  console.error('Global error:', event.error);
});

const root = document.getElementById("root");
if (!root) {
  throw new Error("Root element not found");
}

try {
  createRoot(root).render(<App />);
} catch (error) {
  console.error("Failed to render app:", error);
  // Display error on page as fallback
  root.innerHTML = `<div style="display:flex;align-items:center;justify-content:center;min-height:100vh;font-family:system-ui;color:#f87171;background:#1a1a1a">
    <div style="text-align:center;max-width:500px">
      <h1>Application Error</h1>
      <p>${(error as Error).message}</p>
      <p style="color:#999;font-size:12px">Check console for details</p>
    </div>
  </div>`;
}

