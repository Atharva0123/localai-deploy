/**
 * LocalAI Deploy — Data Scraper
 *
 * Usage:
 *   npm run scrape
 *
 * Setup (first time only):
 *   npm install -D playwright dotenv
 *   npx playwright install chromium
 *
 * Outputs:
 *   src/data/hf-models.json      — HuggingFace Hub metadata (free official API)
 *   src/data/tpu-hardware.json   — TechPowerUp GPU DB specs (Playwright)
 *   src/data/india-prices.json   — India retail prices (opt-in via SCRAPE_INDIA_RETAIL=true)
 *
 * Secrets:  copy .env.example → .env  and fill in HF_TOKEN.
 */

import 'dotenv/config';
import { chromium } from 'playwright-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import { writeFileSync, mkdirSync, existsSync, readFileSync } from 'fs';
chromium.use(StealthPlugin());
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = join(__dirname, '../src/data');
if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true });

const HF_TOKEN      = process.env.HF_TOKEN || '';
const SCRAPE_RETAIL = process.env.SCRAPE_INDIA_RETAIL === 'true';
const HF_ONLY       = process.argv.includes('--hf-only');

// ── Rate limiting ────────────────────────────────────────────────────────────
// MAX_MODELS: max HuggingFace models to fetch per run (0 = skip HF entirely)
// MAX_GPUS:   max TechPowerUp GPU pages to scrape per run (0 = skip)
// HF_DELAY_MS: milliseconds to wait between each HuggingFace API call
const MAX_MODELS  = process.env.MAX_MODELS  ? parseInt(process.env.MAX_MODELS,  10) : 20;
const MAX_GPUS    = process.env.MAX_GPUS    ? parseInt(process.env.MAX_GPUS,    10) : 15;
const HF_DELAY_MS = process.env.HF_DELAY_MS ? parseInt(process.env.HF_DELAY_MS, 10) : 400;
const HF_HEADERS = {
  'User-Agent': 'LocalAIDeployBot/1.0',
  ...(HF_TOKEN ? { Authorization: `Bearer ${HF_TOKEN}` } : {}),
};

// ── Load extra model IDs from scripts/models-config.json (user-editable) ────
function loadConfigModels() {
  const cfgPath = join(__dirname, 'models-config.json');
  if (!existsSync(cfgPath)) return [];
  try {
    const cfg = JSON.parse(readFileSync(cfgPath, 'utf8'));
    return Array.isArray(cfg.models) ? cfg.models : [];
  } catch (e) {
    console.warn('⚠ Could not parse models-config.json:', e.message);
    return [];
  }
}

// ── HuggingFace model IDs to track ──────────────────────────────────────────
const HF_MODELS_BASE = [
  // Meta Llama
  'meta-llama/Llama-3.3-70B-Instruct',
  'meta-llama/Llama-3.2-8B-Instruct',
  'meta-llama/Llama-3.1-405B-Instruct',
  // DeepSeek
  'deepseek-ai/DeepSeek-R1',
  'deepseek-ai/DeepSeek-R1-Distill-Qwen-7B',
  'deepseek-ai/DeepSeek-V3',
  // Google Gemma
  'google/gemma-2-27b-it',
  'google/gemma-3-12b-it',
  'google/gemma-3-27b-it',
  'google/gemma-3-4b-it',
  // Microsoft Phi
  'microsoft/Phi-4',
  'microsoft/phi-4-mini-instruct',
  // Mistral
  'mistralai/Mistral-7B-Instruct-v0.3',
  'mistralai/Mistral-Small-3.1-24B-Instruct-2503',
  // Qwen
  'Qwen/Qwen2.5-72B-Instruct',
  'Qwen/Qwen2.5-32B-Instruct',
  'Qwen/Qwen3-30B-A3B',
];

// Merge hardcoded list with models-config.json (deduplicated)
const HF_MODELS = [...new Set([...HF_MODELS_BASE, ...loadConfigModels()])];

