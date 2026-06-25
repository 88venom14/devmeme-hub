import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
// Only the latin + cyrillic subsets are imported (the site is RU/EN). The full
// /400.css etc. pull in @font-face for every subset (greek, arabic, hebrew,
// vietnamese, braille, symbols…), bloating the CSS with declarations we never use.
import "@fontsource/cascadia-code/latin-400.css";
import "@fontsource/cascadia-code/cyrillic-400.css";
import "@fontsource/cascadia-code/latin-600.css";
import "@fontsource/cascadia-code/cyrillic-600.css";
import "@fontsource/cascadia-code/latin-700.css";
import "@fontsource/cascadia-code/cyrillic-700.css";
import App from "./App";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
