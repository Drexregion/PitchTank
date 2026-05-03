/**
 * PitchTank Event Badge Generator
 * Renders a 3D spinning coin GIF for each event using Puppeteer + WebGL.
 * Run: node internal/badges/generate-badge.mjs
 * Or:  node internal/badges/generate-badge.mjs --event "Demo Day S1" --color gold --output ./output
 */

import puppeteer from "puppeteer";
import GIFEncoder from "gif-encoder-2";
import { createCanvas } from "canvas";
import { writeFileSync, mkdirSync, existsSync, readFileSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ── CLI args ──────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const getArg = (flag) => {
  const i = args.indexOf(flag);
  return i !== -1 ? args[i + 1] : null;
};

const OUTPUT_DIR = getArg("--output") || path.join(__dirname, "output");
if (!existsSync(OUTPUT_DIR)) mkdirSync(OUTPUT_DIR, { recursive: true });

// ── Badge configs ─────────────────────────────────────────────────────────────
const PRESETS = {
  gold: {
    front: "#FFD700",
    mid: "#FFA500",
    edge: "#B8860B",
    shine: "#FFFACD",
    glow: "rgba(255, 200, 50, 0.6)",
    rim: "#8B6914",
  },
  silver: {
    front: "#C0C0C0",
    mid: "#A8A8A8",
    edge: "#707070",
    shine: "#F8F8FF",
    glow: "rgba(192, 192, 220, 0.6)",
    rim: "#505050",
  },
  platinum: {
    front: "#9DC3C1",
    mid: "#7BA3A1",
    edge: "#4A7170",
    shine: "#E8F4F4",
    glow: "rgba(100, 200, 200, 0.7)",
    rim: "#2E5655",
  },
};

// Events to generate — override with --event flag for a single badge
const EVENTS = getArg("--event")
  ? [
      {
        name: getArg("--event"),
        subtitle: getArg("--subtitle") || "PitchTank Exclusive",
        color: getArg("--color") || "gold",
        slug: getArg("--event")
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-"),
      },
    ]
  : [
      {
        name: "Demo Day S1",
        subtitle: "Season 1 · 2025",
        color: "gold",
        slug: "demo-day-s1",
      },
      {
        name: "Shopify Builders",
        subtitle: "Builder Series · 2025",
        color: "silver",
        slug: "shopify-builders",
      },
      {
        name: "Tech Tuesday",
        subtitle: "Pitch Fest · 2025",
        color: "platinum",
        slug: "tech-tuesday",
      },
    ];

// ── Coin HTML template ────────────────────────────────────────────────────────
function buildCoinHTML(eventName, subtitle, colorPreset) {
  const c = PRESETS[colorPreset] || PRESETS.gold;

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    width: 400px; height: 400px;
    background: transparent;
    display: flex; align-items: center; justify-content: center;
    overflow: hidden;
  }
  .scene {
    width: 300px; height: 300px;
    perspective: 800px;
    perspective-origin: 50% 50%;
  }
  .coin {
    width: 100%; height: 100%;
    position: relative;
    transform-style: preserve-3d;
    animation: spin 3s linear infinite;
  }
  @keyframes spin {
    from { transform: rotateY(0deg); }
    to   { transform: rotateY(360deg); }
  }
  .face {
    position: absolute;
    width: 100%; height: 100%;
    border-radius: 50%;
    display: flex; flex-direction: column;
    align-items: center; justify-content: center;
    backface-visibility: visible;
  }
  .front {
    background: radial-gradient(circle at 35% 35%,
      ${c.shine} 0%,
      ${c.front} 30%,
      ${c.mid} 65%,
      ${c.edge} 100%
    );
    box-shadow:
      0 0 0 6px ${c.rim},
      0 0 0 10px ${c.edge},
      0 0 40px 10px ${c.glow},
      inset 0 2px 8px rgba(255,255,255,0.4),
      inset 0 -2px 6px rgba(0,0,0,0.3);
    transform: translateZ(8px);
  }
  .back {
    background: radial-gradient(circle at 65% 65%,
      ${c.mid} 0%,
      ${c.edge} 50%,
      ${c.rim} 100%
    );
    box-shadow:
      0 0 0 6px ${c.rim},
      0 0 0 10px ${c.edge},
      0 0 30px 8px ${c.glow};
    transform: translateZ(-8px) rotateY(180deg);
  }
  .edge-ring {
    position: absolute;
    width: 100%; height: 100%;
    border-radius: 50%;
    background: transparent;
    border: 16px solid ${c.edge};
    box-shadow:
      inset 0 0 10px rgba(0,0,0,0.4),
      0 0 20px 4px ${c.glow};
    transform: translateZ(0px);
  }

  /* Front face content */
  .pt-logo {
    font-family: 'Georgia', serif;
    font-size: 52px;
    font-weight: 900;
    color: ${c.rim};
    text-shadow:
      1px 1px 0 rgba(255,255,255,0.5),
      -1px -1px 0 rgba(0,0,0,0.3),
      0 0 20px rgba(255,255,255,0.3);
    letter-spacing: -2px;
    line-height: 1;
    margin-bottom: 2px;
  }
  .pt-label {
    font-family: 'Arial Narrow', 'Arial', sans-serif;
    font-size: 11px;
    font-weight: 700;
    color: ${c.rim};
    letter-spacing: 4px;
    text-transform: uppercase;
    opacity: 0.85;
    margin-bottom: 10px;
  }
  .event-divider {
    width: 60px;
    height: 1px;
    background: linear-gradient(to right, transparent, ${c.rim}, transparent);
    margin: 4px 0 8px;
    opacity: 0.7;
  }
  .event-name {
    font-family: 'Georgia', serif;
    font-size: 14px;
    font-weight: 700;
    color: ${c.rim};
    text-align: center;
    letter-spacing: 1px;
    padding: 0 20px;
    line-height: 1.3;
    text-shadow: 0 1px 2px rgba(255,255,255,0.4);
  }
  .event-subtitle {
    font-family: 'Arial', sans-serif;
    font-size: 9px;
    font-weight: 600;
    color: ${c.rim};
    letter-spacing: 2px;
    text-transform: uppercase;
    opacity: 0.7;
    margin-top: 4px;
  }

  /* Shine overlay sweep */
  .front::after {
    content: '';
    position: absolute;
    top: 0; left: -100%;
    width: 60%; height: 100%;
    background: linear-gradient(
      105deg,
      transparent 40%,
      rgba(255,255,255,0.25) 50%,
      transparent 60%
    );
    border-radius: 50%;
    animation: shine-sweep 3s linear infinite;
    pointer-events: none;
  }
  @keyframes shine-sweep {
    0%   { left: -100%; opacity: 1; }
    45%  { left: 150%;  opacity: 1; }
    46%  { opacity: 0; }
    100% { left: 150%;  opacity: 0; }
  }

  /* Back face — stamp pattern */
  .back-pattern {
    width: 160px; height: 160px;
    border: 2px solid ${c.mid};
    border-radius: 50%;
    display: flex; align-items: center; justify-content: center;
    opacity: 0.6;
  }
  .back-pt {
    font-family: 'Georgia', serif;
    font-size: 60px;
    font-weight: 900;
    color: ${c.mid};
    opacity: 0.5;
  }
</style>
</head>
<body>
<div class="scene">
  <div class="coin" id="coin">
    <div class="face front">
      <div class="pt-logo">PT</div>
      <div class="pt-label">PitchTank</div>
      <div class="event-divider"></div>
      <div class="event-name">${eventName}</div>
      <div class="event-subtitle">${subtitle}</div>
    </div>
    <div class="edge-ring"></div>
    <div class="face back">
      <div class="back-pattern">
        <div class="back-pt">PT</div>
      </div>
    </div>
  </div>
</div>
</body>
</html>`;
}

// ── Capture frames via Puppeteer ──────────────────────────────────────────────
async function captureFrames(html, totalFrames = 48) {
  const browser = await puppeteer.launch({
    headless: "new",
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-web-security",
      "--enable-webgl",
      "--ignore-gpu-blocklist",
    ],
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 400, height: 400, deviceScaleFactor: 2 });

  await page.setContent(html, { waitUntil: "networkidle0" });

  // Pause the CSS animation so we can step through it manually
  await page.evaluate(() => {
    document.querySelectorAll("*").forEach((el) => {
      el.style.animationPlayState = "paused";
    });
  });

  const frames = [];
  console.log(`    Capturing ${totalFrames} frames...`);

  for (let i = 0; i < totalFrames; i++) {
    const progress = i / totalFrames; // 0 → 1 (one full rotation)

    // Set animation delay to the negative time offset to seek to this frame
    await page.evaluate((p) => {
      const duration = 3; // seconds (matches CSS animation)
      const offset = -(p * duration);
      document.querySelectorAll(".coin, .front::after").forEach((el) => {
        el.style.animationDelay = `${offset}s`;
        el.style.animationPlayState = "running";
      });
      // Also step the shine sweep
      document.querySelectorAll("*").forEach((el) => {
        el.style.animationDelay = `${offset}s`;
        el.style.animationPlayState = "running";
      });
    }, progress);

    // Give the browser a frame to render
    await new Promise((r) => setTimeout(r, 30));

    const screenshot = await page.screenshot({
      type: "png",
      omitBackground: true,
    });
    frames.push(screenshot);

    if ((i + 1) % 12 === 0) {
      process.stdout.write(`    Frame ${i + 1}/${totalFrames}\n`);
    }
  }

  await browser.close();
  return frames;
}

// ── Assemble GIF ──────────────────────────────────────────────────────────────
async function buildGIF(frames, outputPath, size = 400) {
  const { default: sharp } = await import("sharp");

  const encoder = new GIFEncoder(size, size, "neuquant", true);
  encoder.setDelay(1000 / 24); // 24fps
  encoder.setQuality(5);       // 1=best, 20=worst
  encoder.setRepeat(0);        // loop forever
  encoder.start();

  for (let i = 0; i < frames.length; i++) {
    // Resize to target size and get raw RGBA pixels
    const raw = await sharp(frames[i])
      .resize(size, size)
      .ensureAlpha()
      .raw()
      .toBuffer();

    // gif-encoder-2 expects a Canvas-style ImageData
    const canvas = createCanvas(size, size);
    const ctx = canvas.getContext("2d");
    const imgData = ctx.createImageData(size, size);
    imgData.data.set(raw);
    ctx.putImageData(imgData, 0, 0);

    encoder.addFrame(ctx);
    process.stdout.write(`\r    Encoding frame ${i + 1}/${frames.length}`);
  }

  encoder.finish();
  process.stdout.write("\n");

  writeFileSync(outputPath, encoder.out.getData());
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  console.log("\n🪙  PitchTank Badge Generator");
  console.log("━".repeat(50));

  for (const event of EVENTS) {
    console.log(`\n🎖  [${event.slug}] "${event.name}" (${event.color})`);

    const html = buildCoinHTML(event.name, event.subtitle, event.color);
    const htmlDebugPath = path.join(OUTPUT_DIR, `${event.slug}-preview.html`);
    writeFileSync(htmlDebugPath, html);
    console.log(`  HTML preview → ${htmlDebugPath}`);

    console.log(`  Launching Puppeteer...`);
    const frames = await captureFrames(html, 48);
    console.log(`  Captured ${frames.length} frames`);

    const gifPath = path.join(OUTPUT_DIR, `${event.slug}-badge.gif`);
    console.log(`  Building GIF...`);
    await buildGIF(frames, gifPath, 400);

    const stats = existsSync(gifPath)
      ? `${(readFileSync(gifPath).length / 1024).toFixed(0)} KB`
      : "?";
    console.log(`  ✅ ${gifPath} (${stats})`);
  }

  console.log("\n🎉 All badges generated!");
  console.log(`   Output: ${OUTPUT_DIR}`);
  console.log(
    `\n   Usage: node internal/badges/generate-badge.mjs --event "My Event" --subtitle "Spring 2026" --color gold`
  );
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