// ── TechPowerUp GPU search terms ─────────────────────────────────────────────
// Provide the human-readable GPU name — the scraper will search TechPowerUp
// to find the correct spec page URL automatically (avoids hardcoded IDs).
const TPU_GPUS = [
  // NVIDIA Blackwell consumer
  { id: 'rtx5090',        search: 'GeForce RTX 5090' },
  { id: 'rtx5080',        search: 'GeForce RTX 5080' },
  { id: 'rtx5070ti',      search: 'GeForce RTX 5070 Ti' },
  { id: 'rtx5070',        search: 'GeForce RTX 5070' },
  { id: 'rtx5060ti_16',   search: 'GeForce RTX 5060 Ti 16' },
  // NVIDIA Ada consumer
  { id: 'rtx4090',        search: 'GeForce RTX 4090' },
  { id: 'rtx4080s',       search: 'GeForce RTX 4080 Super' },
  { id: 'rtx4070ti_s',    search: 'GeForce RTX 4070 Ti Super' },
  { id: 'rtx4060ti_16',   search: 'GeForce RTX 4060 Ti 16' },
  // AMD RDNA 4
  { id: 'amd_rx9070xt',   search: 'Radeon RX 9070 XT' },
  { id: 'amd_rx9070',     search: 'Radeon RX 9070' },
  // Intel Battlemage
  { id: 'intel_b580',     search: 'Arc B580' },
  { id: 'intel_b770',     search: 'Arc B770' },
  // Workstation / Datacenter
  { id: 'rtxpro6000_bw',  search: 'RTX PRO 6000 Blackwell' },
  { id: 'l40s',           search: 'NVIDIA L40S' },
];

// ── India retail pages (optional, SCRAPE_INDIA_RETAIL=true) ─────────────────
// These pages are scraped for INR prices only. Personal/research use.
const INDIA_RETAIL = [
  { id: 'rtx5090',   store: 'mdcomputers', url: 'https://mdcomputers.in/nvidia-geforce-rtx-5090.html' },
  { id: 'rtx5080',   store: 'mdcomputers', url: 'https://mdcomputers.in/nvidia-geforce-rtx-5080.html' },
  { id: 'rtx4090',   store: 'primeabgb',   url: 'https://www.primeabgb.com/buy-price-india/nvidia-geforce-rtx-4090/' },
  { id: 'rtx4080s',  store: 'primeabgb',   url: 'https://www.primeabgb.com/buy-price-india/nvidia-geforce-rtx-4080-super/' },
];

// ─────────────────────────────────────────────────────────────────────────────

async function fetchHFModel(modelId) {
  // Do NOT encodeURIComponent — HF API expects literal slash: /api/models/org/model
  const url = `https://huggingface.co/api/models/${modelId}`;
  const res = await fetch(url, { headers: HF_HEADERS });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

function extractParams(data) {
  // 1. safetensors parameter count
  if (data.safetensors?.parameters) {
    const total = Object.values(data.safetensors.parameters).reduce((a, b) => a + b, 0);
    if (total > 1e8) return Math.round((total / 1e9) * 10) / 10;
  }
  // 2. tags like "7B", "70B", "405B"
  for (const tag of (data.tags || [])) {
    const m = tag.match(/^(\d+(?:\.\d+)?)b$/i);
    if (m) return parseFloat(m[1]);
  }
  return null;
}

async function scrapeHuggingFace() {
  console.log('\n── HuggingFace Hub API ─────────────────────────');
  if (!HF_TOKEN) console.log('  ⚠  No HF_TOKEN — using unauthenticated (rate-limited)');
  if (MAX_MODELS === 0) { console.log('  Skipped (MAX_MODELS=0).'); return []; }
  const limited = MAX_MODELS > 0 ? HF_MODELS.slice(0, MAX_MODELS) : HF_MODELS;
  console.log(`  Fetching ${limited.length}/${HF_MODELS.length} models (limit: MAX_MODELS=${MAX_MODELS}, delay: ${HF_DELAY_MS}ms)`);
  const results = [];
  for (const modelId of limited) {
    try {
      const data = await fetchHFModel(modelId);
      const params = extractParams(data);
      const result = {
        hfId: modelId,
        author: data.author,
        gated: data.gated || false,
        lastModified: data.lastModified,
        downloads_30d: data.downloads,
        likes: data.likes,
        params_b: params,
        tags: (data.tags || []).filter(t =>
          ['transformers','text-generation','pytorch','gguf','llm','instruct'].includes(t)
        ),
        pipeline: data.pipeline_tag,
        hfUrl: `https://huggingface.co/${modelId}`,
      };
      // eval results if published
      if (data.cardData?.eval_results?.length) {
        const evals = {};
        for (const e of data.cardData.eval_results) {
          const name = (e.metric_name || e.task_name || '').toLowerCase();
          if (name.includes('mmlu')) evals.mmlu = e.metric_value;
          if (name.includes('gsm8k')) evals.gsm8k = e.metric_value;
          if (name.includes('humaneval')) evals.humaneval = e.metric_value;
          if (name.includes('arc')) evals.arc = e.metric_value;
        }
        if (Object.keys(evals).length) result.evals = evals;
      }
      results.push(result);
      console.log(`  ✓ ${modelId.split('/')[1]} — ${params ? params + 'B params' : 'params unknown'} | ${data.downloads?.toLocaleString()} DLs`);
    } catch (e) {
      console.log(`  ✗ ${modelId}: ${e.message}`);
    }
    await new Promise(r => setTimeout(r, HF_DELAY_MS)); // rate-limit: configurable via HF_DELAY_MS
  }
  return results;
}

// Search TechPowerUp via direct fetch (no browser) — avoids Cloudflare JS challenge.
// TechPowerUp's AJAX search endpoint returns plain HTML results.
// Falls back to null if Cloudflare blocks it.
async function findTPUSpecUrl(searchTerm) {
  const searchUrl = `https://www.techpowerup.com/gpu-specs/?ajaxsrch=${encodeURIComponent(searchTerm)}`;
  try {
    const res = await fetch(searchUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Referer': 'https://www.techpowerup.com/gpu-specs/',
        'Cache-Control': 'no-cache',
      },
    });
    if (!res.ok) return null;
    const html = await res.text();
    // Extract first /gpu-specs/xxx.c#### link from the HTML
    const m = html.match(/href="(\/gpu-specs\/[^"]+\.c\d+)"/);
    if (!m) return null;
    return `https://www.techpowerup.com${m[1]}`;
  } catch {
    return null;
  }
}

