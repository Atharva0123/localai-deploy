# localai-deploy

> Compare every GPU, TPU & NPU for local AI deployment — live hardware specs, model benchmarks across all quantization formats, KV-cache analysis, and cost-aware build planning.

[![Live Demo](https://img.shields.io/badge/Live_Demo-localai--deploy.vercel.app-10C896?style=flat-square)](https://localai-deploy.vercel.app/)
[![Vite](https://img.shields.io/badge/Vite-8-646CFF?style=flat-square&logo=vite)](https://vitejs.dev/)
[![React](https://img.shields.io/badge/React-19-61DAFB?style=flat-square&logo=react)](https://react.dev/)
[![Vercel](https://img.shields.io/badge/Deployed_on-Vercel-000000?style=flat-square&logo=vercel)](https://vercel.com/)
[![Weekly Refresh](https://img.shields.io/badge/Data-Weekly_Refresh-4B9EFF?style=flat-square)](https://github.com/Atharva0123/localai-deploy/actions)
[![License](https://img.shields.io/badge/License-MIT-blue?style=flat-square)](LICENSE)

---

## Overview

**localai-deploy** is a single-page reference tool for anyone planning a local AI inference or training stack. Pick a GPU, pick a model, and instantly see whether the hardware fits — VRAM requirements, token throughput, quantization tradeoffs, and real-world benchmark scores all in one place.

**No backend. No login. No data sent anywhere.** Everything runs in the browser.

---

## Features

| Feature | Description |
|---|---|
| **Hardware Database** | 80+ GPUs spanning datacenter, workstation, consumer, and edge — filtered by brand, VRAM, price, and segment |
| **Models Database** | 30+ LLMs with quantization formats (BF16 → Q2_K), VRAM requirements, and HuggingFace links |
| **GPU Connectors** | NVLink multi-GPU guide + native PCIe 5.0 x16 platform compatibility with supported motherboards |
| **Benchmarks** | MMLU, HellaSwag, ARC, GSM8K, HumanEval scores per model |
| **Stress Tests** | Tokens/second and VRAM utilization across hardware × model combinations |
| **Quantization Guide** | Per-quant file size, quality rating, perplexity delta, and achievable inference speed |
| **KV-Cache Analysis** | Memory cost estimates for context lengths up to 128K tokens |
| **Cost Planning** | USD + INR pricing with retailer badges and in-stock status |

---

## Hardware Database

### NVIDIA — Datacenter

| ID | Name | VRAM | BW | TDP | Interface | NVLink |
|---|---|---|---|---|---|---|
| `b300_sxm` | B300 Tensor Core GPU | 288 GB HBM3e | 10,000 GB/s | 1200 W | SXM6 | ✓ |
| `b200_sxm` | B200 Tensor Core GPU | 192 GB HBM3e | 8,000 GB/s | 1000 W | SXM6 | ✓ |
| `gb200_superchip` | GB200 Grace Blackwell Superchip | 384 GB HBM3e | 16,000 GB/s | 2700 W | NVLink Chip | ✓ |
| `h200_sxm` | H200 SXM5 | 141 GB HBM3e | 4,800 GB/s | 700 W | SXM5 | ✓ |
| `h100_sxm` | H100 SXM5 | 80 GB HBM3 | 3,350 GB/s | 700 W | SXM5 | ✓ |
| `h100_nvl` | **H100 NVL** | 94 GB HBM2e | 2,400 GB/s | 400 W | PCIe 5.0 x16 | ✓ (NVLink 4.0) |
| `h100_pcie` | H100 PCIe | 80 GB HBM2e | 2,000 GB/s | 350 W | PCIe 5.0 x16 | — |
| `l40s` | L40S | 48 GB GDDR6 ECC | 864 GB/s | 350 W | PCIe 4.0 x16 | — |
| `l4` | L4 | 24 GB GDDR6 ECC | 300 GB/s | 72 W | PCIe 4.0 x16 | — |
| `a100_80_sxm` | A100 80 GB SXM4 | 80 GB HBM2e | 2,000 GB/s | 400 W | SXM4 | ✓ |
| `a100_40` | A100 40 GB | 40 GB HBM2 | 1,555 GB/s | 300 W | PCIe 4.0 x16 | ✓ |

### NVIDIA — Workstation Blackwell (PCIe 5.0 · No NVLink)

> All RTX PRO Blackwell workstation and server cards connect via **native PCIe 5.0 x16**. NVLink is **not supported** on any edition below.

| ID | Name | VRAM | BW | TDP | Price (USD) |
|---|---|---|---|---|---|
| `rtxpro6000_bw_server` | **RTX PRO 6000 Blackwell Server Edition** | 96 GB GDDR7 ECC | 1,792 GB/s | 450 W | ~$11,000 |
| `rtxpro6000_bw` | **RTX PRO 6000 Blackwell Workstation Edition** | 96 GB GDDR7 ECC | 1,792 GB/s | 300 W | ~$8,000 |
| `rtxpro6000_bw_maxq` | **RTX PRO 6000 Blackwell Max-Q Workstation Edition** | 96 GB GDDR7 ECC | 1,344 GB/s | 175 W | ~$7,500 |
| `rtxpro5000_bw` | RTX PRO 5000 Blackwell | 48 GB GDDR7 ECC | 960 GB/s | 250 W | ~$4,000 |
| `rtxpro4500_bw` | RTX PRO 4500 Blackwell | 24 GB GDDR7 ECC | 576 GB/s | 165 W | ~$2,500 |
| `rtxpro4000_bw` | RTX PRO 4000 Blackwell | 20 GB GDDR7 ECC | 448 GB/s | 130 W | ~$1,500 |
| `rtxpro2000_bw` | RTX PRO 2000 Blackwell | 16 GB GDDR7 ECC | 288 GB/s | 70 W | ~$625 |

### NVIDIA — Consumer Blackwell (RTX 50-series, PCIe 5.0)

| ID | Name | VRAM | BW | TDP | Price (USD) |
|---|---|---|---|---|---|
| `rtx5090` | GeForce RTX 5090 | 32 GB GDDR7 | 1,792 GB/s | 575 W | $1,999 |
| `rtx5080` | GeForce RTX 5080 | 16 GB GDDR7 | 960 GB/s | 360 W | $999 |
| `rtx5070ti` | GeForce RTX 5070 Ti | 16 GB GDDR7 | 896 GB/s | 300 W | $749 |
| `rtx5070` | GeForce RTX 5070 | 12 GB GDDR7 | 672 GB/s | 250 W | $549 |
| `rtx5060ti_16` | GeForce RTX 5060 Ti 16 GB | 16 GB GDDR7 | 576 GB/s | 180 W | $499 |

### AMD, Intel, Apple

The live app also includes AMD Instinct MI300X/MI325X/MI355X (datacenter), AMD Radeon PRO W-series (workstation), AMD RX 9070 XT (consumer), Intel Arc B580/B770, Intel Gaudi 2/3, and Apple M4/M3/M2 Ultra/Max/Pro chips. See [the live app](https://localai-deploy.vercel.app/) for the full list.

---

## GPU Connectors

### NVLink

NVLink enables direct high-bandwidth GPU-to-GPU communication, bypassing the CPU and host memory bus. This is the required interconnect for multi-GPU inference on models that exceed single-GPU VRAM (e.g., running DeepSeek-R1 671B or Llama 3.3 70B at BF16 precision).

| NVLink Gen | Bidirectional BW | Compatible Products |
|---|---|---|
| NVLink 4.0 | 900 GB/s per GPU | H100 NVL, H200 SXM, B200, B300, GB200 |
| NVLink 3.0 | 600 GB/s per GPU | A100 SXM, A30 |
| NVLink 2.0 (bridge) | 100 GB/s | RTX 3090, RTX 3090 Ti (consumer NVLink bridge) |

> **RTX PRO 6000 Blackwell (Server, Workstation, Max-Q)** — These cards are PCIe 5.0 x16 **only**. NVLink is not supported on any RTX PRO Blackwell edition.

---

### Native PCIe 5.0 x16

PCIe 5.0 provides 64 GB/s per x16 slot (vs 32 GB/s on PCIe 4.0), reducing the CPU↔GPU transfer bottleneck for streaming large models or batched inference pipelines.

Cards that require a PCIe 5.0 host slot for full bandwidth: RTX PRO 6000/5000/4500/4000/2000 Blackwell, RTX 50-series, AMD MI300X/MI325X/MI355X, AMD RX 9070/9070 XT, AMD Radeon PRO W9000, H100 PCIe, H100 NVL.

#### Workstation Platforms

**Intel W790** (LGA4677 socket — Intel Xeon W 2400/3400 processors)

| Motherboard | PCIe 5.0 x16 Slots | Notes |
|---|---|---|
| ASUS Pro WS W790-ACE | 5 | ECC RDIMM/LRDIMM support, 8× DDR5 |
| ASUS Pro WS W790E-SAGE SE | 7 | Extended ATX, 8× DDR5, up to 2 TB ECC RAM |

**AMD WRX90** (SP6 socket — AMD Threadripper PRO 7000 series)

| Motherboard | PCIe 5.0 x16 Slots | Notes |
|---|---|---|
| ASUS Pro WS WRX90E-SAGE SE | 7 | 8× DDR5 ECC RDIMM, up to 2 TB RAM, 128 PCIe 5.0 lanes |

#### Consumer / HEDT Platforms

| Platform | Representative Boards | PCIe 5.0 x16 Slots |
|---|---|---|
| Intel Z790 (LGA1700) | ASUS ROG Maximus Z790 Apex | 1 |
| Intel Z890 (LGA1851) | ASUS ROG Maximus Z890 Apex | 1 |
| AMD X670E (AM5) | ASUS ROG Crosshair X670E Gene, Gigabyte X670E Aorus Master | 1 |
| AMD X870E (AM5) | MSI MEG X870E ACE, ASUS ROG Crosshair X870E Hero | 1–2 |

> **Multi-GPU with PCIe 5.0:** For running two or more PCIe 5.0 x16 cards simultaneously (without NVLink), use the W790 or WRX90 workstation platforms. Consumer Z790/X670E boards expose only a single PCIe 5.0 x16 slot — secondary slots run at PCIe 4.0 or lower.

---

## AI Models Database

| Model | Params | License | Min VRAM (Q4_K_M) | Context |
|---|---|---|---|---|
| Llama 3.3 | 70B | Llama 3.3 Community | ~40 GB | 128K |
| Llama 3.1 | 8B | Llama 3.1 Community | ~5 GB | 128K |
| DeepSeek-R1 | 671B | MIT | ~400 GB | 64K |
| Gemma 3 | 27B | Gemma ToU | ~15 GB | 128K |
| Phi-4 | 14B | MIT | ~8 GB | 16K |
| Qwen 2.5 | 72B | Apache 2.0 | ~42 GB | 128K |
| Mistral 7B v0.3 | 7B | Apache 2.0 | ~4 GB | 32K |

Full model list with all quantization formats, benchmark scores, and HuggingFace links is available in the [live app](https://localai-deploy.vercel.app/).

---

## Project Structure

```
localai-deploy/
├── src/
│   ├── App.jsx              # Main component — all hardware data, model data, UI logic (~4200 lines)
│   ├── App.css              # Component-scoped styles
│   ├── index.css            # Global CSS variables and resets
│   ├── main.jsx             # React 19 entry point
│   └── data/
│       ├── hf-models.json       # HuggingFace model metadata (auto-refreshed weekly)
│       └── tpu-hardware.json    # TPU/accelerator scrape results
├── scripts/
│   ├── scrape.js                # Data pipeline: HF API + TechPowerUp scraper + India retail
│   └── models-config.json       # Scraper target list (which models/GPUs to fetch)
├── public/
│   ├── favicon.svg
│   ├── og-image.svg
│   ├── icons.svg
│   ├── sitemap.xml
│   ├── robots.txt
│   └── site.webmanifest
├── .github/
│   └── workflows/
│       └── refresh-data.yml     # Weekly cron: scrapes HF + commits updated JSON
├── .claude/
│   └── settings.json            # Claude Code permission rules for this repo
├── index.html                   # Vite entry HTML
├── vite.config.js
├── vercel.json                  # Security headers (HSTS, CSP, COEP) + SPA rewrites
├── eslint.config.js
└── package.json
```

**Architecture note:** This is intentionally a **zero-backend single-file app**. All hardware and model data lives as JS arrays in `src/App.jsx` and is bundled at build time. The only runtime data fetching is the optional INR currency conversion via the [Frankfurter API](https://www.frankfurter.dev/).

---

## Development Setup

### Prerequisites

- Node.js 20+
- npm 9+

### Install and run locally

```bash
git clone https://github.com/Atharva0123/localai-deploy.git
cd localai-deploy
npm install
npm run dev        # → http://localhost:5173
```

### Build for production

```bash
npm run build      # outputs to dist/
npm run preview    # serve the dist/ build locally
```

### Lint

```bash
npm run lint
```

---

## Data Scripts

### Scrape HuggingFace model metadata

```bash
# Recommended: set your HF token to avoid rate limits
export HF_TOKEN=hf_xxxxxxxxxxxxxxxxxxxx

npm run scrape:hf
```

### Scrape GPU specs + India retail prices

```bash
# First time: install the Playwright Chromium browser
npm run scrape:setup

# Run full scrape (TechPowerUp GPU specs + optional India retail prices)
npm run scrape
```

### Environment variables

| Variable | Default | Description |
|---|---|---|
| `HF_TOKEN` | — | HuggingFace API token (optional; raises rate limits) |
| `MAX_MODELS` | `20` | Max models to fetch per scrape run |
| `MAX_GPUS` | `15` | Max GPUs to scrape from TechPowerUp |
| `HF_DELAY_MS` | `400` | Delay between HF API requests (ms) |
| `SCRAPE_INDIA_RETAIL` | `false` | Set `true` to enable India retail price scraping |

---

## Automated Weekly Refresh

A GitHub Actions workflow runs every **Sunday at 00:00 UTC**:

1. Fetches updated model metadata from the HuggingFace API
2. Optionally scrapes India retail GPU prices (enabled via the `SCRAPE_INDIA_RETAIL` repository variable)
3. Commits any changed files in `src/data/` with `[skip ci]` in the message

**To trigger manually:** Actions → *Weekly Data Refresh* → *Run workflow*

**To enable India retail scraping:** Settings → Variables → Actions → set `SCRAPE_INDIA_RETAIL` = `true`

The workflow requires a `HF_TOKEN` secret for higher HuggingFace API rate limits (Settings → Secrets → Actions).

---

## Deployment

The app auto-deploys to Vercel on every push to `main`:

```bash
git add src/App.jsx      # or whichever files changed
git commit -m "feat: add RTX PRO 6000 Blackwell Server Edition"
git push origin main
# Vercel build starts automatically (~30s)
```

**Pre-push check (recommended):**

```bash
npm run build && git push origin main
```

Security headers configured in `vercel.json`: HSTS, Content-Security-Policy, X-Frame-Options DENY, COEP/COOP same-origin, Permissions-Policy, and immutable caching for static assets.

---

## Contributing

1. Fork the repository
2. Add or update hardware entries in the `ALL_HW` array in `src/App.jsx`
3. Add or update model entries in the `MODELS` array in `src/App.jsx`
4. Run `npm run build` to verify the build passes with no errors
5. Open a pull request with a clear description of what was added/changed

### Hardware object schema

```javascript
{
  id: "rtxpro6000_bw_server",              // unique snake_case identifier
  name: "NVIDIA RTX PRO 6000 Blackwell Server Edition",
  shortName: "RTX PRO 6000 Server",
  brand: "NVIDIA",                          // NVIDIA | AMD | Intel | Apple
  series: "RTX PRO Blackwell",
  gen: "Blackwell",                         // chip generation
  segment: "workstation",                   // datacenter | workstation | consumer | edge
  vram: 96,                                 // GB
  vramType: "GDDR7 ECC",
  bandwidth: 1792,                          // GB/s
  tdp: 450,                                 // Watts
  pcie: "PCIe 5.0 x16",                    // host interface
  nvlink: false,                            // NVLink support
  priceUSD: 11000,
  inStock: true,
  released: "2025-05",                      // YYYY-MM
  rating: 9.1,                              // 0–10 AI inference suitability
  notes: "Rack-mount server form factor. Passive cooling for chassis airflow. PCIe 5.0 x16 only — no NVLink.",
  useCase: ["LLM Inference", "LLM Training", "RAG", "Vision"]
}
```

---

## License

MIT © [Atharva0123](https://github.com/Atharva0123)
