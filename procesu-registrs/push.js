/**
 * Git push no repozitorija saknes (vadības sistēmas arhitektura).
 *
 * Palaid:
 *   node push.js
 *   node push.js "Optimizācija, lomas, dokumentācija"
 *
 * Rokas komandas (PowerShell / Git Bash):
 *   git add .
 *   git commit -m "update"
 *   git push origin main
 *
 * Pēc pull citā datorā:
 *   git pull origin main
 *   (pārlūkā Ctrl+F5)
 */
"use strict";

const { execSync } = require("child_process");
const path = require("path");

const repoRoot = path.resolve(__dirname, "..");
const msg = process.argv.slice(2).join(" ").trim() || "update";

function run(cmd) {
  console.log(">", cmd);
  execSync(cmd, { cwd: repoRoot, stdio: "inherit", shell: true });
}

try {
  run("git add .");
  run(`git commit -m ${JSON.stringify(msg)}`);
  run("git push origin main");
  console.log("\nGatavs. Ja lietotne hostēta — pārlūkā Ctrl+F5.");
} catch (err) {
  process.exit(typeof err.status === "number" ? err.status : 1);
}