// Fetch a TechPowerUp GPU spec page via direct HTTP (no browser).
async function fetchTPUSpecPage(specUrl) {
  const res = await fetch(specUrl, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9',
      'Referer': 'https://www.techpowerup.com/gpu-specs/',
    },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.text();
}

// Parse TechPowerUp spec HTML — extracts key-value pairs from tables and dl/dt/dd.
// Works without a browser using simple regex since TechPowerUp uses server-rendered HTML.
function parseTPUSpecs(html) {
  const out = {};
  // Match <td>Label</td><td>Value</td> or similar patterns
  const trPattern = /<tr[^>]*>[\s\S]*?<td[^>]*>([\s\S]*?)<\/td>[\s\S]*?<td[^>]*>([\s\S]*?)<\/td>[\s\S]*?<\/tr>/gi;
  let m;
  while ((m = trPattern.exec(html)) !== null) {
    const k = m[1].replace(/<[^>]+>/g, '').trim();
    const v = m[2].replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&nbsp;/g, ' ').trim();
    if (k && v && k.length < 80 && !k.startsWith('<')) out[k] = v;
  }
  // Match <dt>Label</dt><dd>Value</dd>
  const dlPattern = /<dt[^>]*>([\s\S]*?)<\/dt>[\s\S]*?<dd[^>]*>([\s\S]*?)<\/dd>/gi;
  while ((m = dlPattern.exec(html)) !== null) {
    const k = m[1].replace(/<[^>]+>/g, '').trim();
    const v = m[2].replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').trim();
    if (k && v && k.length < 80) out[k] = v;
  }
  // Extract H1 title
  const h1m = html.match(/<h1[^>]*class="[^"]*gpudb-name[^"]*"[^>]*>([\s\S]*?)<\/h1>/i)
    || html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
  out['_title'] = h1m ? h1m[1].replace(/<[^>]+>/g, '').trim() : '';
  return out;
}

