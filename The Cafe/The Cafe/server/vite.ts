import express, { type Express } from "express";
import fs from "fs";
import path from "path";
import { createServer as createViteServer, createLogger } from "vite";
import { type Server } from "http";
import viteConfig from "../vite.config";
import { nanoid } from "nanoid";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const viteLogger = createLogger();

export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  console.log(`${formattedTime} [${source}] ${message}`);
}

export async function setupVite(app: Express, server: Server) {
  const serverOptions = {
    middlewareMode: true,
    hmr: { server },
    allowedHosts: true as const,
  };

  const vite = await createViteServer({
    ...viteConfig,
    configFile: false,
    customLogger: {
      ...viteLogger,
      error: (msg, options) => {
        viteLogger.error(msg, options);
        process.exit(1);
      },
    },
    server: serverOptions,
    appType: "custom",
  });

  app.use(vite.middlewares);
  
  // SPA fallback: serve index.html for non-API routes
  app.use((req, res, next) => {
    // Don't intercept API calls
    if (req.path.startsWith("/api")) {
      return next();
    }

    const url = req.originalUrl;

    try {
      const clientTemplate = path.resolve(
        __dirname,
        "..",
        "client",
        "index.html",
      );

      // always reload the index.html file from disk incase it changes
      let template = fs.readFileSync(clientTemplate, "utf-8");
      template = template.replace(
        `src="/src/main.tsx"`,
        `src="/src/main.tsx?v=${nanoid()}"`,
      );
      
      vite.transformIndexHtml(url, template).then((page) => {
        res.status(200).set({ "Content-Type": "text/html" }).end(page);
      });
    } catch (e) {
      vite.ssrFixStacktrace(e as Error);
      next(e);
    }
  });
}

export function serveStatic(app: Express) {
  const distPath = path.resolve(__dirname, "..", "dist", "public");

  if (!fs.existsSync(distPath)) {
    throw new Error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`,
    );
  }

  // Serve static files from dist/public
  app.use(express.static(distPath));

  // SPA fallback: serve index.html for all non-API routes
  app.use((req, res, next) => {
    // Don't intercept API calls
    if (req.path.startsWith("/api")) {
      return next();
    }
    // Serve index.html for all other routes (SPA routing) but inject a
    // lightweight debug script so client-side errors can be captured and
    // forwarded to the server. Injection only occurs if the debug badge
    // isn't already present to avoid duplicate injection.
    try {
      const indexPath = path.resolve(distPath, "index.html");
      let html = fs.readFileSync(indexPath, "utf-8");

      // Only inject once (guard by badge id)
      if (!html.includes('__client_debug_badge')) {
        const debugScript = `\n<script>\n(function(){\n  function send(payload){\n    try{ if(navigator.sendBeacon){ navigator.sendBeacon('/api/client-debug', JSON.stringify(payload)); return; } }catch(e){}\n    try{ fetch('/api/client-debug',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)}); }catch(e){}\n    try{ localStorage.setItem('lastClientError', JSON.stringify(payload)); }catch(e){}\n  }\n\n  window.addEventListener('error', function(ev){\n    send({ type: 'error', message: ev.message, filename: ev.filename, lineno: ev.lineno, colno: ev.colno, stack: ev.error && ev.error.stack, url: location.href, ua: navigator.userAgent, timestamp: Date.now() });\n  });\n\n  window.addEventListener('unhandledrejection', function(ev){\n    const r = ev.reason;\n    send({ type: 'unhandledrejection', message: r && r.message ? r.message : String(r), stack: r && r.stack ? r.stack : null, url: location.href, ua: navigator.userAgent, timestamp: Date.now() });\n  });\n\n  const origConsoleError = console.error.bind(console);\n  console.error = function(){ try{ send({ type: 'console.error', args: Array.from(arguments), url: location.href, ua: navigator.userAgent, timestamp: Date.now() }); }catch(e){}; origConsoleError.apply(null, arguments); }\n\n  try{\n    var d=document.createElement('div'); d.id='__client_debug_badge'; d.style.position='fixed'; d.style.right='8px'; d.style.bottom='8px'; d.style.zIndex='999999'; d.style.padding='6px 8px'; d.style.background='rgba(0,0,0,0.6)'; d.style.color='white'; d.style.borderRadius='6px'; d.style.fontSize='12px'; d.style.fontFamily='sans-serif'; d.style.cursor='pointer'; d.textContent='Client Debug'; d.onclick=function(){ window.open('/api/client-debug', '_blank'); }; document.body.appendChild(d);\n  }catch(e){}\n})();\n</script>\n`;

        // insert before closing </body>, or append if not found
        if (html.includes('</body>')) {
          html = html.replace('</body>', debugScript + '</body>');
        } else {
          html += debugScript;
        }
      }

      res.status(200).set({ 'Content-Type': 'text/html' }).end(html);
    } catch (err) {
      next(err);
    }
  });
}