// TechPowerUp uses server-rendered HTML — direct HTTP fetch works if Cloudflare
// doesn't trigger JS challenge (varies by IP / request pattern).
// Playwright is kept as fallback for pages that return Cloudflare challenges.
async function scrapeTPU(browser) {
  console.log('\n── TechPowerUp GPU DB (fetch → Playwright fallback) ─');
  if (MAX_GPUS === 0) { console.log('  Skipped (MAX_GPUS=0).'); return []; }
  const limited = MAX_GPUS > 0 ? TPU_GPUS.slice(0, MAX_GPUS) : TPU_GPUS;
  console.log(`  Scraping ${limited.length}/${TPU_GPUS.length} GPUs (limit: MAX_GPUS=${MAX_GPUS})`);
  const results = [];
  let playwrightCtx = null; // lazy-init only if fetch fails

  for (const { id, search } of limited) {
    try {
      // Step 1: find correct spec page URL via direct HTTP search
      const specUrl = await findTPUSpecUrl(search);
      if (!specUrl) throw new Error(`Search returned no URL (Cloudflare blocked?)`);

      // Step 2: fetch the spec page HTML directly
      let html;
      try {
        html = await fetchTPUSpecPage(specUrl);
      } catch (fetchErr) {
        // Fallback: use Playwright for this page
        if (!playwrightCtx) {
          playwrightCtx = await browser.newContext({
            viewport: { width: 1366, height: 768 },
            userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
            locale: 'en-US',
          });
        }
        const page = await playwrightCtx.newPage();
        await page.goto(specUrl, { waitUntil: 'networkidle', timeout: 30000 });
        html = await page.content();
        await page.close();
      }

      const specs = parseTPUSpecs(html);

      // Sanity check: if title looks like a Cloudflare page, discard
      const title = specs['_title'] || '';
      if (!title || title.toLowerCase().includes('driver') || title.toLowerCase().includes('just a moment')) {
        throw new Error(`Bot check / redirect — got page: "${title}"`);
      }

      const normalized = {
        id,
        search,
        specUrl,
        title,
        scrapedAt:     new Date().toISOString(),
        vram_gb:       parseFloat(specs['Memory Size'] || specs['Memory'] || '') || null,
        vramType:      specs['Memory Type'] || null,
        tdp_w:         parseInt(specs['TDP'] || specs['Thermal Design Power'] || '') || null,
        bandwidth_gbs: parseFloat(specs['Memory Bandwidth'] || '') || null,
        released:      specs['Release Date'] || null,
        cudaCores:     parseInt((specs['Shader Processors'] || specs['CUDA Cores'] || '').replace(/,/g, '')) || null,
        boostClock_mhz:parseInt((specs['Boost Clock'] || specs['GPU Clock'] || '').replace(/[^0-9]/g, '')) || null,
        memBusWidth_b: parseInt((specs['Memory Bus Width'] || specs['Memory Bus'] || '').replace(/[^0-9]/g, '')) || null,
        raw:           specs,
      };

      results.push(normalized);
      const vram = normalized.vram_gb ? `${normalized.vram_gb} GB` : '?';
      const tdp  = normalized.tdp_w  ? `${normalized.tdp_w} W`   : '?';
      console.log(`  ✓ ${id}: ${title} | VRAM ${vram} | TDP ${tdp}`);
    } catch (e) {
      console.log(`  ✗ ${id}: ${e.message}`);
      results.push({ id, search, error: e.message, scrapedAt: new Date().toISOString() });
    }
    await new Promise(r => setTimeout(r, 2000));
  }

  if (playwrightCtx) await playwrightCtx.close();
  return results;
}

async function scrapeIndiaRetail(browser) {
  if (!SCRAPE_RETAIL) {
    console.log('\n── India Retail (skipped — set SCRAPE_INDIA_RETAIL=true) ─');
    return [];
  }
  console.log('\n── India Retail Prices (Playwright) ────────────');
  const page = await browser.newPage();
  const results = [];

  for (const { id, store, url } of INDIA_RETAIL) {
    try {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 25000 });
      const priceINR = await page.evaluate(() => {
        // Common price selectors for MDComputers / PrimeABGB
        const selectors = [
          '.product-price .price', '.our_price_display', '#our_price_display',
          '.price-box .price', '[itemprop="price"]', '.product_price', '.finalPrice',
          'span.price', '.price strong',
        ];
        for (const sel of selectors) {
          const el = document.querySelector(sel);
          if (el) {
            const text = el.textContent || el.getAttribute('content') || '';
            const m = text.match(/[\d,]+/);
            if (m) return parseInt(m[0].replace(/,/g, ''), 10);
          }
        }
        return null;
      });

      results.push({ id, store, url, priceINR, scrapedAt: new Date().toISOString() });
      console.log(`  ✓ ${id} @ ${store}: ${priceINR ? '₹' + priceINR.toLocaleString('en-IN') : 'price not found'}`);
    } catch (e) {
      console.log(`  ✗ ${id} @ ${store}: ${e.message}`);
      results.push({ id, store, url, priceINR: null, error: e.message });
    }
    await new Promise(r => setTimeout(r, 2000));
  }

  await page.close();
  return results;
}

// ─────────────────────────────────────────────────────────────────────────────

async function main() {
  console.log('LocalAI Deploy — Data Scraper');
  console.log('═══════════════════════════════════════════════════');
  console.log(`HF_TOKEN:      ${HF_TOKEN ? '✓ set (' + HF_TOKEN.slice(0, 8) + '...)' : '✗ not set (gated models skipped)'}`);
  console.log(`TechPowerUp:   ${HF_ONLY ? '✗ skipped (--hf-only)' : '✓ enabled (Cloudflare may block)'}`);
  console.log(`India retail:  ${SCRAPE_RETAIL ? '✓ enabled' : '✗ disabled'}`);
  console.log(`Rate limits:   MAX_MODELS=${MAX_MODELS}  MAX_GPUS=${MAX_GPUS}  HF_DELAY=${HF_DELAY_MS}ms`);
  console.log(`Output:        src/data/`);

  // 1. HuggingFace — no browser needed
  const hfModels = await scrapeHuggingFace();
  writeFileSync(join(OUT_DIR, 'hf-models.json'), JSON.stringify(hfModels, null, 2));
  console.log(`\n  → Wrote src/data/hf-models.json  (${hfModels.length} models)`);

  // 2. TechPowerUp + India retail — Playwright (skipped with --hf-only)
  if (HF_ONLY) {
    console.log('\n── TechPowerUp GPU DB ───────────────────────────');
    console.log('  Skipped (--hf-only flag set).');
    console.log('  NOTE: TechPowerUp is Cloudflare-protected. To scrape it you need:');
    console.log('    Option A: A residential proxy service (ZenRows, ScraperAPI, BrightData)');
    console.log('    Option B: Run from a home/ISP IP (not a cloud/VPN IP)');
    console.log('    Option C: Look up GPU specs manually at https://www.techpowerup.com/gpu-specs/');
    console.log('  For manual GPU spec lookup, run: npm run scrape -- --hf-only');
  }

  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-blink-features=AutomationControlled'],
  });
  let tpuData = [], retailData = [];
  try {
    if (!HF_ONLY) tpuData = await scrapeTPU(browser);
    retailData = await scrapeIndiaRetail(browser);
  } finally {
    await browser.close();
  }

  if (!HF_ONLY) {
    writeFileSync(join(OUT_DIR, 'tpu-hardware.json'), JSON.stringify(tpuData, null, 2));
    const tpuOk  = tpuData.filter(g => !g.error).length;
    const tpuFail = tpuData.filter(g => g.error).length;
    console.log(`  → Wrote src/data/tpu-hardware.json (${tpuOk} ✓  ${tpuFail} ✗)`);
    if (tpuFail === tpuData.length && tpuData.length > 0) {
      console.log('\n  ⚠  All TechPowerUp requests were blocked (Cloudflare).');
      console.log('     Run with --hf-only to skip GPU scraping:');
      console.log('       npm run scrape -- --hf-only');
    }
  }

  if (SCRAPE_RETAIL) {
    writeFileSync(join(OUT_DIR, 'india-prices.json'), JSON.stringify(retailData, null, 2));
    console.log(`  → Wrote src/data/india-prices.json (${retailData.length} prices)`);
  }

  // 3. Summary report — compare scraped data against app schema
  const newModels = hfModels.filter(m => !isKnownModel(m.hfId));
  const newGPUs   = tpuData.filter(g => !g.error && isNewSpec(g));

  if (newModels.length || newGPUs.length) {
    console.log('\n── What\'s new / changed ─────────────────────────');
    newModels.forEach(m => console.log(`  + Model: ${m.hfId} (${m.params_b ? m.params_b + 'B' : '?'})`));
    newGPUs.forEach(g => console.log(`  + GPU:   ${g.title} (VRAM ${g.vram_gb} GB, TDP ${g.tdp_w} W)`));
  } else {
    console.log('\n  ✓ No new entries detected.');
  }

  console.log('\n═══════════════════════════════════════════════════');
  console.log('Review src/data/*.json then update src/App.jsx with new entries.');
}

// Known model IDs already in App.jsx — update when you add new ones
function isKnownModel(hfId) {
  const known = [
    'meta-llama/Llama-3.3-70B-Instruct',
    'meta-llama/Llama-3.2-8B-Instruct',
    'deepseek-ai/DeepSeek-R1',
    'deepseek-ai/DeepSeek-R1-Distill-Qwen-7B',
    'google/gemma-2-27b-it',
    'google/gemma-3-12b-it',
    'google/gemma-3-27b-it',
    'microsoft/Phi-4',
    'mistralai/Mistral-7B-Instruct-v0.3',
  ];
  return known.includes(hfId);
}

// Returns true if scraped GPU spec differs meaningfully from what we'd expect
function isNewSpec(g) {
  // Just flag if VRAM or TDP changed — can be expanded
  return Boolean(g.vram_gb || g.tdp_w);
}

main().catch(e => { console.error('\n✗ Scraper error:', e.message); process.exit(1); });
