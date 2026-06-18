import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import HF_RAW from "./data/hf-models.json";

// ─── CONSTANTS ────────────────────────────────────────────────────────────────
const USD_TO_INR = 83.5;
// Mutable live rate — updated by the Frankfurter API fetch in App; fallback = USD_TO_INR
let _liveRate = USD_TO_INR;

const SOURCES = {
  nvidia_official:{name:"NVIDIA Official",url:"https://www.nvidia.com/en-us/shop/",badge:"Official"},
  techpowerup:{name:"TechPowerUp GPU DB",url:"https://www.techpowerup.com/gpu-specs/",badge:"Specs DB"},
  amazon_us:{name:"Amazon US",url:"https://www.amazon.com/",badge:"Retail"},
  amazon_in:{name:"Amazon India",url:"https://www.amazon.in/",badge:"Retail IN"},
  newegg:{name:"Newegg",url:"https://www.newegg.com/",badge:"Retail"},
  md_computers:{name:"MD Computers India",url:"https://mdcomputers.in/",badge:"India"},
  nvidia_ai:{name:"NVIDIA AI Enterprise",url:"https://www.nvidia.com/en-us/data-center/",badge:"Enterprise"},
  primeabgb:{name:"PrimeABGB India",url:"https://www.primeabgb.com/",badge:"India"},
  redington:{name:"Redington India",url:"https://www.redingtonindia.com/",badge:"Distributor"},
  amd_official:{name:"AMD Official",url:"https://www.amd.com/en/graphics",badge:"Official"},
  amd_pro:{name:"AMD Radeon PRO",url:"https://www.amd.com/en/products/professional-graphics",badge:"Workstation"},
  intel_official:{name:"Intel Official",url:"https://www.intel.com/content/www/us/en/products/details/discrete-gpus.html",badge:"Official"},
  apple_official:{name:"Apple Official",url:"https://www.apple.com/mac/",badge:"Official"},
  intel_gaudi:{name:"Intel Gaudi AI",url:"https://habana.ai/",badge:"Gaudi"},
  huggingface_gemma:{name:"HuggingFace Gemma",url:"https://huggingface.co/google",badge:"Google"},
  huggingface_phi:{name:"HuggingFace Phi",url:"https://huggingface.co/microsoft",badge:"Microsoft"},
  llm_leaderboard:{name:"Open LLM Leaderboard",url:"https://huggingface.co/spaces/open-llm-leaderboard/open_llm_leaderboard",badge:"Benchmark"},
  gguf_quant:{name:"llama.cpp Benchmarks",url:"https://github.com/ggerganov/llama.cpp",badge:"Open Source"},
  huggingface:{name:"Hugging Face",url:"https://huggingface.co/models",badge:"Models"},
};

// ─── LIVE HUGGINGFACE DATA (refreshed weekly by GitHub Actions) ───────────────
// Keyed by hfId ("org/model-name") — matched against model.hfUrl at render time
const HF_LIVE = Object.fromEntries((HF_RAW||[]).map(m=>[m.hfId,m]));
function fmtDL(n){if(!n)return null;if(n>=1e6)return(n/1e6).toFixed(1)+"M";if(n>=1e3)return Math.round(n/1e3)+"K";return String(n);}
function fmtAge(iso){if(!iso)return null;const d=new Date(iso),now=new Date();const dy=Math.round((now-d)/864e5);if(dy<30)return dy+"d ago";if(dy<365)return Math.round(dy/30)+"mo ago";return Math.round(dy/365)+"yr ago";}

// ─── ALL HARDWARE DATA ─────────────────────────────────────────────────────────
const ALL_HW = [
  // ── NVIDIA Blackwell Data Center ──
  {id:"b200_sxm",name:"NVIDIA B200 Tensor Core GPU",shortName:"B200 SXM",brand:"NVIDIA",series:"Blackwell DC",gen:"Blackwell",segment:"datacenter",vram:192,vramType:"HBM3e",priceUSD:40000,tdp:1000,bandwidth:8000,fp16:2250,fp8:4500,int8:9000,fp4:18000,nvlink:true,pcie:"SXM6",released:"2024-Q4",rating:10.0,inStock:false,sources:["nvidia_ai","nvidia_official"],notes:"192 GB HBM3e, 4500 TFLOPS FP8.",topology:"GB100",cudaCores:20480,tensorCores:640,memBusWidth:8192,boostClockMHz:1830,useCase:["LLM Training","LLM Inference","RAG","Vision"],tokensPerSec:{llama70b:220,llama8b:1800,mistral7b:2000}},
  {id:"b300_sxm",name:"NVIDIA B300 Tensor Core GPU",shortName:"B300 SXM",brand:"NVIDIA",series:"Blackwell DC",gen:"Blackwell Ultra",segment:"datacenter",vram:288,vramType:"HBM3e",priceUSD:55000,tdp:1200,bandwidth:10000,fp16:3000,fp8:6000,int8:12000,fp4:24000,nvlink:true,pcie:"SXM6",released:"2025-Q2",rating:10.0,inStock:false,sources:["nvidia_ai","nvidia_official"],notes:"288 GB HBM3e. Blackwell Ultra.",topology:"GB300",useCase:["LLM Training","LLM Inference","Agentic AI"],tokensPerSec:{llama70b:310,llama8b:2400,mistral7b:2800}},
  {id:"gb200_superchip",name:"NVIDIA GB200 Grace Blackwell Superchip",shortName:"GB200 Superchip",brand:"NVIDIA",series:"Blackwell DC",gen:"Blackwell",segment:"datacenter",vram:384,vramType:"HBM3e",priceUSD:70000,tdp:2700,bandwidth:16000,fp16:4500,fp8:9000,int8:18000,fp4:36000,nvlink:true,pcie:"NVLink-C2C",released:"2024-Q4",rating:10.0,inStock:false,sources:["nvidia_ai"],notes:"2× B200 + Grace CPU. 384 GB.",topology:"GB200",useCase:["LLM Training","HPC"],tokensPerSec:{llama70b:580,llama8b:4500,mistral7b:5000}},
  // ── NVIDIA Hopper Data Center ──
  {id:"h100_sxm",name:"NVIDIA H100 SXM5",shortName:"H100 SXM5",brand:"NVIDIA",series:"Hopper DC",gen:"Hopper",segment:"datacenter",vram:80,vramType:"HBM3",priceUSD:30000,tdp:700,bandwidth:3350,fp16:267.6,fp8:535,int8:1071,fp4:null,nvlink:true,pcie:"SXM5",released:"2023-Q1",rating:10.0,inStock:false,sources:["nvidia_ai","nvidia_official","redington"],notes:"Industry standard. Transformer Engine FP8.",topology:"GH100",cudaCores:16896,tensorCores:528,memBusWidth:5120,boostClockMHz:1980,useCase:["LLM Training","LLM Inference","RAG"],tokensPerSec:{llama70b:58,llama8b:465,mistral7b:520}},
  {id:"h100_pcie",name:"NVIDIA H100 PCIe",shortName:"H100 PCIe",brand:"NVIDIA",series:"Hopper DC",gen:"Hopper",segment:"datacenter",vram:80,vramType:"HBM2e",priceUSD:25000,tdp:350,bandwidth:2000,fp16:204,fp8:408,int8:816,fp4:null,nvlink:false,pcie:"PCIe 5.0 x16",released:"2023-Q1",rating:9.8,inStock:true,sources:["nvidia_ai","redington"],notes:"80 GB PCIe — fits standard servers.",topology:"GH100",useCase:["LLM Inference","RAG","Embeddings"],tokensPerSec:{llama70b:42,llama8b:335,mistral7b:375}},
  {id:"h200_sxm",name:"NVIDIA H200 SXM",shortName:"H200 SXM",brand:"NVIDIA",series:"Hopper DC",gen:"Hopper",segment:"datacenter",vram:141,vramType:"HBM3e",priceUSD:35000,tdp:700,bandwidth:4800,fp16:989,fp8:1979,int8:3958,fp4:null,nvlink:true,pcie:"SXM5",released:"2024-Q1",rating:10.0,inStock:false,sources:["nvidia_ai","nvidia_official"],notes:"141 GB HBM3e. Best Hopper inference.",topology:"GH100",useCase:["LLM Inference","LLM Training"],tokensPerSec:{llama70b:95,llama8b:760,mistral7b:850}},
  // ── NVIDIA Ampere Data Center ──
  {id:"a100_80_sxm",name:"NVIDIA A100 80GB SXM",shortName:"A100 80GB SXM",brand:"NVIDIA",series:"Ampere DC",gen:"Ampere",segment:"datacenter",vram:80,vramType:"HBM2e",priceUSD:10000,tdp:400,bandwidth:2000,fp16:77.6,fp8:null,int8:311,fp4:null,nvlink:true,pcie:"SXM4",released:"2020-Q4",rating:9.8,inStock:true,sources:["nvidia_ai","amazon_us","redington"],notes:"Training standard. NVLink 600 GB/s.",topology:"GA100",cudaCores:6912,tensorCores:432,memBusWidth:5120,boostClockMHz:1410,useCase:["LLM Training","LLM Inference","RAG"],tokensPerSec:{llama70b:38,llama8b:305,mistral7b:340}},
  {id:"a100_40",name:"NVIDIA A100 40GB",shortName:"A100 40GB",brand:"NVIDIA",series:"Ampere DC",gen:"Ampere",segment:"datacenter",vram:40,vramType:"HBM2",priceUSD:6500,tdp:300,bandwidth:1555,fp16:77.6,fp8:null,int8:311,fp4:null,nvlink:true,pcie:"PCIe 4.0 x16",released:"2020-Q4",rating:9.3,inStock:true,sources:["nvidia_ai","redington"],notes:"40 GB. More affordable A100.",topology:"GA100",useCase:["LLM Inference","RAG"],tokensPerSec:{llama70b:null,llama8b:150,mistral7b:168}},
  // ── NVIDIA Ada Data Center ──
  {id:"l40s",name:"NVIDIA L40S",shortName:"L40S",brand:"NVIDIA",series:"Ada DC",gen:"Ada Lovelace",segment:"datacenter",vram:48,vramType:"GDDR6 ECC",priceUSD:4500,tdp:350,bandwidth:864,fp16:91.6,fp8:366,int8:733,fp4:null,nvlink:false,pcie:"PCIe 4.0 x16",released:"2023-Q3",rating:9.5,inStock:true,sources:["nvidia_ai","nvidia_official","redington"],notes:"Best PCIe inference. 48 GB ECC. FP8.",topology:"AD102",cudaCores:18176,tensorCores:568,memBusWidth:384,boostClockMHz:2520,useCase:["LLM Inference","RAG","Vision"],tokensPerSec:{llama70b:null,llama8b:185,mistral7b:210}},
  {id:"l4",name:"NVIDIA L4",shortName:"L4",brand:"NVIDIA",series:"Ada DC",gen:"Ada Lovelace",segment:"datacenter",vram:24,vramType:"GDDR6 ECC",priceUSD:2200,tdp:72,bandwidth:300,fp16:30.3,fp8:121,int8:242,fp4:null,nvlink:false,pcie:"PCIe 4.0 x16",released:"2023-Q1",rating:8.8,inStock:true,sources:["nvidia_ai","redington"],notes:"24 GB, 72W passive cooling. Great for inference.",topology:"AD104",useCase:["LLM Inference","Embeddings","Vision"],tokensPerSec:{llama70b:null,llama8b:62,mistral7b:70}},
  // ── NVIDIA Turing Data Center ──
  {id:"t4",name:"NVIDIA T4",shortName:"T4",brand:"NVIDIA",series:"Turing DC",gen:"Turing",segment:"datacenter",vram:16,vramType:"GDDR6",priceUSD:1500,tdp:70,bandwidth:320,fp16:8.1,fp8:null,int8:130,fp4:null,nvlink:false,pcie:"PCIe 3.0 x16",released:"2018-Q3",rating:7.8,inStock:true,sources:["nvidia_ai","amazon_us","redington"],notes:"16 GB. 70W passive. Widely deployed.",topology:"TU104",useCase:["Embeddings","RAG","Vision","Small LLMs"],tokensPerSec:{llama70b:null,llama8b:22,mistral7b:26}},
  {id:"a10",name:"NVIDIA A10 24GB",shortName:"A10",brand:"NVIDIA",series:"Ampere DC",gen:"Ampere",segment:"datacenter",vram:24,vramType:"GDDR6 ECC",priceUSD:3500,tdp:150,bandwidth:600,fp16:31.2,fp8:null,int8:125,fp4:null,nvlink:false,pcie:"PCIe 4.0 x16",released:"2021-Q3",rating:8.5,inStock:true,sources:["nvidia_ai","amazon_us","redington"],notes:"24 GB ECC. 150W passive. Ideal inference server.",topology:"GA102",useCase:["LLM Inference","Embeddings","Vision"],tokensPerSec:{llama70b:null,llama8b:75,mistral7b:85}},
  {id:"a40",name:"NVIDIA A40 48GB",shortName:"A40",brand:"NVIDIA",series:"Ampere DC",gen:"Ampere",segment:"datacenter",vram:48,vramType:"GDDR6 ECC",priceUSD:7000,tdp:300,bandwidth:696,fp16:37.4,fp8:null,int8:149.7,fp4:null,nvlink:true,pcie:"PCIe 4.0 x16",released:"2020-Q4",rating:8.8,inStock:true,sources:["nvidia_ai","amazon_us","redington"],notes:"48 GB GDDR6 ECC. Workstation+inference server staple.",topology:"GA102",useCase:["LLM Inference","RAG","Rendering"],cudaCores:10752,tensorCores:336,memBusWidth:384,boostClockMHz:1740,tokensPerSec:{llama70b:null,llama8b:110,mistral7b:122}},
  {id:"a30",name:"NVIDIA A30 24GB",shortName:"A30",brand:"NVIDIA",series:"Ampere DC",gen:"Ampere",segment:"datacenter",vram:24,vramType:"HBM2",priceUSD:4000,tdp:165,bandwidth:933,fp16:10.3,fp8:null,int8:82.6,fp4:null,nvlink:true,pcie:"PCIe 4.0 x16",released:"2021-Q3",rating:8.3,inStock:true,sources:["nvidia_ai","amazon_us","redington"],notes:"24 GB HBM2. 933 GB/s. Dense multi-node inference.",topology:"GA100",useCase:["LLM Inference","Embeddings"],cudaCores:3584,tensorCores:224,memBusWidth:3072,boostClockMHz:1440,tokensPerSec:{llama70b:null,llama8b:45,mistral7b:50}},
  // ── NVIDIA RTX PRO Blackwell Workstation ──
  {id:"rtxpro6000_bw",name:"NVIDIA RTX PRO 6000 Blackwell WS",shortName:"RTX PRO 6000 BW",brand:"NVIDIA",series:"RTX PRO Blackwell",gen:"Blackwell",segment:"workstation",vram:96,vramType:"GDDR7 ECC",priceUSD:8000,tdp:300,bandwidth:1792,fp16:200,fp8:400,int8:800,fp4:1600,nvlink:true,pcie:"PCIe 5.0 x16",released:"2025-Q1",rating:9.9,inStock:false,sources:["nvidia_official","nvidia_ai"],notes:"96 GB GDDR7 ECC. NVLink for 192 GB pair.",topology:"GB202",cudaCores:24576,tensorCores:768,memBusWidth:384,boostClockMHz:2520,useCase:["LLM Inference","Agentic AI","Rendering"],tokensPerSec:{llama70b:52,llama8b:420,mistral7b:470}},
  {id:"rtxpro5000_bw",name:"NVIDIA RTX PRO 5000 Blackwell",shortName:"RTX PRO 5000 BW",brand:"NVIDIA",series:"RTX PRO Blackwell",gen:"Blackwell",segment:"workstation",vram:48,vramType:"GDDR7 ECC",priceUSD:4000,tdp:250,bandwidth:960,fp16:120,fp8:240,int8:480,fp4:960,nvlink:true,pcie:"PCIe 5.0 x16",released:"2025-Q1",rating:9.6,inStock:false,sources:["nvidia_official"],notes:"48 GB GDDR7 ECC. NVLink for 96 GB.",topology:"GB203",useCase:["LLM Inference","RAG"],tokensPerSec:{llama70b:null,llama8b:230,mistral7b:258}},
  {id:"rtxpro4500_bw",name:"NVIDIA RTX PRO 4500 Blackwell",shortName:"RTX PRO 4500 BW",brand:"NVIDIA",series:"RTX PRO Blackwell",gen:"Blackwell",segment:"workstation",vram:24,vramType:"GDDR7 ECC",priceUSD:2500,tdp:165,bandwidth:576,fp16:55,fp8:110,int8:220,fp4:440,nvlink:false,pcie:"PCIe 5.0 x16",released:"2025-Q2",rating:9.0,inStock:false,sources:["nvidia_official"],notes:"24 GB GDDR7 ECC. Mid-range Blackwell workstation.",topology:"GB205",cudaCores:8960,tensorCores:280,memBusWidth:192,boostClockMHz:2280,useCase:["LLM Inference","RAG","Vision"],tokensPerSec:{llama70b:null,llama8b:105,mistral7b:118}},
  {id:"rtxpro4000_bw",name:"NVIDIA RTX PRO 4000 Blackwell",shortName:"RTX PRO 4000 BW",brand:"NVIDIA",series:"RTX PRO Blackwell",gen:"Blackwell",segment:"workstation",vram:20,vramType:"GDDR7 ECC",priceUSD:1500,tdp:130,bandwidth:448,fp16:40,fp8:80,int8:160,fp4:320,nvlink:false,pcie:"PCIe 5.0 x16",released:"2025-Q2",rating:8.8,inStock:false,sources:["nvidia_official"],notes:"20 GB GDDR7 ECC. Workstation AI & visualization.",topology:"GB205",cudaCores:7168,tensorCores:224,memBusWidth:160,boostClockMHz:2175,useCase:["LLM Inference","Embeddings","RAG"],tokensPerSec:{llama70b:null,llama8b:78,mistral7b:87}},
  {id:"rtxpro4000sff_bw",name:"NVIDIA RTX PRO 4000 Blackwell SFF",shortName:"RTX PRO 4000 BW SFF",brand:"NVIDIA",series:"RTX PRO Blackwell",gen:"Blackwell",segment:"workstation",vram:20,vramType:"GDDR7 ECC",priceUSD:1400,tdp:70,bandwidth:336,fp16:28,fp8:56,int8:112,fp4:224,nvlink:false,pcie:"PCIe 5.0 x8",released:"2025-Q2",rating:8.5,inStock:false,sources:["nvidia_official"],notes:"20 GB GDDR7 ECC. Low-profile 70W. Fits small form factor workstations.",topology:"GB205",useCase:["LLM Inference","Embeddings"],tokensPerSec:{llama70b:null,llama8b:52,mistral7b:58}},
  {id:"rtxpro2000_bw",name:"NVIDIA RTX PRO 2000 Blackwell",shortName:"RTX PRO 2000 BW",brand:"NVIDIA",series:"RTX PRO Blackwell",gen:"Blackwell",segment:"workstation",vram:16,vramType:"GDDR7 ECC",priceUSD:625,tdp:70,bandwidth:288,fp16:20,fp8:40,int8:80,fp4:160,nvlink:false,pcie:"PCIe 5.0 x16",released:"2025-Q2",rating:8.2,inStock:false,sources:["nvidia_official"],notes:"16 GB GDDR7 ECC. 70W. Entry-level Blackwell workstation.",topology:"GB206",cudaCores:5632,tensorCores:176,memBusWidth:128,boostClockMHz:2130,useCase:["LLM Inference","Embeddings"],tokensPerSec:{llama70b:null,llama8b:38,mistral7b:43}},
  {id:"rtxpro1000_bw",name:"NVIDIA RTX PRO 1000 Blackwell",shortName:"RTX PRO 1000 BW",brand:"NVIDIA",series:"RTX PRO Blackwell",gen:"Blackwell",segment:"workstation",vram:16,vramType:"GDDR7 ECC",priceUSD:450,tdp:50,bandwidth:192,fp16:12,fp8:24,int8:48,fp4:96,nvlink:false,pcie:"PCIe 5.0 x16",released:"2025-Q2",rating:7.8,inStock:false,sources:["nvidia_official"],notes:"16 GB GDDR7 ECC. 50W passive cooling. Thin workstation & embedded.",topology:"GB207",cudaCores:3584,tensorCores:112,memBusWidth:128,boostClockMHz:1920,useCase:["Embeddings","Small LLMs"],tokensPerSec:{llama70b:null,llama8b:22,mistral7b:25}},
  {id:"rtxpro500_bw",name:"NVIDIA RTX PRO 500 Blackwell",shortName:"RTX PRO 500 BW",brand:"NVIDIA",series:"RTX PRO Blackwell",gen:"Blackwell",segment:"workstation",vram:8,vramType:"GDDR7 ECC",priceUSD:250,tdp:50,bandwidth:128,fp16:8,fp8:16,int8:32,fp4:64,nvlink:false,pcie:"PCIe 5.0 x8",released:"2025-Q2",rating:7.2,inStock:false,sources:["nvidia_official"],notes:"8 GB GDDR7 ECC. Entry-level Blackwell. Edge AI & visualization.",topology:"GB207",useCase:["Embeddings"],tokensPerSec:{llama70b:null,llama8b:null,mistral7b:14}},
  // ── NVIDIA RTX Ada Workstation ──
  {id:"rtx6000ada",name:"NVIDIA RTX 6000 Ada Generation",shortName:"RTX 6000 Ada",brand:"NVIDIA",series:"RTX Ada",gen:"Ada Lovelace",segment:"workstation",vram:48,vramType:"GDDR6 ECC",priceUSD:6800,tdp:300,bandwidth:960,fp16:91.1,fp8:364,int8:182,fp4:null,nvlink:true,pcie:"PCIe 4.0 x16",released:"2022-Q4",rating:9.7,inStock:true,sources:["nvidia_official","amazon_us","redington"],notes:"NVLink for 96 GB pair.",topology:"AD102",cudaCores:18176,tensorCores:568,rtCores:142,memBusWidth:384,boostClockMHz:2505,useCase:["LLM Inference","RAG","Rendering"],tokensPerSec:{llama70b:null,llama8b:168,mistral7b:188}},
  {id:"rtx5000ada",name:"NVIDIA RTX 5000 Ada",shortName:"RTX 5000 Ada",brand:"NVIDIA",series:"RTX Ada",gen:"Ada Lovelace",segment:"workstation",vram:32,vramType:"GDDR6 ECC",priceUSD:3800,tdp:250,bandwidth:576,fp16:65.3,fp8:261,int8:130,fp4:null,nvlink:true,pcie:"PCIe 4.0 x16",released:"2022-Q4",rating:9.2,inStock:true,sources:["nvidia_official","amazon_us"],notes:"32 GB ECC workstation GPU.",topology:"AD102",useCase:["LLM Inference","RAG"],tokensPerSec:{llama70b:null,llama8b:120,mistral7b:134}},
  {id:"rtx4000ada",name:"NVIDIA RTX 4000 Ada Generation",shortName:"RTX 4000 Ada",brand:"NVIDIA",series:"RTX Ada",gen:"Ada Lovelace",segment:"workstation",vram:20,vramType:"GDDR6 ECC",priceUSD:1250,tdp:130,bandwidth:432,fp16:26.7,fp8:107,int8:53.4,fp4:null,nvlink:false,pcie:"PCIe 4.0 x16",released:"2022-Q4",rating:8.5,inStock:true,sources:["nvidia_official","amazon_us"],notes:"20 GB ECC. Mid-range workstation. Up to 34B Q4.",topology:"AD104",useCase:["LLM Inference","Embeddings","RAG"],cudaCores:6144,tensorCores:192,memBusWidth:160,boostClockMHz:2175,tokensPerSec:{llama70b:null,llama8b:55,mistral7b:62}},
  {id:"rtx2000ada",name:"NVIDIA RTX 2000 Ada Generation",shortName:"RTX 2000 Ada",brand:"NVIDIA",series:"RTX Ada",gen:"Ada Lovelace",segment:"workstation",vram:16,vramType:"GDDR6 ECC",priceUSD:625,tdp:70,bandwidth:256,fp16:12.0,fp8:48,int8:24,fp4:null,nvlink:false,pcie:"PCIe 4.0 x16",released:"2023-Q1",rating:7.9,inStock:true,sources:["nvidia_official","amazon_us"],notes:"16 GB ECC. Low-power 70W. Ideal thin-and-light workstation AI.",topology:"AD106",useCase:["Embeddings","Small LLMs"],cudaCores:2816,tensorCores:88,memBusWidth:128,boostClockMHz:2130,tokensPerSec:{llama70b:null,llama8b:28,mistral7b:31}},
  // ── NVIDIA GeForce RTX 50 Series (Blackwell) ──
  {id:"rtx5090",name:"NVIDIA GeForce RTX 5090",shortName:"RTX 5090",brand:"NVIDIA",series:"RTX 50",gen:"Blackwell",segment:"consumer",vram:32,vramType:"GDDR7",priceUSD:1999,tdp:575,bandwidth:1792,fp16:209.8,fp8:838,int8:419,fp4:838,nvlink:false,pcie:"PCIe 5.0 x16",released:"2025-Q1",rating:9.9,inStock:true,sources:["nvidia_official","newegg","amazon_us","md_computers","primeabgb"],notes:"32 GB GDDR7. 21,760 CUDA cores.",topology:"GB202",cudaCores:21760,tensorCores:680,rtCores:170,memBusWidth:512,boostClockMHz:2407,useCase:["LLM Inference","Coding","Vision"],tokensPerSec:{llama70b:null,llama8b:195,mistral7b:220}},
  {id:"rtx5080",name:"NVIDIA GeForce RTX 5080",shortName:"RTX 5080",brand:"NVIDIA",series:"RTX 50",gen:"Blackwell",segment:"consumer",vram:16,vramType:"GDDR7",priceUSD:999,tdp:360,bandwidth:960,fp16:137.7,fp8:550,int8:275,fp4:550,nvlink:false,pcie:"PCIe 5.0 x16",released:"2025-Q1",rating:9.5,inStock:true,sources:["nvidia_official","newegg","amazon_us","md_computers"],notes:"16 GB GDDR7.",topology:"GB203",useCase:["LLM Inference","Vision"],tokensPerSec:{llama70b:null,llama8b:128,mistral7b:143}},
  {id:"rtx5070ti",name:"NVIDIA GeForce RTX 5070 Ti",shortName:"RTX 5070 Ti",brand:"NVIDIA",series:"RTX 50",gen:"Blackwell",segment:"consumer",vram:16,vramType:"GDDR7",priceUSD:749,tdp:300,bandwidth:896,fp16:107.1,fp8:428,int8:214,fp4:428,nvlink:false,pcie:"PCIe 5.0 x16",released:"2025-Q1",rating:9.2,inStock:true,sources:["nvidia_official","newegg","amazon_us"],notes:"16 GB GDDR7.",topology:"GB203",useCase:["LLM Inference","Vision"],tokensPerSec:{llama70b:null,llama8b:99,mistral7b:111}},
  {id:"rtx5070",name:"NVIDIA GeForce RTX 5070",shortName:"RTX 5070",brand:"NVIDIA",series:"RTX 50",gen:"Blackwell",segment:"consumer",vram:12,vramType:"GDDR7",priceUSD:549,tdp:250,bandwidth:672,fp16:75.3,fp8:301,int8:150,fp4:301,nvlink:false,pcie:"PCIe 5.0 x16",released:"2025-Q1",rating:8.9,inStock:true,sources:["nvidia_official","newegg","amazon_us"],notes:"12 GB GDDR7.",topology:"GB205",useCase:["LLM Inference"],tokensPerSec:{llama70b:null,llama8b:72,mistral7b:81}},
  {id:"rtx5060ti_16",name:"NVIDIA GeForce RTX 5060 Ti 16GB",shortName:"RTX 5060 Ti 16GB",brand:"NVIDIA",series:"RTX 50",gen:"Blackwell",segment:"consumer",vram:16,vramType:"GDDR7",priceUSD:499,tdp:180,bandwidth:576,fp16:56,fp8:224,int8:112,fp4:224,nvlink:false,pcie:"PCIe 5.0 x16",released:"2025-Q2",rating:8.8,inStock:true,sources:["nvidia_official","newegg","amazon_us"],notes:"16 GB GDDR7. Excellent value for AI.",topology:"GB206",useCase:["LLM Inference","Embeddings"],tokensPerSec:{llama70b:null,llama8b:88,mistral7b:99}},
  {id:"rtx5060ti_8",name:"NVIDIA GeForce RTX 5060 Ti 8GB",shortName:"RTX 5060 Ti 8GB",brand:"NVIDIA",series:"RTX 50",gen:"Blackwell",segment:"consumer",vram:8,vramType:"GDDR7",priceUSD:379,tdp:180,bandwidth:576,fp16:56,fp8:224,int8:112,fp4:224,nvlink:false,pcie:"PCIe 5.0 x16",released:"2025-Q2",rating:8.0,inStock:true,sources:["nvidia_official","newegg","amazon_us"],notes:"8 GB GDDR7. Same chip as 16GB, VRAM-limited for models above 7B.",topology:"GB206",useCase:["Embeddings","Small LLMs"],tokensPerSec:{llama70b:null,llama8b:null,mistral7b:42}},
  {id:"rtx5060",name:"NVIDIA GeForce RTX 5060",shortName:"RTX 5060",brand:"NVIDIA",series:"RTX 50",gen:"Blackwell",segment:"consumer",vram:8,vramType:"GDDR7",priceUSD:299,tdp:115,bandwidth:384,fp16:32,fp8:128,int8:64,fp4:128,nvlink:false,pcie:"PCIe 5.0 x8",released:"2025-Q3",rating:8.1,inStock:false,sources:["nvidia_official","newegg","amazon_us"],notes:"8 GB GDDR7. Entry Blackwell. Fastest 8 GB card for 7B inference.",topology:"GB206",useCase:["Embeddings","Small LLMs"],tokensPerSec:{llama70b:null,llama8b:null,mistral7b:36}},
  // ── NVIDIA GeForce RTX 40 Series (Ada) ──
  {id:"rtx4090",name:"NVIDIA GeForce RTX 4090",shortName:"RTX 4090",brand:"NVIDIA",series:"RTX 40",gen:"Ada Lovelace",segment:"consumer",vram:24,vramType:"GDDR6X",priceUSD:1599,tdp:450,bandwidth:1008,fp16:82.6,fp8:330,int8:165,fp4:null,nvlink:false,pcie:"PCIe 4.0 x16",released:"2022-Q4",rating:9.8,inStock:true,sources:["nvidia_official","amazon_us","newegg","amazon_in","md_computers","primeabgb"],notes:"24 GB GDDR6X. Best prosumer AI GPU.",topology:"AD102",cudaCores:16384,tensorCores:512,rtCores:128,memBusWidth:384,boostClockMHz:2520,useCase:["LLM Inference","Coding","Vision","RAG"],tokensPerSec:{llama70b:18,llama8b:148,mistral7b:165}},
  {id:"rtx4080s",name:"NVIDIA GeForce RTX 4080 SUPER",shortName:"RTX 4080 Super",brand:"NVIDIA",series:"RTX 40",gen:"Ada Lovelace",segment:"consumer",vram:16,vramType:"GDDR6X",priceUSD:999,tdp:320,bandwidth:736,fp16:52.2,fp8:209,int8:104,fp4:null,nvlink:false,pcie:"PCIe 4.0 x16",released:"2024-Q1",rating:9.1,inStock:true,sources:["nvidia_official","amazon_us","amazon_in","md_computers"],notes:"16 GB GDDR6X.",topology:"AD103",useCase:["LLM Inference","Vision"],tokensPerSec:{llama70b:null,llama8b:94,mistral7b:105}},
  {id:"rtx4070ti_s",name:"NVIDIA GeForce RTX 4070 Ti SUPER",shortName:"RTX 4070 Ti Super",brand:"NVIDIA",series:"RTX 40",gen:"Ada Lovelace",segment:"consumer",vram:16,vramType:"GDDR6X",priceUSD:799,tdp:285,bandwidth:672,fp16:44.1,fp8:176,int8:88,fp4:null,nvlink:false,pcie:"PCIe 4.0 x16",released:"2024-Q1",rating:8.9,inStock:true,sources:["nvidia_official","amazon_us","md_computers"],notes:"16 GB GDDR6X. Great balance.",topology:"AD103",useCase:["LLM Inference","Vision"],tokensPerSec:{llama70b:null,llama8b:80,mistral7b:90}},
  {id:"rtx4060ti_16",name:"NVIDIA GeForce RTX 4060 Ti 16GB",shortName:"RTX 4060 Ti 16GB",brand:"NVIDIA",series:"RTX 40",gen:"Ada Lovelace",segment:"consumer",vram:16,vramType:"GDDR6",priceUSD:499,tdp:165,bandwidth:288,fp16:22.4,fp8:90,int8:45,fp4:null,nvlink:false,pcie:"PCIe 4.0 x8",released:"2023-Q2",rating:8.2,inStock:true,sources:["nvidia_official","amazon_us","amazon_in","md_computers"],notes:"16 GB budget. Low BW limits large models.",topology:"AD106",useCase:["LLM Inference","Embeddings"],tokensPerSec:{llama70b:null,llama8b:45,mistral7b:50}},
  {id:"rtx4070s",name:"NVIDIA GeForce RTX 4070 SUPER",shortName:"RTX 4070 Super",brand:"NVIDIA",series:"RTX 40",gen:"Ada Lovelace",segment:"consumer",vram:12,vramType:"GDDR6X",priceUSD:599,tdp:220,bandwidth:504,fp16:35.5,fp8:142,int8:71,fp4:null,nvlink:false,pcie:"PCIe 4.0 x16",released:"2024-Q1",rating:8.5,inStock:true,sources:["nvidia_official","amazon_us","newegg","amazon_in","md_computers"],notes:"12 GB GDDR6X. Best mid-range Ada for price.",topology:"AD104",useCase:["LLM Inference","Vision"],tokensPerSec:{llama70b:null,llama8b:62,mistral7b:70}},
  {id:"rtx4070",name:"NVIDIA GeForce RTX 4070",shortName:"RTX 4070",brand:"NVIDIA",series:"RTX 40",gen:"Ada Lovelace",segment:"consumer",vram:12,vramType:"GDDR6X",priceUSD:549,tdp:200,bandwidth:504,fp16:29.1,fp8:116,int8:58,fp4:null,nvlink:false,pcie:"PCIe 4.0 x16",released:"2023-Q4",rating:8.3,inStock:true,sources:["nvidia_official","amazon_us","newegg","amazon_in"],notes:"12 GB GDDR6X. Power-efficient mid-range.",topology:"AD104",useCase:["LLM Inference"],tokensPerSec:{llama70b:null,llama8b:56,mistral7b:63}},
  {id:"rtx4060ti_8",name:"NVIDIA GeForce RTX 4060 Ti 8GB",shortName:"RTX 4060 Ti 8GB",brand:"NVIDIA",series:"RTX 40",gen:"Ada Lovelace",segment:"consumer",vram:8,vramType:"GDDR6",priceUSD:399,tdp:165,bandwidth:288,fp16:22.4,fp8:90,int8:45,fp4:null,nvlink:false,pcie:"PCIe 4.0 x8",released:"2023-Q2",rating:7.8,inStock:true,sources:["nvidia_official","amazon_us","amazon_in","md_computers"],notes:"8 GB. Limited VRAM for 13B+ models.",topology:"AD106",useCase:["LLM Inference","Embeddings"],tokensPerSec:{llama70b:null,llama8b:null,mistral7b:38}},
  {id:"rtx4060",name:"NVIDIA GeForce RTX 4060",shortName:"RTX 4060",brand:"NVIDIA",series:"RTX 40",gen:"Ada Lovelace",segment:"consumer",vram:8,vramType:"GDDR6",priceUSD:299,tdp:115,bandwidth:272,fp16:15.1,fp8:60,int8:30,fp4:null,nvlink:false,pcie:"PCIe 4.0 x8",released:"2023-Q2",rating:7.5,inStock:true,sources:["nvidia_official","amazon_us","amazon_in","md_computers","primeabgb"],notes:"8 GB. Entry-level Ada. Very efficient 7B GPU.",topology:"AD107",useCase:["Embeddings","Small LLMs"],tokensPerSec:{llama70b:null,llama8b:null,mistral7b:29}},
  // ── NVIDIA GeForce RTX 30 Series (Ampere) ──
  {id:"rtx3090",name:"NVIDIA GeForce RTX 3090",shortName:"RTX 3090",brand:"NVIDIA",series:"RTX 30",gen:"Ampere",segment:"consumer",vram:24,vramType:"GDDR6X",priceUSD:700,tdp:350,bandwidth:936,fp16:35.6,fp8:null,int8:142,fp4:null,nvlink:true,pcie:"PCIe 4.0 x16",released:"2020-Q3",rating:8.6,inStock:true,sources:["amazon_us","newegg","amazon_in","md_computers"],notes:"NVLink 2-way for 48 GB. Classic AI workhorse.",topology:"GA102",useCase:["LLM Inference","RAG"],tokensPerSec:{llama70b:13,llama8b:102,mistral7b:114}},
  {id:"rtx3090ti",name:"NVIDIA GeForce RTX 3090 Ti",shortName:"RTX 3090 Ti",brand:"NVIDIA",series:"RTX 30",gen:"Ampere",segment:"consumer",vram:24,vramType:"GDDR6X",priceUSD:800,tdp:450,bandwidth:1008,fp16:40,fp8:null,int8:160,fp4:null,nvlink:false,pcie:"PCIe 4.0 x16",released:"2022-Q1",rating:8.7,inStock:true,sources:["amazon_us","newegg","amazon_in"],notes:"24 GB, slightly faster than 3090.",topology:"GA102",useCase:["LLM Inference","RAG"],tokensPerSec:{llama70b:14,llama8b:112,mistral7b:125}},
  {id:"rtx3080_12",name:"NVIDIA GeForce RTX 3080 12GB",shortName:"RTX 3080 12GB",brand:"NVIDIA",series:"RTX 30",gen:"Ampere",segment:"consumer",vram:12,vramType:"GDDR6X",priceUSD:400,tdp:350,bandwidth:912,fp16:30,fp8:null,int8:120,fp4:null,nvlink:false,pcie:"PCIe 4.0 x16",released:"2022-Q1",rating:8.1,inStock:true,sources:["amazon_us","newegg","amazon_in","md_computers"],notes:"12 GB. Good bandwidth, limited VRAM.",topology:"GA102",useCase:["LLM Inference"],tokensPerSec:{llama70b:null,llama8b:65,mistral7b:73}},
  {id:"rtx3060_12",name:"NVIDIA GeForce RTX 3060 12GB",shortName:"RTX 3060 12GB",brand:"NVIDIA",series:"RTX 30",gen:"Ampere",segment:"consumer",vram:12,vramType:"GDDR6",priceUSD:180,tdp:170,bandwidth:360,fp16:12.7,fp8:null,int8:51,fp4:null,nvlink:false,pcie:"PCIe 4.0 x16",released:"2021-Q1",rating:7.4,inStock:true,sources:["amazon_us","newegg","amazon_in","md_computers","primeabgb"],notes:"12 GB budget. Popular 13B Q4.",topology:"GA106",useCase:["LLM Inference","Embeddings"],tokensPerSec:{llama70b:null,llama8b:28,mistral7b:32}},
  {id:"rtx3080_10",name:"NVIDIA GeForce RTX 3080 10GB",shortName:"RTX 3080 10GB",brand:"NVIDIA",series:"RTX 30",gen:"Ampere",segment:"consumer",vram:10,vramType:"GDDR6X",priceUSD:380,tdp:320,bandwidth:760,fp16:29.8,fp8:null,int8:119,fp4:null,nvlink:false,pcie:"PCIe 4.0 x16",released:"2020-Q3",rating:7.9,inStock:true,sources:["amazon_us","newegg","amazon_in","md_computers"],notes:"10 GB high BW. Bandwidth-limited for large models.",topology:"GA102",useCase:["LLM Inference"],tokensPerSec:{llama70b:null,llama8b:52,mistral7b:58}},
  {id:"rtx3070",name:"NVIDIA GeForce RTX 3070",shortName:"RTX 3070",brand:"NVIDIA",series:"RTX 30",gen:"Ampere",segment:"consumer",vram:8,vramType:"GDDR6",priceUSD:280,tdp:220,bandwidth:448,fp16:20.3,fp8:null,int8:81,fp4:null,nvlink:false,pcie:"PCIe 4.0 x16",released:"2020-Q4",rating:7.6,inStock:true,sources:["amazon_us","newegg","amazon_in","md_computers"],notes:"8 GB. Good for 7B models at Q4.",topology:"GA104",useCase:["LLM Inference","Embeddings"],tokensPerSec:{llama70b:null,llama8b:null,mistral7b:28}},
  {id:"rtx3060ti",name:"NVIDIA GeForce RTX 3060 Ti",shortName:"RTX 3060 Ti",brand:"NVIDIA",series:"RTX 30",gen:"Ampere",segment:"consumer",vram:8,vramType:"GDDR6",priceUSD:240,tdp:200,bandwidth:448,fp16:16.2,fp8:null,int8:64.8,fp4:null,nvlink:false,pcie:"PCIe 4.0 x16",released:"2020-Q4",rating:7.3,inStock:true,sources:["amazon_us","newegg","amazon_in","md_computers"],notes:"8 GB. Budget Ampere. 7B Q4 capable.",topology:"GA104",useCase:["Embeddings","Small LLMs"],tokensPerSec:{llama70b:null,llama8b:null,mistral7b:24}},
  // ── NVIDIA Jetson Edge ──
  {id:"jetson_orin_agx",name:"NVIDIA Jetson AGX Orin",shortName:"Jetson AGX Orin",brand:"NVIDIA",series:"Jetson Edge",gen:"Orin",segment:"edge",vram:64,vramType:"LPDDR5 Unified",priceUSD:499,tdp:60,bandwidth:204,fp16:5.3,fp8:null,int8:275,fp4:null,nvlink:false,pcie:"PCIe 4.0 x4",released:"2022-Q3",rating:8.8,inStock:true,sources:["nvidia_official","amazon_us","amazon_in"],notes:"64 GB unified. 275 TOPS.",topology:"Orin",useCase:["Edge AI","Robotics","Vision"],tokensPerSec:{llama70b:null,llama8b:12,mistral7b:14}},
  {id:"jetson_orin_nx16",name:"NVIDIA Jetson Orin NX 16GB",shortName:"Jetson Orin NX 16GB",brand:"NVIDIA",series:"Jetson Edge",gen:"Orin",segment:"edge",vram:16,vramType:"LPDDR5 Unified",priceUSD:299,tdp:20,bandwidth:102,fp16:1.9,fp8:null,int8:100,fp4:null,nvlink:false,pcie:"PCIe 4.0 x4",released:"2023-Q1",rating:8.3,inStock:true,sources:["nvidia_official","amazon_us","amazon_in"],notes:"16 GB unified. 100 TOPS.",topology:"Orin",useCase:["Edge AI","Vision"],tokensPerSec:{llama70b:null,llama8b:5,mistral7b:6}},
  // ── AMD Data Center ──
  {id:"amd_mi210",name:"AMD Instinct MI210",shortName:"MI210",brand:"AMD",series:"AMD Instinct MI200",gen:"CDNA 2",segment:"datacenter",vram:64,vramType:"HBM2e",priceUSD:7000,tdp:300,bandwidth:1600,fp16:181.7,fp8:null,int8:363.4,fp4:null,nvlink:false,pcie:"PCIe 4.0 x16",released:"2021-Q4",rating:8.6,inStock:true,sources:["amd_official"],notes:"64 GB HBM2e. 1.6 TB/s. ROCm 5.x+. Strong for 70B inference.",topology:"CDNA2",useCase:["LLM Training","LLM Inference","RAG"],memBusWidth:4096,boostClockMHz:1700,tokensPerSec:{llama70b:30,llama8b:240,mistral7b:268}},
  {id:"amd_mi100",name:"AMD Instinct MI100",shortName:"MI100",brand:"AMD",series:"AMD Instinct MI100",gen:"CDNA 1",segment:"datacenter",vram:32,vramType:"HBM2",priceUSD:4500,tdp:300,bandwidth:1229,fp16:184.6,fp8:null,int8:369,fp4:null,nvlink:false,pcie:"PCIe 4.0 x16",released:"2020-Q4",rating:8.2,inStock:true,sources:["amd_official"],notes:"32 GB HBM2. 1.2 TB/s. ROCm 4.x. Legacy datacenter.",topology:"CDNA1",useCase:["LLM Inference","RAG"],tokensPerSec:{llama70b:null,llama8b:62,mistral7b:70}},
  {id:"amd_mi300x",name:"AMD Instinct MI300X",shortName:"MI300X",brand:"AMD",series:"AMD Instinct MI300",gen:"CDNA 3",segment:"datacenter",vram:192,vramType:"HBM3",priceUSD:15000,tdp:750,bandwidth:5300,fp16:1300,fp8:2600,int8:5200,fp4:null,nvlink:false,pcie:"PCIe 5.0 x16",released:"2023-Q4",rating:9.8,inStock:true,sources:["amd_official"],notes:"192 GB HBM3. 5.3 TB/s. ROCm support.",topology:"CDNA3",useCase:["LLM Training","LLM Inference","RAG"],tokensPerSec:{llama70b:55,llama8b:440,mistral7b:490}},
  {id:"amd_mi325x",name:"AMD Instinct MI325X",shortName:"MI325X",brand:"AMD",series:"AMD Instinct MI300",gen:"CDNA 3+",segment:"datacenter",vram:288,vramType:"HBM3e",priceUSD:20000,tdp:750,bandwidth:6000,fp16:1300,fp8:2600,int8:5200,fp4:null,nvlink:false,pcie:"PCIe 5.0 x16",released:"2024-Q4",rating:9.9,inStock:false,sources:["amd_official"],notes:"288 GB HBM3e. ROCm 6.x support.",topology:"CDNA3+",useCase:["LLM Training","LLM Inference"],tokensPerSec:{llama70b:78,llama8b:625,mistral7b:700}},
  {id:"amd_mi355x",name:"AMD Instinct MI355X",shortName:"MI355X",brand:"AMD",series:"AMD Instinct MI350",gen:"CDNA 4",segment:"datacenter",vram:288,vramType:"HBM3e",priceUSD:25000,tdp:800,bandwidth:7200,fp16:1600,fp8:3200,int8:6400,fp4:12800,nvlink:false,pcie:"PCIe 5.0 x16",released:"2025-Q2",rating:10.0,inStock:false,sources:["amd_official"],notes:"CDNA 4. FP4 support. 7.2 TB/s.",topology:"CDNA4",useCase:["LLM Training","LLM Inference"],tokensPerSec:{llama70b:95,llama8b:760,mistral7b:850}},
  // ── AMD Consumer ──
  {id:"amd_rx9070xt",name:"AMD Radeon RX 9070 XT",shortName:"RX 9070 XT",brand:"AMD",series:"Radeon RX 9000",gen:"RDNA 4",segment:"consumer",vram:16,vramType:"GDDR6",priceUSD:599,tdp:304,bandwidth:717,fp16:49,fp8:196,int8:98,fp4:null,nvlink:false,pcie:"PCIe 5.0 x16",released:"2025-Q1",rating:9.0,inStock:true,sources:["amd_official","amazon_us"],notes:"16 GB GDDR6. RDNA 4. ROCm 6.x.",topology:"RDNA4",useCase:["LLM Inference","Vision"],tokensPerSec:{llama70b:null,llama8b:86,mistral7b:96}},
  {id:"amd_rx9070",name:"AMD Radeon RX 9070",shortName:"RX 9070",brand:"AMD",series:"Radeon RX 9000",gen:"RDNA 4",segment:"consumer",vram:16,vramType:"GDDR6",priceUSD:499,tdp:220,bandwidth:644,fp16:39,fp8:156,int8:78,fp4:null,nvlink:false,pcie:"PCIe 5.0 x16",released:"2025-Q1",rating:8.8,inStock:true,sources:["amd_official","amazon_us"],notes:"16 GB. Good price/performance for AI.",topology:"RDNA4",useCase:["LLM Inference"],tokensPerSec:{llama70b:null,llama8b:72,mistral7b:80}},
  {id:"amd_rx7900xtx",name:"AMD Radeon RX 7900 XTX",shortName:"RX 7900 XTX",brand:"AMD",series:"Radeon RX 7000",gen:"RDNA 3",segment:"consumer",vram:24,vramType:"GDDR6",priceUSD:799,tdp:355,bandwidth:960,fp16:61,fp8:null,int8:122,fp4:null,nvlink:false,pcie:"PCIe 4.0 x16",released:"2022-Q4",rating:8.7,inStock:true,sources:["amd_official","amazon_us"],notes:"24 GB GDDR6. ROCm 5.x+. llama.cpp.",topology:"RDNA3",useCase:["LLM Inference","Vision"],tokensPerSec:{llama70b:16,llama8b:125,mistral7b:140}},
  {id:"amd_rx7900xt",name:"AMD Radeon RX 7900 XT",shortName:"RX 7900 XT",brand:"AMD",series:"Radeon RX 7000",gen:"RDNA 3",segment:"consumer",vram:20,vramType:"GDDR6",priceUSD:699,tdp:300,bandwidth:800,fp16:51.5,fp8:null,int8:103,fp4:null,nvlink:false,pcie:"PCIe 4.0 x16",released:"2022-Q4",rating:8.4,inStock:true,sources:["amd_official","amazon_us"],notes:"20 GB GDDR6. Good for mid-tier inference.",topology:"RDNA3",useCase:["LLM Inference"],tokensPerSec:{llama70b:null,llama8b:98,mistral7b:110}},
  {id:"amd_rx7800xt",name:"AMD Radeon RX 7800 XT",shortName:"RX 7800 XT",brand:"AMD",series:"Radeon RX 7000",gen:"RDNA 3",segment:"consumer",vram:16,vramType:"GDDR6",priceUSD:449,tdp:263,bandwidth:624,fp16:37.3,fp8:null,int8:74.6,fp4:null,nvlink:false,pcie:"PCIe 4.0 x16",released:"2023-Q3",rating:8.1,inStock:true,sources:["amd_official","amazon_us"],notes:"16 GB. Solid mid-range.",topology:"RDNA3",useCase:["LLM Inference"],tokensPerSec:{llama70b:null,llama8b:58,mistral7b:65}},
  {id:"amd_rx7600xt",name:"AMD Radeon RX 7600 XT",shortName:"RX 7600 XT",brand:"AMD",series:"Radeon RX 7000",gen:"RDNA 3",segment:"consumer",vram:16,vramType:"GDDR6",priceUSD:329,tdp:165,bandwidth:288,fp16:22.9,fp8:null,int8:45.8,fp4:null,nvlink:false,pcie:"PCIe 4.0 x8",released:"2025-Q1",rating:7.9,inStock:true,sources:["amd_official","amazon_us"],notes:"16 GB GDDR6. Best VRAM-per-dollar AMD option.",topology:"RDNA3",useCase:["LLM Inference","Embeddings"],tokensPerSec:{llama70b:null,llama8b:35,mistral7b:39}},
  {id:"amd_rx6900xt",name:"AMD Radeon RX 6900 XT",shortName:"RX 6900 XT",brand:"AMD",series:"Radeon RX 6000",gen:"RDNA 2",segment:"consumer",vram:16,vramType:"GDDR6",priceUSD:380,tdp:300,bandwidth:512,fp16:23.1,fp8:null,int8:46.2,fp4:null,nvlink:false,pcie:"PCIe 4.0 x16",released:"2020-Q4",rating:7.7,inStock:true,sources:["amd_official","amazon_us"],notes:"16 GB GDDR6. ROCm 5.x. 128K context capable.",topology:"RDNA2",useCase:["LLM Inference"],tokensPerSec:{llama70b:null,llama8b:42,mistral7b:47}},
  {id:"amd_rx6800xt",name:"AMD Radeon RX 6800 XT",shortName:"RX 6800 XT",brand:"AMD",series:"Radeon RX 6000",gen:"RDNA 2",segment:"consumer",vram:16,vramType:"GDDR6",priceUSD:320,tdp:300,bandwidth:512,fp16:20.7,fp8:null,int8:41.4,fp4:null,nvlink:false,pcie:"PCIe 4.0 x16",released:"2020-Q4",rating:7.4,inStock:true,sources:["amd_official","amazon_us"],notes:"16 GB GDDR6. Budget ROCm option.",topology:"RDNA2",useCase:["LLM Inference"],tokensPerSec:{llama70b:null,llama8b:38,mistral7b:43}},
  // ── AMD Radeon PRO Workstation (RDNA 3) — AMD alternatives to NVIDIA RTX PRO ──
  {id:"amd_pro_w7900",name:"AMD Radeon PRO W7900",shortName:"Pro W7900",brand:"AMD",series:"Radeon PRO W7000",gen:"RDNA 3",segment:"workstation",vram:48,vramType:"GDDR6 ECC",priceUSD:3999,tdp:295,bandwidth:864,fp16:61.3,fp8:null,int8:122.6,fp4:null,nvlink:false,pcie:"PCIe 4.0 x16",released:"2023-Q2",rating:9.3,inStock:true,sources:["amd_official"],notes:"48 GB GDDR6 ECC. 864 GB/s. ROCm 6.x. Direct alternative to RTX PRO 6000 Ada.",topology:"Navi31",cudaCores:null,memBusWidth:384,boostClockMHz:2495,useCase:["LLM Inference","RAG","Rendering"],tokensPerSec:{llama70b:null,llama8b:112,mistral7b:125}},
  {id:"amd_pro_w7800",name:"AMD Radeon PRO W7800",shortName:"Pro W7800",brand:"AMD",series:"Radeon PRO W7000",gen:"RDNA 3",segment:"workstation",vram:32,vramType:"GDDR6 ECC",priceUSD:2499,tdp:260,bandwidth:576,fp16:45.2,fp8:null,int8:90.4,fp4:null,nvlink:false,pcie:"PCIe 4.0 x16",released:"2023-Q2",rating:9.0,inStock:true,sources:["amd_official"],notes:"32 GB GDDR6 ECC. 576 GB/s. Alternative to RTX 5000 Ada / PRO 5000.",topology:"Navi31",memBusWidth:256,boostClockMHz:2124,useCase:["LLM Inference","RAG"],tokensPerSec:{llama70b:null,llama8b:85,mistral7b:95}},
  {id:"amd_pro_w7700",name:"AMD Radeon PRO W7700",shortName:"Pro W7700",brand:"AMD",series:"Radeon PRO W7000",gen:"RDNA 3",segment:"workstation",vram:16,vramType:"GDDR6 ECC",priceUSD:999,tdp:100,bandwidth:288,fp16:22.7,fp8:null,int8:45.4,fp4:null,nvlink:false,pcie:"PCIe 4.0 x8",released:"2023-Q4",rating:8.6,inStock:true,sources:["amd_official"],notes:"16 GB GDDR6 ECC. 100W. Alternative to RTX 4000 Ada.",topology:"Navi33",memBusWidth:128,boostClockMHz:2166,useCase:["LLM Inference","Embeddings","RAG"],tokensPerSec:{llama70b:null,llama8b:42,mistral7b:47}},
  {id:"amd_pro_w7600",name:"AMD Radeon PRO W7600",shortName:"Pro W7600",brand:"AMD",series:"Radeon PRO W7000",gen:"RDNA 3",segment:"workstation",vram:8,vramType:"GDDR6 ECC",priceUSD:599,tdp:70,bandwidth:192,fp16:15.0,fp8:null,int8:30.0,fp4:null,nvlink:false,pcie:"PCIe 4.0 x8",released:"2023-Q2",rating:8.0,inStock:true,sources:["amd_official"],notes:"8 GB GDDR6 ECC. 70W. Budget workstation GPU.",topology:"Navi33",memBusWidth:128,boostClockMHz:2166,useCase:["Embeddings","Small LLMs"],tokensPerSec:{llama70b:null,llama8b:null,mistral7b:22}},
  {id:"amd_pro_w7500",name:"AMD Radeon PRO W7500",shortName:"Pro W7500",brand:"AMD",series:"Radeon PRO W7000",gen:"RDNA 3",segment:"workstation",vram:8,vramType:"GDDR6 ECC",priceUSD:429,tdp:50,bandwidth:144,fp16:11.8,fp8:null,int8:23.6,fp4:null,nvlink:false,pcie:"PCIe 4.0 x8",released:"2023-Q2",rating:7.5,inStock:true,sources:["amd_official"],notes:"8 GB GDDR6 ECC. 50W passive. Low-profile workstation.",topology:"Navi34",memBusWidth:96,boostClockMHz:1920,useCase:["Embeddings"],tokensPerSec:{llama70b:null,llama8b:null,mistral7b:16}},
  {id:"amd_pro_w9000",name:"AMD Radeon PRO W9000",shortName:"Pro W9000",brand:"AMD",series:"Radeon PRO W9000",gen:"RDNA 4",segment:"workstation",vram:48,vramType:"GDDR6 ECC",priceUSD:4500,tdp:295,bandwidth:960,fp16:80,fp8:320,int8:160,fp4:null,nvlink:false,pcie:"PCIe 5.0 x16",released:"2025-Q3",rating:9.5,inStock:false,sources:["amd_official"],notes:"48 GB GDDR6 ECC. RDNA 4 with FP8 support. ROCm 7.x. Next-gen AMD workstation.",topology:"Navi48",memBusWidth:384,boostClockMHz:2600,useCase:["LLM Inference","RAG","Rendering","Vision"],tokensPerSec:{llama70b:null,llama8b:148,mistral7b:165}},
  // ── Intel Gaudi AI Accelerators ──
  {id:"gaudi2",name:"Intel Gaudi 2",shortName:"Gaudi 2",brand:"Intel",series:"Intel Gaudi",gen:"Gaudi 2",segment:"datacenter",vram:96,vramType:"HBM2E",priceUSD:12000,tdp:600,bandwidth:2450,fp16:865,fp8:1730,int8:3460,fp4:null,nvlink:false,pcie:"PCIe 4.0 x16 / OAM",released:"2022-Q4",rating:9.0,inStock:true,sources:["intel_official","intel_gaudi"],notes:"96 GB HBM2E. 2.45 TB/s. 865 TFLOPS BF16. Habana SynapseAI SDK.",topology:"Gaudi2",useCase:["LLM Training","LLM Inference","RAG"],cudaCores:null,memBusWidth:6144,boostClockMHz:1650,tokensPerSec:{llama70b:40,llama8b:320,mistral7b:360}},
  {id:"gaudi3",name:"Intel Gaudi 3",shortName:"Gaudi 3",brand:"Intel",series:"Intel Gaudi",gen:"Gaudi 3",segment:"datacenter",vram:128,vramType:"HBM2E",priceUSD:20000,tdp:900,bandwidth:3700,fp16:1835,fp8:3670,int8:7340,fp4:null,nvlink:false,pcie:"OAM",released:"2024-Q2",rating:9.4,inStock:false,sources:["intel_official","intel_gaudi"],notes:"128 GB HBM2E. 3.7 TB/s. 1835 TFLOPS BF16. Next-gen Habana.",topology:"Gaudi3",useCase:["LLM Training","LLM Inference"],cudaCores:null,memBusWidth:8192,boostClockMHz:1750,tokensPerSec:{llama70b:65,llama8b:520,mistral7b:580}},
  // ── Intel Arc ──
  {id:"intel_b580",name:"Intel Arc B580",shortName:"Arc B580",brand:"Intel",series:"Intel Arc B",gen:"Battlemage",segment:"consumer",vram:12,vramType:"GDDR6",priceUSD:249,tdp:190,bandwidth:456,fp16:23,fp8:46,int8:92,fp4:null,nvlink:false,pcie:"PCIe 4.0 x8",released:"2024-Q4",rating:8.0,inStock:true,sources:["intel_official","amazon_us","newegg"],notes:"12 GB GDDR6. OpenVINO + IPEX-LLM.",topology:"Battlemage",useCase:["LLM Inference","Embeddings"],tokensPerSec:{llama70b:null,llama8b:32,mistral7b:36}},
  {id:"intel_b770",name:"Intel Arc B770",shortName:"Arc B770",brand:"Intel",series:"Intel Arc B",gen:"Battlemage",segment:"consumer",vram:16,vramType:"GDDR6",priceUSD:349,tdp:225,bandwidth:512,fp16:32,fp8:64,int8:128,fp4:null,nvlink:false,pcie:"PCIe 4.0 x16",released:"2025-Q1",rating:8.3,inStock:true,sources:["intel_official","amazon_us","newegg"],notes:"16 GB GDDR6. Battlemage flagship.",topology:"Battlemage",useCase:["LLM Inference","Embeddings"],tokensPerSec:{llama70b:null,llama8b:42,mistral7b:47}},
  {id:"intel_a770",name:"Intel Arc A770 16GB",shortName:"Arc A770 16GB",brand:"Intel",series:"Intel Arc A",gen:"Alchemist",segment:"consumer",vram:16,vramType:"GDDR6",priceUSD:249,tdp:225,bandwidth:560,fp16:17.2,fp8:null,int8:34.4,fp4:null,nvlink:false,pcie:"PCIe 4.0 x16",released:"2022-Q4",rating:7.8,inStock:true,sources:["intel_official","amazon_us","newegg"],notes:"16 GB GDDR6. OneAPI + IPEX-LLM.",topology:"Alchemist",useCase:["LLM Inference","Embeddings"],tokensPerSec:{llama70b:null,llama8b:22,mistral7b:25}},
  // ── Apple Silicon ──
  {id:"apple_m4_ultra",name:"Apple M4 Ultra (80-core GPU)",shortName:"M4 Ultra (80c GPU)",brand:"Apple",series:"Apple M4",gen:"M4",segment:"consumer",vram:192,vramType:"LPDDR5X Unified",priceUSD:6999,tdp:80,bandwidth:819,fp16:42.4,fp8:null,int8:84.8,fp4:null,nvlink:false,pcie:"Custom",released:"2025-Q1",rating:9.8,inStock:true,sources:["apple_official"],notes:"192 GB unified. 819 GB/s. M4 flagship.",topology:"M4 Ultra",useCase:["LLM Inference","LLM Training","Coding"],tokensPerSec:{llama70b:22,llama8b:185,mistral7b:210}},
  {id:"apple_m4_max",name:"Apple M4 Max (40-core GPU)",shortName:"M4 Max (40c GPU)",brand:"Apple",series:"Apple M4",gen:"M4",segment:"consumer",vram:128,vramType:"LPDDR5X Unified",priceUSD:3499,tdp:40,bandwidth:546,fp16:21.2,fp8:null,int8:42.4,fp4:null,nvlink:false,pcie:"Custom",released:"2024-Q4",rating:9.5,inStock:true,sources:["apple_official"],notes:"128 GB unified. Metal + MLX. 546 GB/s.",topology:"M4 Max",useCase:["LLM Inference","Coding","Agentic AI"],tokensPerSec:{llama70b:12,llama8b:110,mistral7b:125}},
  {id:"apple_m4_pro",name:"Apple M4 Pro (20-core GPU)",shortName:"M4 Pro (20c GPU)",brand:"Apple",series:"Apple M4",gen:"M4",segment:"consumer",vram:64,vramType:"LPDDR5X Unified",priceUSD:1999,tdp:30,bandwidth:273,fp16:10.6,fp8:null,int8:21.2,fp4:null,nvlink:false,pcie:"Custom",released:"2024-Q4",rating:9.2,inStock:true,sources:["apple_official"],notes:"64 GB unified. MLX framework. Great efficiency.",topology:"M4 Pro",useCase:["LLM Inference","Coding"],tokensPerSec:{llama70b:null,llama8b:55,mistral7b:62}},
  {id:"apple_m3_max",name:"Apple M3 Max (40-core GPU)",shortName:"M3 Max (40c GPU)",brand:"Apple",series:"Apple M3",gen:"M3",segment:"consumer",vram:128,vramType:"LPDDR5 Unified",priceUSD:3199,tdp:40,bandwidth:400,fp16:14.2,fp8:null,int8:28.4,fp4:null,nvlink:false,pcie:"Custom",released:"2023-Q4",rating:9.3,inStock:true,sources:["apple_official"],notes:"128 GB unified. 400 GB/s BW.",topology:"M3 Max",useCase:["LLM Inference","Coding"],tokensPerSec:{llama70b:10,llama8b:82,mistral7b:92}},
  {id:"apple_m2_ultra",name:"Apple M2 Ultra (76-core GPU)",shortName:"M2 Ultra (76c GPU)",brand:"Apple",series:"Apple M2",gen:"M2",segment:"consumer",vram:192,vramType:"LPDDR5 Unified",priceUSD:5999,tdp:60,bandwidth:800,fp16:26.6,fp8:null,int8:53.2,fp4:null,nvlink:false,pcie:"Custom",released:"2023-Q2",rating:9.4,inStock:true,sources:["apple_official"],notes:"192 GB unified. 800 GB/s. Best Apple AI.",topology:"M2 Ultra",useCase:["LLM Inference","LLM Training","Coding"],tokensPerSec:{llama70b:14,llama8b:115,mistral7b:130}},
  {id:"apple_m3_pro",name:"Apple M3 Pro (18-core GPU)",shortName:"M3 Pro (18c GPU)",brand:"Apple",series:"Apple M3",gen:"M3",segment:"consumer",vram:36,vramType:"LPDDR5 Unified",priceUSD:1999,tdp:30,bandwidth:153,fp16:5.6,fp8:null,int8:11.2,fp4:null,nvlink:false,pcie:"Custom",released:"2023-Q4",rating:8.5,inStock:true,sources:["apple_official"],notes:"36 GB unified. MLX optimized. Good for 13–34B Q4.",topology:"M3 Pro",useCase:["LLM Inference","Coding"],tokensPerSec:{llama70b:null,llama8b:26,mistral7b:30}},
  {id:"apple_m4",name:"Apple M4 (10-core GPU)",shortName:"M4 (10c GPU)",brand:"Apple",series:"Apple M4",gen:"M4",segment:"consumer",vram:16,vramType:"LPDDR5X Unified",priceUSD:1299,tdp:20,bandwidth:120,fp16:4.2,fp8:null,int8:8.4,fp4:null,nvlink:false,pcie:"Custom",released:"2024-Q4",rating:8.0,inStock:true,sources:["apple_official"],notes:"16 GB unified. Entry M4. Efficient 7B inference.",topology:"M4",useCase:["Embeddings","Small LLMs"],tokensPerSec:{llama70b:null,llama8b:18,mistral7b:20}},
];

// ─── ML MODELS ─────────────────────────────────────────────────────────────────
const MODELS = [
  {id:"llama3_70b",name:"Llama 3.3 70B",family:"Llama 3",params:70,category:"LLM",developer:"Meta",license:"Llama Community",released:"2024-12",contextLen:131072,hfUrl:"https://huggingface.co/meta-llama/Llama-3.3-70B-Instruct",
    arch:{layers:80,heads:8,headDim:128},
    quants:[{format:"BF16",size:140,vramReq:148,speed:7,quality:100,ppl:6.0,bpw:16},{format:"GGUF FP16",size:140,vramReq:148,speed:6,quality:100,ppl:6.0,bpw:16},{format:"Q8_0",size:75,vramReq:80,speed:12,quality:99,ppl:6.1,bpw:8},{format:"Q6_K",size:58,vramReq:62,speed:15,quality:98,ppl:6.15,bpw:6.5},{format:"Q5_K_M",size:50,vramReq:54,speed:18,quality:96,ppl:6.2,bpw:5.5},{format:"Q5_K_S",size:47,vramReq:51,speed:20,quality:95,ppl:6.25,bpw:5.25},{format:"Q5_0",size:45,vramReq:49,speed:22,quality:94,ppl:6.28,bpw:5},{format:"Q4_K_M",size:42.5,vramReq:46,speed:23,quality:93,ppl:6.35,bpw:4.5},{format:"Q4_K_S",size:40,vramReq:44,speed:26,quality:92,ppl:6.4,bpw:4.25},{format:"IQ4_XS",size:40,vramReq:44,speed:25,quality:92,ppl:6.38,bpw:4.25},{format:"Q4_0",size:37,vramReq:40,speed:28,quality:90,ppl:6.5,bpw:4},{format:"Q4_1",size:38,vramReq:42,speed:27,quality:91,ppl:6.45,bpw:4},{format:"Q3_K_L",size:33.5,vramReq:37,speed:30,quality:87,ppl:6.75,bpw:3.5},{format:"Q3_K_M",size:31,vramReq:34,speed:33,quality:85,ppl:6.9,bpw:3.35},{format:"Q3_K_S",size:28.5,vramReq:32,speed:36,quality:83,ppl:7.0,bpw:3.25},{format:"IQ3_M",size:29.5,vramReq:33,speed:34,quality:84,ppl:6.95,bpw:3.06},{format:"Q2_K",size:23,vramReq:26,speed:44,quality:76,ppl:7.3,bpw:2.63},{format:"IQ2_XXS",size:19.5,vramReq:22,speed:52,quality:72,ppl:7.8,bpw:2.3},{format:"IQ1_S",size:13,vramReq:16,speed:72,quality:58,ppl:8.5,bpw:1.56}],
    benchmarks:{mmlu:86,hellaswag:91.2,arc:83.5,gsm8k:79,humaneval:72},
    stressTests:[{hw:"RTX 4090",tokens_sec:18,ctx:8192,latency_ms:55,vram_used:42,score:92},{hw:"H100 SXM",tokens_sec:58,ctx:32768,latency_ms:17,vram_used:78,score:100},{hw:"MI300X",tokens_sec:55,ctx:32768,latency_ms:18,vram_used:78,score:98},{hw:"M4 Ultra",tokens_sec:22,ctx:32768,latency_ms:45,vram_used:48,score:90}]},
  {id:"llama3_8b",name:"Llama 3.2 8B",family:"Llama 3",params:8,category:"LLM",developer:"Meta",license:"Llama Community",released:"2024-09",contextLen:131072,hfUrl:"https://huggingface.co/meta-llama/Llama-3.2-8B-Instruct",
    arch:{layers:32,heads:8,headDim:128},
    quants:[{format:"BF16",size:16,vramReq:18,speed:44,quality:100,ppl:6.55,bpw:16},{format:"GGUF FP16",size:16,vramReq:18,speed:42,quality:100,ppl:6.55,bpw:16},{format:"Q8_0",size:8.5,vramReq:10,speed:85,quality:99,ppl:6.6,bpw:8},{format:"Q6_K",size:6.6,vramReq:7.5,speed:110,quality:98,ppl:6.65,bpw:6.5},{format:"Q5_K_M",size:5.7,vramReq:6.5,speed:125,quality:96,ppl:6.7,bpw:5.5},{format:"Q5_K_S",size:5.3,vramReq:6.1,speed:132,quality:95,ppl:6.73,bpw:5.25},{format:"Q5_0",size:5.1,vramReq:5.8,speed:138,quality:94,ppl:6.76,bpw:5},{format:"Q4_K_M",size:4.9,vramReq:5.5,speed:155,quality:93,ppl:6.85,bpw:4.5},{format:"Q4_K_S",size:4.6,vramReq:5.2,speed:165,quality:92,ppl:6.9,bpw:4.25},{format:"IQ4_XS",size:4.6,vramReq:5.2,speed:160,quality:92,ppl:6.88,bpw:4.25},{format:"Q4_0",size:4.3,vramReq:4.9,speed:175,quality:90,ppl:7.0,bpw:4},{format:"Q3_K_M",size:3.6,vramReq:4.2,speed:210,quality:82,ppl:7.5,bpw:3.35},{format:"Q3_K_S",size:3.3,vramReq:3.9,speed:228,quality:80,ppl:7.65,bpw:3.25},{format:"Q2_K",size:2.7,vramReq:3.2,speed:270,quality:74,ppl:8.0,bpw:2.63},{format:"IQ2_XXS",size:2.3,vramReq:2.8,speed:290,quality:70,ppl:8.5,bpw:2.3},{format:"IQ1_S",size:1.6,vramReq:2.1,speed:380,quality:55,ppl:10.0,bpw:1.56}],
    benchmarks:{mmlu:73,hellaswag:82.5,arc:72,gsm8k:76.6,humaneval:68},
    stressTests:[{hw:"RTX 4060",tokens_sec:55,ctx:8192,latency_ms:18,vram_used:5.5,score:88},{hw:"RTX 5070",tokens_sec:95,ctx:16384,latency_ms:10,vram_used:5.5,score:99},{hw:"M4 Max",tokens_sec:110,ctx:32768,latency_ms:9,vram_used:5.5,score:99},{hw:"Arc B580",tokens_sec:32,ctx:8192,latency_ms:31,vram_used:5.5,score:82}]},
  {id:"deepseek_r1_70b",name:"DeepSeek-R1 70B",family:"DeepSeek",params:70,category:"Reasoning",developer:"DeepSeek",license:"MIT",released:"2025-01",contextLen:65536,hfUrl:"https://huggingface.co/deepseek-ai/DeepSeek-R1",
    arch:{layers:80,heads:8,headDim:128},
    quants:[{format:"Q8_0",size:75,vramReq:80,speed:11,quality:100,ppl:4.8,bpw:8},{format:"Q5_K_M",size:50,vramReq:54,speed:16,quality:96,ppl:5.0,bpw:5.5},{format:"Q4_K_M",size:42,vramReq:46,speed:22,quality:93,ppl:5.1,bpw:4.5},{format:"Q3_K_M",size:31,vramReq:34,speed:32,quality:84,ppl:5.5,bpw:3.35},{format:"IQ2_XXS",size:19.5,vramReq:22,speed:50,quality:71,ppl:6.8,bpw:2.3}],
    benchmarks:{mmlu:84,hellaswag:90,arc:82,gsm8k:95,humaneval:89},
    stressTests:[{hw:"RTX 4090",tokens_sec:16,ctx:8192,latency_ms:62,vram_used:44,score:90},{hw:"H100 SXM",tokens_sec:52,ctx:32768,latency_ms:19,vram_used:78,score:99},{hw:"MI300X",tokens_sec:50,ctx:32768,latency_ms:20,vram_used:78,score:97}]},
  {id:"deepseek_r1_7b",name:"DeepSeek-R1 7B",family:"DeepSeek",params:7,category:"Reasoning",developer:"DeepSeek",license:"MIT",released:"2025-01",contextLen:65536,hfUrl:"https://huggingface.co/deepseek-ai/DeepSeek-R1-Distill-Qwen-7B",
    arch:{layers:28,heads:4,headDim:128},
    quants:[{format:"Q8_0",size:7.7,vramReq:9,speed:88,quality:100,ppl:4.2,bpw:8},{format:"Q4_K_M",size:4.4,vramReq:5.5,speed:168,quality:93,ppl:4.5,bpw:4.5},{format:"Q3_K_M",size:3.2,vramReq:4,speed:240,quality:82,ppl:5.0,bpw:3.35}],
    benchmarks:{mmlu:72,hellaswag:83,arc:74,gsm8k:90,humaneval:81},
    stressTests:[{hw:"RTX 3060 12GB",tokens_sec:52,ctx:8192,latency_ms:19,vram_used:5.2,score:90},{hw:"M4 Pro",tokens_sec:78,ctx:16384,latency_ms:13,vram_used:5.2,score:97}]},
  {id:"gemma2_27b",name:"Gemma 2 27B Instruct",family:"Gemma",params:27,category:"LLM",developer:"Google DeepMind",license:"Gemma Terms (Open Weights)",released:"2024-06",contextLen:8192,hfUrl:"https://huggingface.co/google/gemma-2-27b-it",
    arch:{layers:46,heads:16,headDim:128},
    quants:[{format:"BF16",size:54,vramReq:58,speed:15,quality:100,ppl:6.1,bpw:16},{format:"Q8_0",size:29,vramReq:31,speed:28,quality:99,ppl:6.15,bpw:8},{format:"Q6_K",size:22,vramReq:24,speed:35,quality:98,ppl:6.2,bpw:6.5},{format:"Q5_K_M",size:19,vramReq:21,speed:42,quality:96,ppl:6.3,bpw:5.5},{format:"Q4_K_M",size:16.5,vramReq:18.5,speed:52,quality:93,ppl:6.45,bpw:4.5},{format:"Q3_K_M",size:12.5,vramReq:14.5,speed:68,quality:84,ppl:7.0,bpw:3.35},{format:"Q2_K",size:10,vramReq:12,speed:88,quality:74,ppl:7.8,bpw:2.63},{format:"IQ2_XXS",size:8.2,vramReq:10,speed:100,quality:70,ppl:8.2,bpw:2.3}],
    benchmarks:{mmlu:75.2,hellaswag:87.8,arc:75.9,gsm8k:77.2,humaneval:51.8},
    stressTests:[{hw:"RTX 4090",tokens_sec:28,ctx:8192,latency_ms:36,vram_used:16.5,score:88},{hw:"RTX 3090",tokens_sec:22,ctx:8192,latency_ms:45,vram_used:16.5,score:82},{hw:"M4 Max",tokens_sec:35,ctx:8192,latency_ms:29,vram_used:16.5,score:92}]},
  {id:"gemma3_12b",name:"Gemma 3 12B Instruct",family:"Gemma 3",params:12,category:"LLM",developer:"Google DeepMind",license:"Gemma Terms (Open Weights)",released:"2025-03",contextLen:131072,hfUrl:"https://huggingface.co/google/gemma-3-12b-it",
    arch:{layers:46,heads:8,headDim:256},
    quants:[{format:"BF16",size:24,vramReq:27,speed:40,quality:100,ppl:5.8,bpw:16},{format:"Q8_0",size:13,vramReq:15,speed:78,quality:99,ppl:5.85,bpw:8},{format:"Q6_K",size:10,vramReq:12,speed:98,quality:98,ppl:5.9,bpw:6.5},{format:"Q5_K_M",size:8.5,vramReq:10,speed:115,quality:96,ppl:5.95,bpw:5.5},{format:"Q4_K_M",size:7.5,vramReq:9,speed:138,quality:93,ppl:6.1,bpw:4.5},{format:"Q3_K_M",size:5.8,vramReq:7,speed:172,quality:84,ppl:6.5,bpw:3.35},{format:"Q2_K",size:4.5,vramReq:5.5,speed:210,quality:74,ppl:7.2,bpw:2.63},{format:"IQ2_XXS",size:4.2,vramReq:5,speed:240,quality:70,ppl:7.8,bpw:2.3}],
    benchmarks:{mmlu:74.5,hellaswag:85.2,arc:74.1,gsm8k:80.6,humaneval:62.3},
    stressTests:[{hw:"RTX 4060",tokens_sec:62,ctx:16384,latency_ms:16,vram_used:7.5,score:90},{hw:"RTX 3060 12GB",tokens_sec:45,ctx:16384,latency_ms:22,vram_used:7.5,score:84},{hw:"M4 Pro",tokens_sec:88,ctx:32768,latency_ms:11,vram_used:7.5,score:96}]},
  {id:"gemma3_27b",name:"Gemma 3 27B Instruct",family:"Gemma 3",params:27,category:"LLM",developer:"Google DeepMind",license:"Gemma Terms (Open Weights)",released:"2025-03",contextLen:131072,hfUrl:"https://huggingface.co/google/gemma-3-27b-it",
    arch:{layers:62,heads:16,headDim:128},
    quants:[{format:"BF16",size:54,vramReq:58,speed:14,quality:100,ppl:5.6,bpw:16},{format:"Q8_0",size:29,vramReq:31,speed:26,quality:99,ppl:5.65,bpw:8},{format:"Q6_K",size:22,vramReq:24,speed:33,quality:98,ppl:5.7,bpw:6.5},{format:"Q5_K_M",size:19,vramReq:21,speed:40,quality:96,ppl:5.8,bpw:5.5},{format:"Q4_K_M",size:16.5,vramReq:18.5,speed:50,quality:93,ppl:6.0,bpw:4.5},{format:"Q3_K_M",size:12.5,vramReq:14.5,speed:65,quality:84,ppl:6.5,bpw:3.35},{format:"Q2_K",size:9.8,vramReq:11.8,speed:84,quality:73,ppl:7.3,bpw:2.63},{format:"IQ2_XXS",size:8.2,vramReq:10,speed:96,quality:69,ppl:7.9,bpw:2.3}],
    benchmarks:{mmlu:81.2,hellaswag:89.1,arc:78.4,gsm8k:84.5,humaneval:69.2},
    stressTests:[{hw:"RTX 4090",tokens_sec:26,ctx:16384,latency_ms:38,vram_used:16.5,score:88},{hw:"H100 SXM",tokens_sec:82,ctx:32768,latency_ms:12,vram_used:16.5,score:99},{hw:"M4 Max",tokens_sec:33,ctx:32768,latency_ms:30,vram_used:16.5,score:91}]},
  {id:"phi4_14b",name:"Phi-4 14B",family:"Phi",params:14,category:"Code",developer:"Microsoft",license:"MIT License",released:"2024-12",contextLen:16384,hfUrl:"https://huggingface.co/microsoft/phi-4",
    arch:{layers:40,heads:16,headDim:128},
    quants:[{format:"BF16",size:28,vramReq:31,speed:32,quality:100,ppl:4.2,bpw:16},{format:"Q8_0",size:15,vramReq:17,speed:62,quality:99,ppl:4.25,bpw:8},{format:"Q6_K",size:11.5,vramReq:13.5,speed:80,quality:98,ppl:4.3,bpw:6.5},{format:"Q5_K_M",size:10,vramReq:12,speed:95,quality:96,ppl:4.35,bpw:5.5},{format:"Q4_K_M",size:8.8,vramReq:10.5,speed:112,quality:93,ppl:4.45,bpw:4.5},{format:"Q4_K_S",size:8.3,vramReq:10,speed:120,quality:92,ppl:4.5,bpw:4.25},{format:"Q3_K_M",size:6.8,vramReq:8.2,speed:148,quality:84,ppl:4.9,bpw:3.35},{format:"Q2_K",size:5.2,vramReq:6.5,speed:188,quality:73,ppl:5.5,bpw:2.63},{format:"IQ2_XXS",size:4.8,vramReq:6,speed:210,quality:69,ppl:6.0,bpw:2.3}],
    benchmarks:{mmlu:84.8,hellaswag:87.0,arc:79.4,gsm8k:91.2,humaneval:82.6},
    stressTests:[{hw:"RTX 4060 Ti 16GB",tokens_sec:65,ctx:8192,latency_ms:15,vram_used:8.8,score:91},{hw:"RTX 4090",tokens_sec:112,ctx:16384,latency_ms:9,vram_used:8.8,score:99},{hw:"M4 Pro",tokens_sec:80,ctx:16384,latency_ms:12,vram_used:8.8,score:96}]},
  {id:"qwen2_72b",name:"Qwen 2.5 72B Instruct",family:"Qwen",params:72,category:"LLM",developer:"Alibaba",license:"Qwen",released:"2024-09",contextLen:131072,hfUrl:"https://huggingface.co/Qwen/Qwen2.5-72B-Instruct",
    arch:{layers:80,heads:8,headDim:128},
    quants:[{format:"Q8_0",size:77,vramReq:82,speed:11,quality:100,ppl:5.1,bpw:8},{format:"Q5_K_M",size:51,vramReq:55,speed:17,quality:96,ppl:5.2,bpw:5.5},{format:"Q4_K_M",size:43.5,vramReq:47,speed:22,quality:93,ppl:5.35,bpw:4.5},{format:"Q3_K_M",size:32,vramReq:35,speed:32,quality:84,ppl:5.8,bpw:3.35},{format:"IQ2_XXS",size:20,vramReq:23,speed:50,quality:72,ppl:6.8,bpw:2.3}],
    benchmarks:{mmlu:86.1,hellaswag:91.8,arc:85,gsm8k:89.3,humaneval:78},
    stressTests:[{hw:"RTX 4090",tokens_sec:17,ctx:8192,latency_ms:59,vram_used:44,score:91},{hw:"MI300X",tokens_sec:52,ctx:32768,latency_ms:19,vram_used:80,score:97},{hw:"M4 Ultra",tokens_sec:19,ctx:32768,latency_ms:52,vram_used:50,score:89}]},
  {id:"qwen2_7b",name:"Qwen 2.5 7B Instruct",family:"Qwen",params:7,category:"LLM",developer:"Alibaba",license:"Apache 2.0",released:"2024-09",contextLen:131072,hfUrl:"https://huggingface.co/Qwen/Qwen2.5-7B-Instruct",
    arch:{layers:28,heads:4,headDim:128},
    quants:[{format:"Q8_0",size:7.6,vramReq:9,speed:92,quality:100,ppl:5.0,bpw:8},{format:"Q4_K_M",size:4.4,vramReq:5.5,speed:170,quality:93,ppl:5.3,bpw:4.5},{format:"Q3_K_M",size:3.2,vramReq:4,speed:245,quality:82,ppl:5.8,bpw:3.35}],
    benchmarks:{mmlu:74,hellaswag:84,arc:75,gsm8k:82,humaneval:72},
    stressTests:[{hw:"RTX 3060 12GB",tokens_sec:58,ctx:8192,latency_ms:17,vram_used:5.2,score:92},{hw:"Arc B580",tokens_sec:35,ctx:8192,latency_ms:29,vram_used:5.2,score:80}]},
  {id:"mistral_7b",name:"Mistral 7B v0.3",family:"Mistral",params:7,category:"LLM",developer:"Mistral AI",license:"Apache 2.0",released:"2024-05",contextLen:32768,hfUrl:"https://huggingface.co/mistralai/Mistral-7B-Instruct-v0.3",
    arch:{layers:32,heads:8,headDim:128},
    quants:[{format:"BF16",size:14.5,vramReq:16,speed:50,quality:100,ppl:5.2,bpw:16},{format:"GGUF FP16",size:14.5,vramReq:16,speed:48,quality:100,ppl:5.2,bpw:16},{format:"Q8_0",size:7.7,vramReq:9,speed:90,quality:99,ppl:5.25,bpw:8},{format:"Q6_K",size:6.0,vramReq:7,speed:118,quality:98,ppl:5.3,bpw:6.5},{format:"Q5_K_M",size:5.1,vramReq:6,speed:135,quality:96,ppl:5.35,bpw:5.5},{format:"Q5_K_S",size:4.8,vramReq:5.6,speed:143,quality:95,ppl:5.38,bpw:5.25},{format:"Q4_K_M",size:4.4,vramReq:5.5,speed:165,quality:93,ppl:5.5,bpw:4.5},{format:"Q4_K_S",size:4.1,vramReq:5.0,speed:175,quality:92,ppl:5.55,bpw:4.25},{format:"IQ4_XS",size:4.1,vramReq:5.0,speed:172,quality:92,ppl:5.52,bpw:4.25},{format:"Q4_0",size:3.9,vramReq:4.6,speed:185,quality:90,ppl:5.65,bpw:4},{format:"Q3_K_M",size:3.2,vramReq:3.8,speed:240,quality:81,ppl:6.1,bpw:3.35},{format:"Q3_K_S",size:2.9,vramReq:3.5,speed:260,quality:79,ppl:6.25,bpw:3.25},{format:"Q2_K",size:2.4,vramReq:2.9,speed:298,quality:72,ppl:6.8,bpw:2.63},{format:"IQ2_XXS",size:2.1,vramReq:2.6,speed:310,quality:68,ppl:7.2,bpw:2.3},{format:"IQ1_S",size:1.4,vramReq:1.9,speed:420,quality:52,ppl:9.5,bpw:1.56}],
    benchmarks:{mmlu:64.2,hellaswag:81.3,arc:70,gsm8k:52.1,humaneval:50},
    stressTests:[{hw:"RTX 3060",tokens_sec:28,ctx:8192,latency_ms:36,vram_used:4.8,score:82},{hw:"Arc B580",tokens_sec:38,ctx:8192,latency_ms:26,vram_used:4.8,score:88},{hw:"M4 Pro",tokens_sec:62,ctx:16384,latency_ms:16,vram_used:4.8,score:95}]},
  {id:"mistral_nemo",name:"Mistral Nemo 12B",family:"Mistral",params:12,category:"LLM",developer:"Mistral AI",license:"Apache 2.0",released:"2024-07",contextLen:128000,hfUrl:"https://huggingface.co/mistralai/Mistral-Nemo-Instruct-2407",
    arch:{layers:40,heads:8,headDim:128},
    quants:[{format:"Q8_0",size:13,vramReq:15,speed:55,quality:100,ppl:5.1,bpw:8},{format:"Q4_K_M",size:7.5,vramReq:9,speed:105,quality:93,ppl:5.4,bpw:4.5},{format:"Q3_K_M",size:5.5,vramReq:7,speed:150,quality:82,ppl:6.0,bpw:3.35}],
    benchmarks:{mmlu:68,hellaswag:83,arc:71,gsm8k:60,humaneval:54},
    stressTests:[{hw:"RTX 4060 Ti 16GB",tokens_sec:62,ctx:16384,latency_ms:16,vram_used:9,score:92},{hw:"RTX 3090",tokens_sec:78,ctx:16384,latency_ms:13,vram_used:9,score:95}]},
  {id:"phi4",name:"Phi-4 14B",family:"Phi",params:14,category:"LLM",developer:"Microsoft",license:"MIT",released:"2024-12",contextLen:16384,hfUrl:"https://huggingface.co/microsoft/phi-4",
    arch:{layers:40,heads:8,headDim:128},
    quants:[{format:"Q8_0",size:15,vramReq:17,speed:48,quality:100,ppl:4.9,bpw:8},{format:"Q4_K_M",size:8.5,vramReq:10.5,speed:95,quality:93,ppl:5.2,bpw:4.5},{format:"Q3_K_M",size:6.2,vramReq:8,speed:135,quality:82,ppl:5.7,bpw:3.35}],
    benchmarks:{mmlu:84,hellaswag:87,arc:80,gsm8k:90,humaneval:78},
    stressTests:[{hw:"RTX 4060 Ti 16GB",tokens_sec:58,ctx:8192,latency_ms:17,vram_used:10,score:90},{hw:"M4 Max",tokens_sec:82,ctx:16384,latency_ms:12,vram_used:10,score:97}]},
  {id:"phi4_mini",name:"Phi-4 Mini 4B",family:"Phi",params:3.8,category:"LLM",developer:"Microsoft",license:"MIT",released:"2025-02",contextLen:128000,hfUrl:"https://huggingface.co/microsoft/phi-4-mini-instruct",
    arch:{layers:32,heads:8,headDim:96},
    quants:[{format:"Q8_0",size:4.1,vramReq:5,speed:160,quality:100,ppl:5.0,bpw:8},{format:"Q4_K_M",size:2.4,vramReq:3,speed:270,quality:93,ppl:5.3,bpw:4.5},{format:"Q3_K_M",size:1.8,vramReq:2.2,speed:390,quality:82,ppl:5.9,bpw:3.35}],
    benchmarks:{mmlu:70,hellaswag:75,arc:70,gsm8k:88,humaneval:62},
    stressTests:[{hw:"Jetson Orin NX 16GB",tokens_sec:24,ctx:4096,latency_ms:42,vram_used:2.8,score:88},{hw:"Arc B580",tokens_sec:85,ctx:8192,latency_ms:12,vram_used:2.8,score:96}]},
  {id:"gemma3_27b",name:"Gemma 3 27B",family:"Gemma",params:27,category:"LLM",developer:"Google",license:"Gemma",released:"2025-03",contextLen:131072,hfUrl:"https://huggingface.co/google/gemma-3-27b-it",
    arch:{layers:46,heads:8,headDim:128},
    quants:[{format:"Q8_0",size:29,vramReq:32,speed:28,quality:100,ppl:5.4,bpw:8},{format:"Q4_K_M",size:16.5,vramReq:19,speed:55,quality:93,ppl:5.7,bpw:4.5},{format:"Q3_K_M",size:12,vramReq:14,speed:80,quality:84,ppl:6.2,bpw:3.35}],
    benchmarks:{mmlu:78,hellaswag:86,arc:78,gsm8k:82,humaneval:74},
    stressTests:[{hw:"RTX 4090",tokens_sec:42,ctx:16384,latency_ms:24,vram_used:18,score:95},{hw:"M4 Max",tokens_sec:35,ctx:32768,latency_ms:28,vram_used:18,score:92}]},
  {id:"gemma3_12b",name:"Gemma 3 12B",family:"Gemma",params:12,category:"LLM",developer:"Google",license:"Gemma",released:"2025-03",contextLen:131072,hfUrl:"https://huggingface.co/google/gemma-3-12b-it",
    arch:{layers:36,heads:8,headDim:128},
    quants:[{format:"Q8_0",size:13,vramReq:15,speed:55,quality:100,ppl:5.2,bpw:8},{format:"Q4_K_M",size:7.5,vramReq:9,speed:105,quality:93,ppl:5.5,bpw:4.5},{format:"Q3_K_M",size:5.5,vramReq:7,speed:150,quality:82,ppl:6.0,bpw:3.35}],
    benchmarks:{mmlu:74,hellaswag:84,arc:76,gsm8k:75,humaneval:68},
    stressTests:[{hw:"RTX 4060",tokens_sec:65,ctx:16384,latency_ms:15,vram_used:9,score:92},{hw:"Arc B580",tokens_sec:40,ctx:8192,latency_ms:25,vram_used:9,score:82}]},
  {id:"codestral",name:"Codestral 22B",family:"Mistral",params:22,category:"Code",developer:"Mistral AI",license:"MNPL",released:"2024-05",contextLen:32768,hfUrl:"https://huggingface.co/mistralai/Codestral-22B-v0.1",
    arch:{layers:40,heads:8,headDim:128},
    quants:[{format:"Q8_0",size:23.5,vramReq:26,speed:38,quality:100,ppl:4.8,bpw:8},{format:"Q4_K_M",size:13.5,vramReq:16,speed:72,quality:93,ppl:5.1,bpw:4.5},{format:"Q3_K_M",size:9.8,vramReq:12,speed:105,quality:82,ppl:5.6,bpw:3.35}],
    benchmarks:{mmlu:72,hellaswag:82,arc:74,gsm8k:78,humaneval:88},
    stressTests:[{hw:"RTX 3090",tokens_sec:35,ctx:8192,latency_ms:29,vram_used:14,score:90},{hw:"RTX 4090",tokens_sec:65,ctx:16384,latency_ms:15,vram_used:14,score:98}]},
  {id:"qwen2_coder_7b",name:"Qwen2.5-Coder 7B",family:"Qwen",params:7,category:"Code",developer:"Alibaba",license:"Apache 2.0",released:"2024-11",contextLen:131072,hfUrl:"https://huggingface.co/Qwen/Qwen2.5-Coder-7B-Instruct",
    arch:{layers:28,heads:4,headDim:128},
    quants:[{format:"Q8_0",size:7.6,vramReq:9,speed:95,quality:100,ppl:4.5,bpw:8},{format:"Q4_K_M",size:4.4,vramReq:5.5,speed:175,quality:93,ppl:4.8,bpw:4.5},{format:"Q3_K_M",size:3.2,vramReq:4,speed:248,quality:82,ppl:5.3,bpw:3.35}],
    benchmarks:{mmlu:70,hellaswag:80,arc:71,gsm8k:75,humaneval:90},
    stressTests:[{hw:"RTX 3060 12GB",tokens_sec:62,ctx:8192,latency_ms:16,vram_used:5.2,score:92},{hw:"Arc B580",tokens_sec:38,ctx:8192,latency_ms:26,vram_used:5.2,score:80}]},
  {id:"llava_7b",name:"LLaVA 1.6 7B",family:"LLaVA",params:7,category:"Vision",developer:"haotian-liu",license:"Apache 2.0",released:"2024-01",contextLen:32768,hfUrl:"https://huggingface.co/llava-hf/llava-v1.6-mistral-7b-hf",
    arch:{layers:32,heads:8,headDim:128},
    quants:[{format:"Q4_K_M",size:5.5,vramReq:6.5,speed:90,quality:90,ppl:6.5,bpw:4.5},{format:"Q8_0",size:9,vramReq:11,speed:55,quality:99,ppl:6.0,bpw:8}],
    benchmarks:{mmlu:58,hellaswag:77,arc:65,gsm8k:48,humaneval:40},
    stressTests:[{hw:"RTX 4070",tokens_sec:42,ctx:4096,latency_ms:24,vram_used:6,score:88},{hw:"M4 Pro",tokens_sec:55,ctx:8192,latency_ms:18,vram_used:6,score:94}]},
  {id:"llama3_1_405b",name:"Llama 3.1 405B Instruct",family:"Llama 3",params:405,category:"LLM",developer:"Meta",license:"Llama Community",released:"2024-07",contextLen:131072,hfUrl:"https://huggingface.co/meta-llama/Llama-3.1-405B-Instruct",
    arch:{layers:126,heads:8,headDim:128},
    quants:[{format:"BF16",size:810,vramReq:850,speed:1,quality:100,ppl:4.8,bpw:16},{format:"Q8_0",size:433,vramReq:455,speed:2,quality:99,ppl:4.85,bpw:8},{format:"Q5_K_M",size:293,vramReq:312,speed:3,quality:96,ppl:5.0,bpw:5.5},{format:"Q4_K_M",size:244,vramReq:262,speed:4,quality:93,ppl:5.1,bpw:4.5},{format:"Q3_K_M",size:178,vramReq:196,speed:5,quality:84,ppl:5.6,bpw:3.35},{format:"Q2_K",size:133,vramReq:148,speed:7,quality:74,ppl:6.2,bpw:2.63},{format:"IQ2_XXS",size:113,vramReq:130,speed:9,quality:71,ppl:6.5,bpw:2.3},{format:"IQ1_S",size:75,vramReq:90,speed:14,quality:55,ppl:8.0,bpw:1.56}],
    benchmarks:{mmlu:88.6,hellaswag:93,arc:85,gsm8k:89,humaneval:89},
    stressTests:[{hw:"GB200 Superchip",tokens_sec:12,ctx:32768,latency_ms:83,vram_used:262,score:98},{hw:"8× H100 SXM",tokens_sec:7,ctx:32768,latency_ms:143,vram_used:262,score:90},{hw:"2× MI300X",tokens_sec:6,ctx:32768,latency_ms:167,vram_used:262,score:88}]},
  {id:"mixtral_8x7b",name:"Mixtral 8x7B MoE Instruct",family:"Mistral",params:46.7,category:"LLM",developer:"Mistral AI",license:"Apache 2.0",released:"2023-12",contextLen:32768,hfUrl:"https://huggingface.co/mistralai/Mixtral-8x7B-Instruct-v0.1",
    arch:{layers:32,heads:8,headDim:128},
    quants:[{format:"GGUF FP16",size:93,vramReq:100,speed:6,quality:100,ppl:5.8,bpw:16},{format:"Q8_0",size:50,vramReq:55,speed:12,quality:99,ppl:5.85,bpw:8},{format:"Q5_K_M",size:33,vramReq:37,speed:18,quality:96,ppl:6.0,bpw:5.5},{format:"Q5_K_S",size:31,vramReq:35,speed:20,quality:95,ppl:6.05,bpw:5.25},{format:"Q4_K_M",size:28,vramReq:32,speed:24,quality:93,ppl:6.15,bpw:4.5},{format:"Q4_K_S",size:26,vramReq:30,speed:26,quality:92,ppl:6.2,bpw:4.25},{format:"Q3_K_M",size:21,vramReq:25,speed:35,quality:83,ppl:6.7,bpw:3.35},{format:"Q2_K",size:16,vramReq:19,speed:46,quality:72,ppl:7.5,bpw:2.63},{format:"IQ2_XXS",size:13,vramReq:16,speed:58,quality:67,ppl:8.0,bpw:2.3},{format:"IQ1_S",size:9,vramReq:12,speed:78,quality:52,ppl:10.0,bpw:1.56}],
    benchmarks:{mmlu:70.6,hellaswag:81,arc:75,gsm8k:74.4,humaneval:54},
    stressTests:[{hw:"RTX 4090",tokens_sec:22,ctx:8192,latency_ms:45,vram_used:30,score:88},{hw:"2× RTX 3090",tokens_sec:18,ctx:16384,latency_ms:56,vram_used:30,score:85},{hw:"MI300X",tokens_sec:45,ctx:32768,latency_ms:22,vram_used:30,score:96},{hw:"M4 Ultra",tokens_sec:28,ctx:32768,latency_ms:36,vram_used:30,score:92}]},
  {id:"mixtral_8x22b",name:"Mixtral 8x22B MoE Instruct",family:"Mistral",params:141,category:"LLM",developer:"Mistral AI",license:"Apache 2.0",released:"2024-04",contextLen:65536,hfUrl:"https://huggingface.co/mistralai/Mixtral-8x22B-Instruct-v0.1",
    arch:{layers:56,heads:8,headDim:128},
    quants:[{format:"Q8_0",size:151,vramReq:162,speed:6,quality:100,ppl:4.9,bpw:8},{format:"Q5_K_M",size:101,vramReq:111,speed:9,quality:96,ppl:5.1,bpw:5.5},{format:"Q4_K_M",size:86,vramReq:95,speed:12,quality:93,ppl:5.2,bpw:4.5},{format:"Q4_K_S",size:80,vramReq:89,speed:13,quality:92,ppl:5.25,bpw:4.25},{format:"Q3_K_M",size:64,vramReq:72,speed:18,quality:84,ppl:5.7,bpw:3.35},{format:"Q2_K",size:49,vramReq:56,speed:26,quality:72,ppl:6.5,bpw:2.63},{format:"IQ2_XXS",size:40,vramReq:47,speed:32,quality:68,ppl:7.2,bpw:2.3}],
    benchmarks:{mmlu:77.8,hellaswag:88,arc:81,gsm8k:82,humaneval:75},
    stressTests:[{hw:"H100 SXM",tokens_sec:22,ctx:32768,latency_ms:45,vram_used:93,score:95},{hw:"MI300X",tokens_sec:20,ctx:32768,latency_ms:50,vram_used:93,score:92},{hw:"2× A100 80GB",tokens_sec:15,ctx:16384,latency_ms:67,vram_used:93,score:88}]},
  {id:"deepseek_v3",name:"DeepSeek-V3 671B MoE",family:"DeepSeek",params:671,category:"LLM",developer:"DeepSeek",license:"MIT",released:"2024-12",contextLen:131072,hfUrl:"https://huggingface.co/deepseek-ai/DeepSeek-V3",
    arch:{layers:61,heads:8,headDim:128},
    quants:[{format:"Q8_0",size:720,vramReq:755,speed:2,quality:100,ppl:3.9,bpw:8},{format:"Q4_K_M",size:405,vramReq:428,speed:4,quality:93,ppl:4.1,bpw:4.5},{format:"Q3_K_M",size:296,vramReq:317,speed:6,quality:84,ppl:4.6,bpw:3.35},{format:"Q2_K",size:215,vramReq:232,speed:8,quality:73,ppl:5.2,bpw:2.63},{format:"IQ2_XXS",size:182,vramReq:198,speed:10,quality:70,ppl:5.5,bpw:2.3},{format:"IQ1_S",size:120,vramReq:135,speed:14,quality:52,ppl:7.5,bpw:1.56}],
    benchmarks:{mmlu:88.5,hellaswag:92,arc:85,gsm8k:89.3,humaneval:82},
    stressTests:[{hw:"8× H100 SXM",tokens_sec:6,ctx:32768,latency_ms:167,vram_used:430,score:88},{hw:"2× MI300X",tokens_sec:5,ctx:32768,latency_ms:200,vram_used:430,score:85},{hw:"GB200 Superchip",tokens_sec:14,ctx:32768,latency_ms:71,vram_used:430,score:96}]},
  {id:"qwen25_coder_32b",name:"Qwen2.5-Coder 32B Instruct",family:"Qwen",params:32,category:"Code",developer:"Alibaba",license:"Apache 2.0",released:"2024-11",contextLen:131072,hfUrl:"https://huggingface.co/Qwen/Qwen2.5-Coder-32B-Instruct",
    arch:{layers:64,heads:8,headDim:128},
    quants:[{format:"BF16",size:64,vramReq:68,speed:22,quality:100,ppl:4.2,bpw:16},{format:"Q8_0",size:34,vramReq:38,speed:22,quality:99,ppl:4.25,bpw:8},{format:"Q6_K",size:26.5,vramReq:30,speed:30,quality:98,ppl:4.3,bpw:6.5},{format:"Q5_K_M",size:22.5,vramReq:26,speed:35,quality:96,ppl:4.4,bpw:5.5},{format:"Q4_K_M",size:19.5,vramReq:22,speed:42,quality:93,ppl:4.5,bpw:4.5},{format:"Q4_K_S",size:18,vramReq:21,speed:46,quality:92,ppl:4.55,bpw:4.25},{format:"IQ4_XS",size:18,vramReq:21,speed:44,quality:92,ppl:4.52,bpw:4.25},{format:"Q3_K_M",size:14.5,vramReq:17,speed:60,quality:83,ppl:5.0,bpw:3.35},{format:"Q2_K",size:11,vramReq:13,speed:80,quality:71,ppl:5.8,bpw:2.63},{format:"IQ2_XXS",size:9,vramReq:11,speed:98,quality:67,ppl:6.5,bpw:2.3}],
    benchmarks:{mmlu:78,hellaswag:85,arc:79,gsm8k:83,humaneval:92},
    stressTests:[{hw:"RTX 4090",tokens_sec:38,ctx:16384,latency_ms:26,vram_used:20,score:93},{hw:"RTX 3090",tokens_sec:28,ctx:8192,latency_ms:36,vram_used:20,score:88},{hw:"M4 Max",tokens_sec:32,ctx:32768,latency_ms:31,vram_used:20,score:92},{hw:"Arc B580",tokens_sec:18,ctx:4096,latency_ms:56,vram_used:20,score:78}]},
  {id:"gemma2_9b",name:"Gemma 2 9B Instruct",family:"Gemma",params:9,category:"LLM",developer:"Google",license:"Gemma",released:"2024-06",contextLen:8192,hfUrl:"https://huggingface.co/google/gemma-2-9b-it",
    arch:{layers:42,heads:8,headDim:256},
    quants:[{format:"BF16",size:18,vramReq:20,speed:42,quality:100,ppl:5.0,bpw:16},{format:"GGUF FP16",size:18,vramReq:20,speed:40,quality:100,ppl:5.0,bpw:16},{format:"Q8_0",size:9.6,vramReq:11,speed:78,quality:99,ppl:5.05,bpw:8},{format:"Q6_K",size:7.4,vramReq:8.5,speed:100,quality:98,ppl:5.1,bpw:6.5},{format:"Q5_K_M",size:6.4,vramReq:7.5,speed:118,quality:96,ppl:5.15,bpw:5.5},{format:"Q4_K_M",size:5.5,vramReq:6.5,speed:148,quality:93,ppl:5.3,bpw:4.5},{format:"Q4_K_S",size:5.1,vramReq:6.0,speed:158,quality:92,ppl:5.35,bpw:4.25},{format:"Q3_K_M",size:4.0,vramReq:5,speed:210,quality:82,ppl:5.9,bpw:3.35},{format:"Q2_K",size:3.1,vramReq:3.8,speed:280,quality:70,ppl:6.8,bpw:2.63},{format:"IQ2_XXS",size:2.6,vramReq:3.2,speed:320,quality:66,ppl:7.5,bpw:2.3},{format:"IQ1_S",size:1.8,vramReq:2.3,speed:430,quality:50,ppl:10.0,bpw:1.56}],
    benchmarks:{mmlu:71.3,hellaswag:87,arc:74,gsm8k:68,humaneval:62},
    stressTests:[{hw:"RTX 3060 12GB",tokens_sec:65,ctx:4096,latency_ms:15,vram_used:6,score:91},{hw:"Arc B580",tokens_sec:42,ctx:4096,latency_ms:24,vram_used:6,score:82},{hw:"M4 Pro",tokens_sec:80,ctx:8192,latency_ms:12,vram_used:6,score:96},{hw:"RTX 4060",tokens_sec:52,ctx:4096,latency_ms:19,vram_used:6,score:86}]},
  {id:"command_r_35b",name:"Command R 35B",family:"Command",params:35,category:"LLM",developer:"Cohere",license:"CC-BY-NC",released:"2024-03",contextLen:131072,hfUrl:"https://huggingface.co/CohereForAI/c4ai-command-r-v01",
    arch:{layers:40,heads:8,headDim:128},
    quants:[{format:"Q8_0",size:37.5,vramReq:41,speed:20,quality:100,ppl:5.3,bpw:8},{format:"Q6_K",size:29,vramReq:32,speed:27,quality:98,ppl:5.4,bpw:6.5},{format:"Q5_K_M",size:25,vramReq:28,speed:32,quality:96,ppl:5.5,bpw:5.5},{format:"Q4_K_M",size:21.5,vramReq:24,speed:40,quality:93,ppl:5.6,bpw:4.5},{format:"Q4_K_S",size:20,vramReq:23,speed:44,quality:92,ppl:5.65,bpw:4.25},{format:"Q3_K_M",size:16,vramReq:19,speed:56,quality:82,ppl:6.2,bpw:3.35},{format:"Q2_K",size:12.5,vramReq:15,speed:75,quality:70,ppl:7.0,bpw:2.63},{format:"IQ2_XXS",size:10.5,vramReq:13,speed:90,quality:66,ppl:7.8,bpw:2.3}],
    benchmarks:{mmlu:73.6,hellaswag:83,arc:74,gsm8k:71,humaneval:64},
    stressTests:[{hw:"RTX 4090",tokens_sec:35,ctx:16384,latency_ms:29,vram_used:22,score:90},{hw:"M4 Max",tokens_sec:28,ctx:32768,latency_ms:36,vram_used:22,score:88},{hw:"L40S",tokens_sec:42,ctx:32768,latency_ms:24,vram_used:22,score:94}]},
  {id:"wizardcoder_34b",name:"WizardCoder 34B v1.0",family:"WizardCoder",params:34,category:"Code",developer:"Microsoft",license:"Llama 2",released:"2023-08",contextLen:16384,hfUrl:"https://huggingface.co/WizardLM/WizardCoder-Python-34B-V1.0",
    arch:{layers:60,heads:8,headDim:128},
    quants:[{format:"Q8_0",size:36,vramReq:40,speed:18,quality:100,ppl:4.5,bpw:8},{format:"Q5_K_M",size:24,vramReq:27,speed:28,quality:96,ppl:4.7,bpw:5.5},{format:"Q4_K_M",size:20.5,vramReq:23,speed:36,quality:93,ppl:4.8,bpw:4.5},{format:"Q4_K_S",size:19,vramReq:22,speed:39,quality:92,ppl:4.85,bpw:4.25},{format:"Q3_K_M",size:15,vramReq:18,speed:52,quality:82,ppl:5.5,bpw:3.35},{format:"Q2_K",size:11.5,vramReq:14,speed:70,quality:69,ppl:6.5,bpw:2.63},{format:"IQ2_XXS",size:9.8,vramReq:12,speed:85,quality:64,ppl:7.2,bpw:2.3}],
    benchmarks:{mmlu:68,hellaswag:80,arc:72,gsm8k:73,humaneval:78},
    stressTests:[{hw:"RTX 4090",tokens_sec:32,ctx:8192,latency_ms:31,vram_used:21,score:90},{hw:"RTX 3090",tokens_sec:24,ctx:4096,latency_ms:42,vram_used:21,score:85},{hw:"M4 Max",tokens_sec:28,ctx:16384,latency_ms:36,vram_used:21,score:88}]},

  // ── 192 GB TIER — fit within 192 GB, up to 25 concurrent users ─────────────

  // 90B Vision: ideal for 2×A100 80GB (BF16 fits at 183 GB; Q8_0=99 GB leaves 93 GB headroom)
  {id:"llama32_90b_vision",name:"Llama 3.2 90B Vision-Instruct",family:"Llama 3.2",params:90,category:"Vision",developer:"Meta",license:"Llama Community",released:"2024-09",contextLen:131072,hfUrl:"https://huggingface.co/meta-llama/Llama-3.2-90B-Vision-Instruct",
    arch:{layers:80,heads:8,headDim:128},
    quants:[{format:"BF16",size:180,vramReq:183,speed:8,quality:100,ppl:5.8,bpw:16},{format:"Q8_0",size:96,vramReq:99,speed:14,quality:99,ppl:5.85,bpw:8},{format:"Q6_K",size:74,vramReq:77,speed:18,quality:98,ppl:5.9,bpw:6.5},{format:"Q5_K_M",size:63,vramReq:66,speed:22,quality:96,ppl:5.95,bpw:5.5},{format:"Q4_K_M",size:54,vramReq:57,speed:28,quality:93,ppl:6.1,bpw:4.5},{format:"Q3_K_M",size:41,vramReq:44,speed:38,quality:84,ppl:6.55,bpw:3.35},{format:"Q2_K",size:32,vramReq:35,speed:50,quality:73,ppl:7.5,bpw:2.63},{format:"IQ2_XXS",size:27,vramReq:30,speed:62,quality:68,ppl:8.2,bpw:2.3}],
    benchmarks:{mmlu:86.0,hellaswag:90.2,arc:83.4,gsm8k:79.0,humaneval:72.0},
    stressTests:[{hw:"H100 SXM",tokens_sec:42,ctx:32768,latency_ms:24,vram_used:57,score:98},{hw:"MI300X",tokens_sec:40,ctx:32768,latency_ms:25,vram_used:57,score:96},{hw:"2× A100 80GB",tokens_sec:28,ctx:32768,latency_ms:36,vram_used:57,score:90},{hw:"2× RTX 4090",tokens_sec:14,ctx:16384,latency_ms:71,vram_used:57,score:82}]},

  // 123B: Q8_0=134 GB fits; Q5_K_M=89 GB leaves 103 GB headroom; best 192GB flagship LLM
  {id:"mistral_large2",name:"Mistral Large 2 (123B)",family:"Mistral",params:123,category:"LLM",developer:"Mistral AI",license:"Mistral Research License",released:"2024-07",contextLen:131072,hfUrl:"https://huggingface.co/mistralai/Mistral-Large-Instruct-2407",
    arch:{layers:88,heads:8,headDim:128},
    quants:[{format:"Q8_0",size:130,vramReq:134,speed:11,quality:100,ppl:4.7,bpw:8},{format:"Q6_K",size:100,vramReq:104,speed:14,quality:98,ppl:4.75,bpw:6.5},{format:"Q5_K_M",size:85,vramReq:89,speed:18,quality:96,ppl:4.8,bpw:5.5},{format:"Q4_K_M",size:73,vramReq:77,speed:24,quality:93,ppl:4.95,bpw:4.5},{format:"Q4_K_S",size:68,vramReq:72,speed:26,quality:92,ppl:5.0,bpw:4.25},{format:"Q3_K_M",size:55,vramReq:59,speed:35,quality:84,ppl:5.45,bpw:3.35},{format:"Q2_K",size:42,vramReq:46,speed:46,quality:72,ppl:6.2,bpw:2.63},{format:"IQ2_XXS",size:36,vramReq:40,speed:56,quality:68,ppl:6.9,bpw:2.3}],
    benchmarks:{mmlu:84.0,hellaswag:90.5,arc:82.0,gsm8k:93.0,humaneval:92.0},
    stressTests:[{hw:"H100 SXM",tokens_sec:35,ctx:32768,latency_ms:29,vram_used:77,score:97},{hw:"MI300X",tokens_sec:33,ctx:32768,latency_ms:30,vram_used:77,score:95},{hw:"2× A100 80GB",tokens_sec:22,ctx:16384,latency_ms:45,vram_used:77,score:88},{hw:"L40S 48GB",tokens_sec:11,ctx:8192,latency_ms:91,vram_used:36,score:80}]},

  // 104B: Q8_0=114 GB fits; RAG-tuned, 128K context, strongest at retrieval tasks in class
  {id:"command_r_plus_104b",name:"Command R+ 104B",family:"Command",params:104,category:"LLM",developer:"Cohere",license:"CC-BY-NC",released:"2024-04",contextLen:131072,hfUrl:"https://huggingface.co/CohereForAI/c4ai-command-r-plus",
    arch:{layers:64,heads:8,headDim:128},
    quants:[{format:"Q8_0",size:110,vramReq:114,speed:12,quality:100,ppl:5.0,bpw:8},{format:"Q6_K",size:85,vramReq:89,speed:16,quality:98,ppl:5.05,bpw:6.5},{format:"Q5_K_M",size:72,vramReq:76,speed:20,quality:96,ppl:5.1,bpw:5.5},{format:"Q4_K_M",size:62,vramReq:66,speed:26,quality:93,ppl:5.25,bpw:4.5},{format:"Q4_K_S",size:58,vramReq:62,speed:28,quality:92,ppl:5.3,bpw:4.25},{format:"Q3_K_M",size:46,vramReq:50,speed:38,quality:83,ppl:5.8,bpw:3.35},{format:"Q2_K",size:35,vramReq:39,speed:52,quality:71,ppl:6.7,bpw:2.63},{format:"IQ2_XXS",size:30,vramReq:34,speed:64,quality:66,ppl:7.4,bpw:2.3}],
    benchmarks:{mmlu:75.7,hellaswag:88.0,arc:78.0,gsm8k:74.0,humaneval:66.0},
    stressTests:[{hw:"H100 SXM",tokens_sec:38,ctx:32768,latency_ms:26,vram_used:66,score:96},{hw:"MI300X",tokens_sec:36,ctx:32768,latency_ms:28,vram_used:66,score:94},{hw:"2× A100 80GB",tokens_sec:24,ctx:16384,latency_ms:42,vram_used:66,score:88},{hw:"L40S 48GB",tokens_sec:18,ctx:16384,latency_ms:56,vram_used:48,score:85}]},

  // 32B dense (Qwen3, Apr 2025): thinking mode, Q8_0=37 GB leaves massive headroom for KV/batching
  {id:"qwen3_32b",name:"Qwen3 32B",family:"Qwen 3",params:32,category:"LLM",developer:"Alibaba",license:"Apache 2.0",released:"2025-04",contextLen:131072,hfUrl:"https://huggingface.co/Qwen/Qwen3-32B",
    arch:{layers:64,heads:8,headDim:128},
    quants:[{format:"BF16",size:64,vramReq:67,speed:22,quality:100,ppl:3.9,bpw:16},{format:"Q8_0",size:34,vramReq:37,speed:42,quality:99,ppl:3.95,bpw:8},{format:"Q6_K",size:26.5,vramReq:30,speed:54,quality:98,ppl:4.0,bpw:6.5},{format:"Q5_K_M",size:22.5,vramReq:26,speed:64,quality:96,ppl:4.05,bpw:5.5},{format:"Q4_K_M",size:19.5,vramReq:23,speed:78,quality:93,ppl:4.15,bpw:4.5},{format:"Q4_K_S",size:18,vramReq:21,speed:84,quality:92,ppl:4.2,bpw:4.25},{format:"IQ4_XS",size:18,vramReq:21,speed:82,quality:92,ppl:4.18,bpw:4.25},{format:"Q3_K_M",size:14.5,vramReq:17,speed:110,quality:83,ppl:4.6,bpw:3.35},{format:"Q2_K",size:11,vramReq:13,speed:148,quality:71,ppl:5.5,bpw:2.63},{format:"IQ2_XXS",size:9,vramReq:11,speed:175,quality:66,ppl:6.2,bpw:2.3}],
    benchmarks:{mmlu:83.2,hellaswag:90.0,arc:82.0,gsm8k:94.0,humaneval:86.0},
    stressTests:[{hw:"RTX 4090",tokens_sec:55,ctx:16384,latency_ms:18,vram_used:23,score:96},{hw:"H100 SXM",tokens_sec:118,ctx:32768,latency_ms:8,vram_used:23,score:100},{hw:"RTX 4070 Ti 16GB",tokens_sec:36,ctx:8192,latency_ms:28,vram_used:21,score:88},{hw:"M4 Max",tokens_sec:42,ctx:32768,latency_ms:24,vram_used:23,score:92}]},

  // 32B general: BF16 fits in a single A100 80GB with 13 GB spare; up to 50+ concurrent at Q4
  {id:"qwen25_32b",name:"Qwen2.5 32B Instruct",family:"Qwen",params:32,category:"LLM",developer:"Alibaba",license:"Apache 2.0",released:"2024-09",contextLen:131072,hfUrl:"https://huggingface.co/Qwen/Qwen2.5-32B-Instruct",
    arch:{layers:64,heads:8,headDim:128},
    quants:[{format:"BF16",size:64,vramReq:67,speed:20,quality:100,ppl:4.5,bpw:16},{format:"Q8_0",size:34,vramReq:37,speed:38,quality:99,ppl:4.55,bpw:8},{format:"Q6_K",size:26.5,vramReq:30,speed:50,quality:98,ppl:4.6,bpw:6.5},{format:"Q5_K_M",size:22.5,vramReq:26,speed:60,quality:96,ppl:4.7,bpw:5.5},{format:"Q4_K_M",size:19.5,vramReq:22,speed:72,quality:93,ppl:4.8,bpw:4.5},{format:"Q4_K_S",size:18,vramReq:21,speed:78,quality:92,ppl:4.85,bpw:4.25},{format:"IQ4_XS",size:18,vramReq:21,speed:76,quality:92,ppl:4.82,bpw:4.25},{format:"Q3_K_M",size:14.5,vramReq:17,speed:100,quality:83,ppl:5.3,bpw:3.35},{format:"Q2_K",size:11,vramReq:13,speed:136,quality:71,ppl:6.2,bpw:2.63},{format:"IQ2_XXS",size:9,vramReq:11,speed:162,quality:66,ppl:7.0,bpw:2.3}],
    benchmarks:{mmlu:83.5,hellaswag:89.0,arc:83.0,gsm8k:91.0,humaneval:79.0},
    stressTests:[{hw:"RTX 4090",tokens_sec:52,ctx:16384,latency_ms:19,vram_used:22,score:95},{hw:"H100 SXM",tokens_sec:112,ctx:32768,latency_ms:9,vram_used:22,score:100},{hw:"M4 Max",tokens_sec:40,ctx:32768,latency_ms:25,vram_used:22,score:92},{hw:"Arc B580",tokens_sec:22,ctx:8192,latency_ms:45,vram_used:20,score:78}]},

  // NVIDIA Nemotron 70B: top-ranked 70B on Arena; BF16 (148 GB) fits 192 GB with 44 GB KV headroom
  {id:"nemotron_70b",name:"Llama-3.1-Nemotron-70B-Instruct",family:"Nemotron",params:70,category:"LLM",developer:"NVIDIA",license:"Llama Community",released:"2024-10",contextLen:131072,hfUrl:"https://huggingface.co/nvidia/Llama-3.1-Nemotron-70B-Instruct-HF",
    arch:{layers:80,heads:8,headDim:128},
    quants:[{format:"BF16",size:140,vramReq:148,speed:7,quality:100,ppl:5.5,bpw:16},{format:"Q8_0",size:75,vramReq:80,speed:12,quality:99,ppl:5.55,bpw:8},{format:"Q6_K",size:58,vramReq:62,speed:16,quality:98,ppl:5.6,bpw:6.5},{format:"Q5_K_M",size:50,vramReq:54,speed:19,quality:96,ppl:5.65,bpw:5.5},{format:"Q4_K_M",size:42.5,vramReq:46,speed:24,quality:93,ppl:5.75,bpw:4.5},{format:"Q4_K_S",size:40,vramReq:44,speed:27,quality:92,ppl:5.8,bpw:4.25},{format:"IQ4_XS",size:40,vramReq:44,speed:26,quality:92,ppl:5.78,bpw:4.25},{format:"Q3_K_M",size:31,vramReq:34,speed:34,quality:84,ppl:6.2,bpw:3.35},{format:"Q2_K",size:23,vramReq:26,speed:44,quality:74,ppl:7.0,bpw:2.63},{format:"IQ2_XXS",size:19.5,vramReq:22,speed:54,quality:70,ppl:7.6,bpw:2.3}],
    benchmarks:{mmlu:85.1,hellaswag:91.0,arc:83.5,gsm8k:95.0,humaneval:84.0},
    stressTests:[{hw:"H100 SXM",tokens_sec:56,ctx:32768,latency_ms:18,vram_used:80,score:100},{hw:"MI300X",tokens_sec:53,ctx:32768,latency_ms:19,vram_used:80,score:98},{hw:"RTX 4090",tokens_sec:18,ctx:8192,latency_ms:56,vram_used:44,score:92},{hw:"M4 Ultra",tokens_sec:22,ctx:32768,latency_ms:45,vram_used:50,score:91}]},
];

// ─── HELPERS ─────────────────────────────────────────────────────────────────
const fmtUSD = n=>!n&&n!==0?"N/A":n>=1000000?`$${(n/1e6).toFixed(1)}M`:n>=1000?`$${(n/1000).toFixed(0)}K`:`$${n}`;
const fmtUSDFull = n=>!n&&n!==0?"N/A":`$${Number(n).toLocaleString()}`;
const fmtINR = n=>{if(!n&&n!==0)return"N/A";const v=Math.round(n*_liveRate);return v>=1e7?`₹${(v/1e7).toFixed(2)} Cr`:v>=1e5?`₹${(v/1e5).toFixed(2)} L`:`₹${v.toLocaleString("en-IN")}`;};
const fmtVram = v=>v>=1000?`${(v/1000).toFixed(1)} TB`:`${v} GB`;
const fmtCtx = v=>{if(v>=1000){const k=v/1000;return k===Math.round(k)?`${k}K`:`${k.toFixed(1)}K`;}return`${v}`;};
const fmtBW = v=>v>=1000?`${(v/1000).toFixed(0)} TB/s`:`${v} GB/s`;
const fmtTF = v=>v>=1000?`${(v/1000).toFixed(0)} PF`:`${v} TF`;
const fmtW = v=>v>=1000?`${(v/1000).toFixed(1)} kW`:`${v}W`;

// Prevent javascript: / data: URLs from being used as href — only allow http(s)
const safeUrl=url=>{if(!url)return"#";try{const u=new URL(url);return(u.protocol==="https:"||u.protocol==="http:")?url:"#";}catch{return"#";}};

const BRAND_COLOR = {NVIDIA:"#76B900",AMD:"#ED1C24",Intel:"#0071C5",Apple:"#888888"};
const BRANDS = ["All","NVIDIA","AMD","Intel","Apple"];
const SEGMENTS = ["All","datacenter","workstation","consumer","edge"];
const SEG_LABEL = {datacenter:"Data Center",workstation:"Workstation",consumer:"Consumer",edge:"Edge"};
const CTX_PRESETS = [512,1024,2048,4096,8192,16384,32768,65536,131072];

// ─── RUNPOD GPU MAPPING ───────────────────────────────────────────────────────
// Maps our hardware IDs to RunPod GPU display names for deep-link URL construction
const RUNPOD_GPU_MAP = {
  h100_sxm:"NVIDIA H100 80GB HBM3",
  h100_pcie:"NVIDIA H100 PCIe",
  h200_sxm:"NVIDIA H200 SXM",
  gb200:"NVIDIA B200",
  a100_80gb:"NVIDIA A100 80GB PCIe",
  a100_40gb:"NVIDIA A100-SXM4-40GB",
  rtx4090:"NVIDIA GeForce RTX 4090",
  rtx3090:"NVIDIA GeForce RTX 3090",
  rtx4080:"NVIDIA GeForce RTX 4080 SUPER",
  rtx4070ti:"NVIDIA GeForce RTX 4070 Ti",
  rtx4070:"NVIDIA GeForce RTX 4070",
  a6000:"NVIDIA RTX A6000",
  a40:"NVIDIA A40",
  l40s:"NVIDIA L40S",
  l40:"NVIDIA L40",
  rtx6000_ada:"NVIDIA RTX 6000 Ada",
  a30:"NVIDIA A30",
  v100_sxm:"Tesla V100-SXM2-32GB",
  v100_pcie:"Tesla V100-PCIE-16GB",
  // Apple / AMD / Intel not available on RunPod
};

// Derive a best-fit Ollama model tag from a model id
function toOllamaTag(modelId, quantFormat){
  const q=(quantFormat||"Q4_K_M").toLowerCase().replace(/_/g,"-").replace("bf16","fp16");
  const MAP={
    llama3_70b:`llama3.3:70b-instruct-${q}`,
    llama3_8b:`llama3.2:8b-instruct-${q}`,
    llama32_90b_vision:`llama3.2:90b-vision-instruct`,
    mistral_7b:`mistral:7b-instruct-${q}`,
    mistral_nemo:`mistral-nemo:12b-instruct-${q}`,
    mistral_large2:`mistral-large:123b-instruct-${q}`,
    deepseek_r1_70b:`deepseek-r1:70b-${q}`,
    deepseek_r1_7b:`deepseek-r1:7b-${q}`,
    deepseek_v3:`deepseek-v3:671b-${q}`,
    qwen2_72b:`qwen2.5:72b-instruct-${q}`,
    qwen2_7b:`qwen2.5:7b-instruct-${q}`,
    qwen25_32b:`qwen2.5:32b-instruct-${q}`,
    qwen25_coder_32b:`qwen2.5-coder:32b-instruct-${q}`,
    qwen3_32b:`qwen3:32b-${q}`,
    phi4_14b:`phi4:14b-${q}`,
    phi4_mini:`phi4-mini:3.8b-instruct-${q}`,
    gemma2_9b:`gemma2:9b-instruct-${q}`,
    gemma2_27b:`gemma2:27b-instruct-${q}`,
    gemma3_12b:`gemma3:12b-instruct-${q}`,
    gemma3_27b:`gemma3:27b-instruct-${q}`,
    codestral:`codestral:22b-${q}`,
    mixtral_8x7b:`mixtral:8x7b-instruct-v0.1-${q}`,
    mixtral_8x22b:`mixtral:8x22b-instruct-v0.1-${q}`,
  };
  return MAP[modelId]||`${modelId.replace(/_/g,"-")}:latest`;
}

// ─── STRESS TEST SCRIPT BUILDERS (pure template substitution, no AI) ──────────

function buildOllamaScript(p){
  return`#!/bin/bash
# ============================================================
# Ollama Load Test — ${p.modelName}
# Hardware : ${p.gpuName} ×${p.gpuCount} (${p.vramGb} GB VRAM, ${p.tdpW} W)
# Quant    : ${p.quantFormat}  |  Context: ${p.contextSize} tokens
# Generated: LocalAI Deploy (template substitution, no AI)
# ============================================================
set -e

# ── Variables ────────────────────────────────────────────────
MODEL="${p.ollamaTag}"
CONCURRENCY=${p.concurrency}
TOTAL_REQUESTS=${p.totalRequests}
CONTEXT_SIZE=${p.contextSize}
HOST="http://localhost:11434"
RESULTS_FILE="results_ollama_${p.modelId}.txt"

PROMPT="Explain the architecture of transformer models and how attention mechanisms work in detail."
# Approx ${p.concurrency * p.contextSize} tokens of combined KV footprint at peak concurrency

# ── Install Ollama ───────────────────────────────────────────
if ! command -v ollama &>/dev/null; then
  echo "[1/4] Installing Ollama..."
  curl -fsSL https://ollama.com/install.sh | sh
fi

# ── Pull model ───────────────────────────────────────────────
echo "[2/4] Pulling $MODEL ..."
ollama pull "$MODEL"

# ── Start server ─────────────────────────────────────────────
echo "[3/4] Starting Ollama (parallel slots = $CONCURRENCY) ..."
pkill -f "ollama serve" 2>/dev/null || true
OLLAMA_NUM_PARALLEL=$CONCURRENCY \\
  OLLAMA_MAX_LOADED_MODELS=1 \\
  CUDA_VISIBLE_DEVICES=${Array.from({length:p.gpuCount},(_,i)=>i).join(",")} \\
  ollama serve &
SERVER_PID=$!
sleep 6

# Warmup
curl -sf -X POST $HOST/api/generate \\
  -H 'Content-Type: application/json' \\
  -d '{"model":"'$MODEL'","prompt":"ping","stream":false}' >/dev/null
echo "Warmup done."

# ── Load test ────────────────────────────────────────────────
echo "[4/4] Running $TOTAL_REQUESTS requests at $CONCURRENCY concurrency..."
echo "Results: $RESULTS_FILE"
> "$RESULTS_FILE"

run_request(){
  local idx=$1
  local t0; t0=$(date +%s%3N)
  local resp; resp=$(curl -sf -X POST $HOST/api/generate \\
    -H 'Content-Type: application/json' \\
    -d '{"model":"'$MODEL'","prompt":"'"$PROMPT"'","options":{"num_ctx":'$CONTEXT_SIZE'},"stream":false}')
  local t1; t1=$(date +%s%3N)
  local elapsed=$(( t1 - t0 ))
  local eval_count; eval_count=$(echo "$resp" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('eval_count',0))" 2>/dev/null || echo 0)
  local eval_ns; eval_ns=$(echo "$resp" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('eval_duration',1))" 2>/dev/null || echo 1)
  local tps; tps=$(python3 -c "print(round($eval_count / max($eval_ns * 1e-9, 0.001), 2))" 2>/dev/null || echo 0)
  echo "req=$idx latency=\${elapsed}ms tokens=$eval_count tps=$tps" | tee -a "$RESULTS_FILE"
}

export -f run_request
export MODEL HOST PROMPT CONTEXT_SIZE RESULTS_FILE

# Use GNU parallel if available, otherwise sequential
if command -v parallel &>/dev/null; then
  seq 1 $TOTAL_REQUESTS | parallel -j $CONCURRENCY run_request
else
  for i in $(seq 1 $TOTAL_REQUESTS); do run_request $i; done
fi

# ── Summary ──────────────────────────────────────────────────
echo ""
echo "=== Summary ==="
python3 - "$RESULTS_FILE" <<'PYEOF'
import sys, re, statistics
latencies, tps_list = [], []
for line in open(sys.argv[1]):
    m = re.search(r'latency=(\\d+)ms.*tps=([\\d.]+)', line)
    if m:
        latencies.append(int(m.group(1)))
        tps_list.append(float(m.group(2)))
if latencies:
    print(f"Requests     : {len(latencies)}")
    print(f"Avg latency  : {statistics.mean(latencies):.0f} ms")
    print(f"p50 latency  : {statistics.median(latencies):.0f} ms")
    print(f"p95 latency  : {sorted(latencies)[int(len(latencies)*0.95)]:.0f} ms")
    print(f"Avg TPS/req  : {statistics.mean(tps_list):.1f} t/s")
    print(f"Total TPS    : {sum(tps_list):.1f} t/s (across all concurrent slots)")
PYEOF

kill $SERVER_PID 2>/dev/null || true
echo "Done. Results saved to $RESULTS_FILE"
`;
}

function buildLlamaCppScript(p){
  // Estimate GPU layers: assume ~1 MB per layer per B of params at Q4_K_M; cap at total layers
  const mbPerLayer=Math.round(p.paramsBillion*0.8);
  const gpuLayers=Math.min(Math.floor((p.vramGb*1024*0.85)/Math.max(mbPerLayer,1)),200);
  return`#!/bin/bash
# ============================================================
# llama.cpp Load Test — ${p.modelName}
# Hardware : ${p.gpuName} ×${p.gpuCount} (${p.vramGb} GB VRAM)
# Quant    : ${p.quantFormat}  |  GPU layers: ${gpuLayers}  |  Context: ${p.contextSize}
# Generated: LocalAI Deploy (template substitution, no AI)
# ============================================================
set -e

# ── Variables ────────────────────────────────────────────────
HF_MODEL="${p.hfModelId}"        # HuggingFace repo to download GGUF from
QUANT="${p.quantFormat}"
MODEL_FILE="${p.modelId}-${p.quantFormat}.gguf"
GPU_LAYERS=${gpuLayers}          # layers to offload to GPU
CTX_SIZE=${p.contextSize}
PARALLEL=${p.concurrency}        # parallel decode slots
PORT=8080
TOTAL_REQUESTS=${p.totalRequests}
CONCURRENCY=${p.concurrency}
RESULTS_FILE="results_llamacpp_${p.modelId}.txt"

# ── Install dependencies ──────────────────────────────────────
echo "[1/5] Installing build tools..."
sudo apt-get update -qq && sudo apt-get install -y -qq build-essential cmake git curl

# ── Clone & build llama.cpp ───────────────────────────────────
echo "[2/5] Building llama.cpp with CUDA support..."
if [ ! -d "llama.cpp" ]; then
  git clone https://github.com/ggerganov/llama.cpp --depth 1
fi
cd llama.cpp
cmake -B build -DGGML_CUDA=ON -DCMAKE_BUILD_TYPE=Release \\
  -DCMAKE_CUDA_ARCHITECTURES=all-major
cmake --build build --target llama-server -j$(nproc)
cd ..

# ── Download model ────────────────────────────────────────────
echo "[3/5] Downloading $MODEL_FILE ..."
if [ ! -f "$MODEL_FILE" ]; then
  pip install huggingface_hub -q
  python3 -c "
from huggingface_hub import hf_hub_download, list_repo_files
import os, re
repo='$HF_MODEL'
files=list(list_repo_files(repo))
gguf=[f for f in files if '$QUANT' in f.upper() and f.endswith('.gguf')]
if not gguf:
    gguf=[f for f in files if 'Q4_K_M' in f.upper() and f.endswith('.gguf')]
if not gguf:
    gguf=[f for f in files if f.endswith('.gguf')][:1]
f=gguf[0]
print(f'Downloading {f}')
hf_hub_download(repo_id=repo, filename=f, local_dir='.')
import shutil; shutil.move(f, '$MODEL_FILE') if f!='$MODEL_FILE' else None
"
fi

# ── Start llama-server ────────────────────────────────────────
echo "[4/5] Starting llama-server on port $PORT ..."
pkill -f llama-server 2>/dev/null || true
./llama.cpp/build/bin/llama-server \\
  --model "$MODEL_FILE" \\
  --n-gpu-layers $GPU_LAYERS \\
  --ctx-size $CTX_SIZE \\
  --parallel $PARALLEL \\
  --port $PORT \\
  --host 0.0.0.0 &
SERVER_PID=$!
sleep 10

# Warmup
curl -sf http://localhost:$PORT/health >/dev/null && echo "Server healthy."

# ── Load test with Apache Bench ───────────────────────────────
echo "[5/5] Running load test ($TOTAL_REQUESTS reqs, $CONCURRENCY concurrent)..."
PAYLOAD='{"prompt":"Explain how neural networks learn through backpropagation and gradient descent. Include examples.","n_predict":256}'
echo "$PAYLOAD" > /tmp/llama_payload.json

ab -n $TOTAL_REQUESTS -c $CONCURRENCY \\
   -T 'application/json' \\
   -p /tmp/llama_payload.json \\
   -s 120 \\
   http://localhost:$PORT/completion | tee "$RESULTS_FILE"

kill $SERVER_PID 2>/dev/null || true
echo "Results saved to $RESULTS_FILE"
`;
}

function buildVllmScript(p){
  return`#!/bin/bash
# ============================================================
# vLLM Load Test — ${p.modelName}
# Hardware : ${p.gpuName} ×${p.gpuCount} (${p.vramGb} GB VRAM)
# Tensor parallel: ${p.gpuCount}  |  Context: ${p.contextSize}
# Generated: LocalAI Deploy (template substitution, no AI)
# ============================================================
set -e

# ── Variables ────────────────────────────────────────────────
HF_MODEL="${p.hfModelId}"
TENSOR_PARALLEL=${p.gpuCount}
MAX_MODEL_LEN=${p.contextSize}
PORT=8000
CONCURRENCY=${p.concurrency}
TOTAL_REQUESTS=${p.totalRequests}
RESULTS_FILE="results_vllm_${p.modelId}.txt"

# ── Install vLLM ─────────────────────────────────────────────
echo "[1/4] Installing vLLM + locust..."
pip install vllm locust -q

# ── (Optional) HuggingFace login for gated models ────────────
# Uncomment and set your token if the model requires authentication:
# huggingface-cli login --token YOUR_HF_TOKEN_HERE

# ── Start vLLM server ─────────────────────────────────────────
echo "[2/4] Launching vLLM OpenAI-compatible server..."
pkill -f "vllm.entrypoints" 2>/dev/null || true
python3 -m vllm.entrypoints.openai.api_server \\
  --model "$HF_MODEL" \\
  --tensor-parallel-size $TENSOR_PARALLEL \\
  --max-model-len $MAX_MODEL_LEN \\
  --gpu-memory-utilization 0.90 \\
  --port $PORT \\
  --host 0.0.0.0 \\
  --served-model-name "${p.modelId}" &
SERVER_PID=$!

echo "Waiting for server to be ready..."
until curl -sf http://localhost:$PORT/health >/dev/null 2>&1; do sleep 5; echo -n "."; done
echo " Ready!"

# ── Write locust file ─────────────────────────────────────────
echo "[3/4] Creating locust test file..."
cat > locustfile_${p.modelId}.py <<'LOCUST'
from locust import HttpUser, task, between
import json, random

PROMPTS = [
    "Explain quantum entanglement and its applications in computing.",
    "Write a Python function to implement binary search with error handling.",
    "Describe the differences between supervised, unsupervised, and reinforcement learning.",
    "What are the key principles of transformer architecture in deep learning?",
    "Explain the CAP theorem and its implications for distributed systems.",
]

class LLMUser(HttpUser):
    wait_time = between(0.1, 0.5)

    @task
    def chat_completion(self):
        payload = {
            "model": "${p.modelId}",
            "messages": [{"role": "user", "content": random.choice(PROMPTS)}],
            "max_tokens": 256,
            "temperature": 0.7,
            "stream": False,
        }
        with self.client.post(
            "/v1/chat/completions",
            json=payload,
            headers={"Content-Type": "application/json"},
            catch_response=True,
            timeout=120,
        ) as resp:
            if resp.status_code == 200:
                data = resp.json()
                tokens = data.get("usage", {}).get("completion_tokens", 0)
                resp.success()
            else:
                resp.failure(f"HTTP {resp.status_code}: {resp.text[:200]}")
LOCUST

# ── Run locust headless ───────────────────────────────────────
echo "[4/4] Running locust: $TOTAL_REQUESTS reqs at $CONCURRENCY users..."
locust \\
  -f locustfile_${p.modelId}.py \\
  --headless \\
  --host http://localhost:$PORT \\
  --users $CONCURRENCY \\
  --spawn-rate $CONCURRENCY \\
  --run-time 60s \\
  --csv "$RESULTS_FILE" \\
  --html results_vllm_${p.modelId}.html

echo "Done. CSV: ${p.modelId}_stats.csv  |  HTML report: results_vllm_${p.modelId}.html"
kill $SERVER_PID 2>/dev/null || true
`;
}

function buildPythonScript(p){
  return`#!/usr/bin/env python3
"""
Async Load Test — ${p.modelName}
Hardware : ${p.gpuName} x${p.gpuCount} (${p.vramGb} GB VRAM)
Quant    : ${p.quantFormat}  |  Context: ${p.contextSize} tokens
Generated: LocalAI Deploy (template substitution, no AI)

Works against:
  Ollama  → BASE_URL = "http://localhost:11434"  BACKEND = "ollama"
  vLLM    → BASE_URL = "http://localhost:8000"   BACKEND = "vllm"
  llama.cpp → BASE_URL = "http://localhost:8080" BACKEND = "llamacpp"
"""
import asyncio, aiohttp, time, json, statistics, argparse, sys

# ── Config (pre-filled from your build) ──────────────────────
BASE_URL      = "http://localhost:11434"   # change to 8000 for vLLM, 8080 for llama.cpp
BACKEND       = "ollama"                   # "ollama" | "vllm" | "llamacpp"
MODEL         = "${p.ollamaTag}"           # ollama tag, or HF model ID for vLLM
CONCURRENCY   = ${p.concurrency}           # concurrent workers
TOTAL         = ${p.totalRequests}         # total requests to send
MAX_TOKENS    = 256                        # max tokens per response
CONTEXT_SIZE  = ${p.contextSize}           # context window
TIMEOUT_S     = 180                        # per-request timeout

PROMPTS = [
    "Explain the differences between CNN, RNN, and Transformer architectures.",
    "Write a complete Python implementation of a REST API with authentication.",
    "Describe how gradient descent and backpropagation work together in training neural networks.",
    "What are the trade-offs between SQL and NoSQL databases for large-scale applications?",
    "Explain the concept of attention mechanisms in transformer models with examples.",
    "How does retrieval-augmented generation (RAG) improve LLM accuracy?",
    "Implement a binary search tree in Python with insert, search, and delete operations.",
    "Compare microservices vs monolithic architecture for a high-traffic web application.",
]

# ── Endpoint builder ──────────────────────────────────────────
def build_request(prompt: str, idx: int) -> tuple[str, dict]:
    if BACKEND == "ollama":
        return f"{BASE_URL}/api/generate", {
            "model": MODEL,
            "prompt": prompt,
            "options": {"num_ctx": CONTEXT_SIZE, "num_predict": MAX_TOKENS},
            "stream": False,
        }
    elif BACKEND == "vllm":
        return f"{BASE_URL}/v1/chat/completions", {
            "model": MODEL,
            "messages": [{"role": "user", "content": prompt}],
            "max_tokens": MAX_TOKENS,
            "temperature": 0.7,
            "stream": False,
        }
    else:  # llama.cpp
        return f"{BASE_URL}/completion", {
            "prompt": prompt,
            "n_predict": MAX_TOKENS,
            "temperature": 0.7,
        }

# ── Extract token count from response ─────────────────────────
def extract_tokens(data: dict) -> int:
    if BACKEND == "ollama":
        return data.get("eval_count", 0)
    elif BACKEND == "vllm":
        return data.get("usage", {}).get("completion_tokens", 0)
    else:
        return data.get("tokens_predicted", 0)

# ── Single request worker ─────────────────────────────────────
async def send_request(session: aiohttp.ClientSession, idx: int, results: list):
    prompt = PROMPTS[idx % len(PROMPTS)]
    url, payload = build_request(prompt, idx)
    t0 = time.perf_counter()
    try:
        async with session.post(url, json=payload,
                                timeout=aiohttp.ClientTimeout(total=TIMEOUT_S)) as resp:
            if resp.status != 200:
                text = await resp.text()
                results.append({"ok": False, "error": f"HTTP {resp.status}: {text[:100]}", "idx": idx})
                return
            data = await resp.json()
            elapsed = time.perf_counter() - t0
            tokens = extract_tokens(data)
            tps = tokens / max(elapsed, 0.001)
            results.append({"ok": True, "latency_s": elapsed, "tokens": tokens, "tps": tps, "idx": idx})
            print(f"  req {idx:3d}: {elapsed*1000:.0f}ms | {tokens} tok | {tps:.1f} t/s")
    except asyncio.TimeoutError:
        results.append({"ok": False, "error": "timeout", "idx": idx, "latency_s": TIMEOUT_S})
    except Exception as e:
        results.append({"ok": False, "error": str(e), "idx": idx})

# ── Semaphore-limited dispatcher ──────────────────────────────
async def run_load_test():
    sem = asyncio.Semaphore(CONCURRENCY)
    results = []

    async def bounded(idx):
        async with sem:
            await send_request(session, idx, results)

    connector = aiohttp.TCPConnector(limit=CONCURRENCY + 4)
    async with aiohttp.ClientSession(connector=connector) as session:
        print(f"\\n=== Load test: {TOTAL} requests | {CONCURRENCY} concurrent | {BACKEND} | {MODEL} ===")
        t_start = time.perf_counter()
        await asyncio.gather(*[bounded(i) for i in range(TOTAL)])
        elapsed_total = time.perf_counter() - t_start

    ok   = [r for r in results if r.get("ok")]
    fail = [r for r in results if not r.get("ok")]
    if ok:
        lats   = sorted(r["latency_s"] * 1000 for r in ok)
        tps_l  = [r["tps"] for r in ok]
        total_tok = sum(r["tokens"] for r in ok)
        print(f"\\n=== Results ===")
        print(f"Total requests : {len(results)} ({len(ok)} ok, {len(fail)} failed)")
        print(f"Total time     : {elapsed_total:.1f}s")
        print(f"Throughput     : {len(ok)/elapsed_total:.2f} req/s")
        print(f"Total tokens   : {total_tok}  ({total_tok/elapsed_total:.1f} tok/s aggregate)")
        print(f"Latency avg    : {statistics.mean(lats):.0f} ms")
        print(f"Latency p50    : {lats[len(lats)//2]:.0f} ms")
        print(f"Latency p95    : {lats[int(len(lats)*0.95)]:.0f} ms")
        print(f"Latency p99    : {lats[int(len(lats)*0.99)]:.0f} ms")
        print(f"Avg TPS/slot   : {statistics.mean(tps_l):.1f} t/s")
    if fail:
        print(f"\\nFailed requests ({len(fail)}):")
        for r in fail[:5]:
            print(f"  req {r['idx']}: {r.get('error','unknown')}")
    return results

if __name__ == "__main__":
    try:
        import aiohttp
    except ImportError:
        print("Installing aiohttp..."); import subprocess; subprocess.run([sys.executable,"-m","pip","install","aiohttp","-q"])
        import aiohttp
    asyncio.run(run_load_test())
`;
}

// ─── GLOBAL CSS ──────────────────────────────────────────────────────────────
const makeCSS = (dark = true) => `
  @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500;700&display=swap');
  *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
  :root{
    ${dark
    ? `--bg:#060610;--bg2:#0a0a18;--surface:#0f0f20;--surface2:#141428;--surface3:#1a1a35;
    --border:rgba(110,80,255,0.18);--border2:rgba(255,255,255,0.07);--border3:rgba(110,80,255,0.35);
    --text:#f0eeff;--text2:#8880b8;--text3:#4a4570;
    --accent:#6e50ff;--accent2:#a08bff;--accent3:#c4b8ff;
    --green:#00e5a0;--green2:#00b07a;--amber:#ffb830;--red:#ff4b6e;
    --nvidia:#76b900;--amd:#ed1c24;--intel:#0071c5;--apple:#888;
    --glow-accent:0 0 40px rgba(110,80,255,0.15);
    --card:0 0 0 1px var(--border),0 8px 40px rgba(0,0,0,0.6);`
    : `--bg:#f0eeff;--bg2:#ede8ff;--surface:#ffffff;--surface2:#f5f2ff;--surface3:#ebe5ff;
    --border:rgba(110,80,255,0.2);--border2:rgba(110,80,255,0.12);--border3:rgba(110,80,255,0.4);
    --text:#1a1440;--text2:#5a4e8a;--text3:#9890c4;
    --accent:#5238e0;--accent2:#3a22c0;--accent3:#2812a0;
    --green:#00804a;--green2:#00a060;--amber:#c07000;--red:#c02048;
    --nvidia:#3d6e00;--amd:#b01020;--intel:#00529e;--apple:#555;
    --glow-accent:0 0 40px rgba(82,56,224,0.08);
    --card:0 0 0 1px var(--border),0 4px 24px rgba(82,56,224,0.1);`}
  }
  html{scroll-behavior:smooth}
  body{background:var(--bg);color:var(--text);font-family:'Space Grotesk',sans-serif;min-height:100vh;transition:background .4s,color .4s}
  ::-webkit-scrollbar{width:5px;height:5px}
  ::-webkit-scrollbar-track{background:var(--bg2)}
  ::-webkit-scrollbar-thumb{background:var(--accent);border-radius:3px}
  input[type=range]{-webkit-appearance:none;width:100%;height:3px;background:var(--surface3);border-radius:2px;outline:none}
  input[type=range]::-webkit-slider-thumb{-webkit-appearance:none;width:16px;height:16px;border-radius:50%;background:var(--accent);cursor:pointer;box-shadow:0 0 10px var(--accent)88}
  select{background:var(--surface2);color:var(--text);border:1px solid var(--border);border-radius:8px;padding:7px 10px;font-size:12px;font-family:inherit;outline:none;cursor:pointer;transition:border .15s}
  select:focus{border-color:var(--accent)}

  /* ── BASE ANIMATIONS ── */
  @keyframes fadeUp{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}}
  @keyframes pulseGlow{0%,100%{box-shadow:0 0 0 1px var(--border),0 8px 40px rgba(0,0,0,0.6)}50%{box-shadow:0 0 0 1px var(--border3),0 8px 40px rgba(110,80,255,0.2)}}
  @keyframes scanLine{0%{transform:translateX(-100%)}100%{transform:translateX(200%)}}
  @keyframes orbit{from{transform:rotate(0deg) translateX(var(--r)) rotate(0deg)}to{transform:rotate(360deg) translateX(var(--r)) rotate(-360deg)}}
  @keyframes shimmer{0%{background-position:-200% 0}100%{background-position:200% 0}}
  @keyframes float{0%,100%{transform:translateY(0)}50%{transform:translateY(-6px)}}
  @keyframes blink{0%,100%{opacity:1}50%{opacity:0.4}}

  /* ── FUTURISTIC ANIMATIONS ── */
  @keyframes glitch{
    0%,88%,100%{transform:translate(0);filter:none}
    89%{transform:translate(-2px,1px);filter:hue-rotate(90deg)}
    92%{transform:translate(2px,-1px);filter:hue-rotate(-90deg)}
    95%{transform:translate(-1px,2px)}
    98%{transform:translate(1px,-1px);filter:hue-rotate(45deg)}
  }
  @keyframes glitchA{
    0%,88%,100%{clip-path:none;transform:translate(0);opacity:0}
    89%,99%{opacity:.75}
    90%{clip-path:polygon(0 12%,100% 12%,100% 32%,0 32%);transform:translate(-3px,0)}
    94%{clip-path:polygon(0 52%,100% 52%,100% 72%,0 72%);transform:translate(3px,0)}
  }
  @keyframes glitchB{
    0%,88%,100%{clip-path:none;transform:translate(0);opacity:0}
    89%,99%{opacity:.75}
    91%{clip-path:polygon(0 38%,100% 38%,100% 53%,0 53%);transform:translate(3px,0)}
    96%{clip-path:polygon(0 3%,100% 3%,100% 23%,0 23%);transform:translate(-3px,0)}
  }
  @keyframes gradientFlow{
    0%{background-position:0% 50%}
    50%{background-position:100% 50%}
    100%{background-position:0% 50%}
  }
  @keyframes holoShine{
    0%{background-position:200% 50%}
    100%{background-position:-200% 50%}
  }
  @keyframes neonPulse{
    0%,100%{box-shadow:0 0 5px var(--accent)44,0 0 10px var(--accent)22}
    50%{box-shadow:0 0 15px var(--accent)88,0 0 30px var(--accent)44,0 0 60px var(--accent)22}
  }
  @keyframes countIn{
    from{opacity:0;transform:translateY(8px) scale(.9)}
    to{opacity:1;transform:translateY(0) scale(1)}
  }
  @keyframes borderFlow{
    0%,100%{border-color:var(--accent)}
    33%{border-color:var(--green)}
    66%{border-color:var(--amber)}
  }
  @keyframes particleRise{
    0%{opacity:0;transform:translateY(0) scale(0)}
    20%{opacity:.9}
    100%{opacity:0;transform:translateY(-70px) scale(1.5)}
  }
  @keyframes spinSlow{
    from{transform:rotate(0deg)}
    to{transform:rotate(360deg)}
  }

  /* ── UTILITY CLASSES ── */
  .fade-up{animation:fadeUp .35s ease both}
  .card-pulse{animation:pulseGlow 3s ease infinite}

  /* ── GRADIENT ANIMATED TITLE ── */
  .gradient-title{
    background:linear-gradient(90deg,${dark?"#c4b8ff,#6e50ff,#00e5a0,#ffb830,#c4b8ff":"#5238e0,#3a22c0,#008050,#c07000,#5238e0"});
    background-size:400%;
    -webkit-background-clip:text;
    -webkit-text-fill-color:transparent;
    background-clip:text;
    animation:gradientFlow 5s ease infinite;
    display:inline-block;
  }

  /* ── GLITCH TEXT EFFECT ── */
  .glitch-wrap{
    position:relative;
    display:inline-block;
    animation:glitch 12s infinite;
  }
  .glitch-wrap::before{
    content:attr(data-text);
    position:absolute;inset:0;
    -webkit-text-fill-color:${dark?"#ff4b6e":"#c02048"};
    animation:glitchA 12s infinite;
    pointer-events:none;
  }
  .glitch-wrap::after{
    content:attr(data-text);
    position:absolute;inset:0;
    -webkit-text-fill-color:${dark?"#00e5a0":"#008050"};
    animation:glitchB 12s infinite;
    pointer-events:none;
  }

  /* ── HOLOGRAPHIC CARD HOVER ── */
  .holo-card{position:relative;overflow:hidden}
  .holo-card::before{
    content:'';
    position:absolute;inset:0;
    border-radius:inherit;
    background:linear-gradient(105deg,
      transparent 20%,
      ${dark?"rgba(160,139,255,0.13)":"rgba(82,56,224,0.08)"} 40%,
      ${dark?"rgba(0,229,160,0.08)":"rgba(0,128,74,0.06)"} 50%,
      ${dark?"rgba(255,184,48,0.06)":"rgba(192,112,0,0.05)"} 60%,
      transparent 80%
    );
    background-size:250% 100%;
    opacity:0;
    pointer-events:none;
    transition:opacity .3s;
    z-index:0;
  }
  .holo-card:hover::before{
    opacity:1;
    animation:holoShine 2s linear infinite;
  }

  /* ── NEON SELECTED GLOW ── */
  .neon-glow{animation:neonPulse 2.5s ease infinite}
`;

function StyleInject({dark}){
  useEffect(()=>{
    const el=document.createElement("style");
    el.id="localai-theme-style";
    el.textContent=makeCSS(dark);
    document.head.appendChild(el);
    return()=>{try{document.head.removeChild(el)}catch(e){}};
  },[dark]);return null;
}

// ─── ANIMATED BACKGROUND ─────────────────────────────────────────────────────
function NeuralBg({dark=true}){
  const ref=useRef(null);
  useEffect(()=>{
    const c=ref.current;if(!c)return;
    const ctx=c.getContext("2d");
    let raf,t=0;
    const resize=()=>{c.width=c.offsetWidth;c.height=c.offsetHeight;};
    resize();
    const N=55;
    const palette=dark
      ?["#6e50ff","#00e5a0","#ffb830","#a08bff","#ff4b6e"]
      :["#5238e0","#008050","#c07000","#7060d0","#c02048"];
    const nodes=Array.from({length:N},(_,i)=>({
      x:Math.random()*c.width,y:Math.random()*c.height,
      vx:(Math.random()-.5)*.2,vy:(Math.random()-.5)*.2,
      r:1.2+Math.random()*2,pulse:Math.random()*Math.PI*2,
      col:palette[i%5]
    }));
    const draw=()=>{
      ctx.clearRect(0,0,c.width,c.height);t+=.006;
      // Hex grid
      for(let xi=-28;xi<c.width+28;xi+=48)for(let yi=-24;yi<c.height+24;yi+=42){
        const base=dark?.012:.022;
        const op=base+base*.5*Math.sin(t*0.7+xi*.008+yi*.008);
        ctx.strokeStyle=dark?`rgba(110,80,255,${op})`:`rgba(82,56,224,${op})`;ctx.lineWidth=.5;
        ctx.beginPath();
        for(let k=0;k<6;k++){ctx.lineTo(xi+20*Math.cos(k*Math.PI/3),yi+20*Math.sin(k*Math.PI/3));}
        ctx.closePath();ctx.stroke();
      }
      // Node connections
      nodes.forEach(n=>{n.x+=n.vx;n.y+=n.vy;n.pulse+=.03;
        if(n.x<0||n.x>c.width)n.vx*=-1;if(n.y<0||n.y>c.height)n.vy*=-1;});
      nodes.forEach((a,i)=>nodes.slice(i+1,i+7).forEach(b=>{
        const d=Math.hypot(a.x-b.x,a.y-b.y);
        const maxAlpha=dark?.1:.18;
        if(d<120){ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);
          ctx.strokeStyle=dark?`rgba(160,139,255,${maxAlpha*(1-d/120)})`:`rgba(82,56,224,${maxAlpha*(1-d/120)})`;ctx.lineWidth=.4;ctx.stroke();}
      }));
      // Nodes
      nodes.forEach(n=>{
        const ps=1+.15*Math.sin(n.pulse);
        ctx.beginPath();ctx.arc(n.x,n.y,n.r*ps,0,Math.PI*2);
        ctx.fillStyle=dark?n.col+"88":n.col+"aa";ctx.fill();
      });
      // Central orbit
      const cx=c.width*.8,cy=c.height*.45;
      [45,70,100].forEach((r,i)=>{
        const ringAlpha=dark?(.03+i*.015):(.05+i*.025);
        ctx.beginPath();ctx.arc(cx,cy,r,0,Math.PI*2);
        ctx.strokeStyle=dark?`rgba(110,80,255,${ringAlpha})`:`rgba(82,56,224,${ringAlpha})`;ctx.lineWidth=1;ctx.stroke();
      });
      for(let i=0;i<8;i++){
        const a=t*(i%2?1:-1)*(0.4+i*.08)+i*Math.PI/4;
        const r=38+i*8.5;
        const x=cx+r*Math.cos(a),y=cy+r*Math.sin(a);
        ctx.beginPath();ctx.arc(x,y,2,0,Math.PI*2);
        ctx.fillStyle=dark?`hsl(${200+i*22},100%,75%)`:`hsl(${220+i*22},80%,38%)`;ctx.fill();
      }
      const p2=.5+.5*Math.sin(t*2.2);
      const g=ctx.createRadialGradient(cx,cy,0,cx,cy,32);
      g.addColorStop(0,dark?`rgba(110,80,255,${.25+.12*p2})`:`rgba(82,56,224,${.18+.08*p2})`);
      g.addColorStop(1,"transparent");
      ctx.beginPath();ctx.arc(cx,cy,32,0,Math.PI*2);ctx.fillStyle=g;ctx.fill();
      ctx.beginPath();ctx.arc(cx,cy,5+2*p2,0,Math.PI*2);
      ctx.fillStyle=dark?"#c4b8ff":"#5238e0";ctx.fill();
      // Scan line
      const sx=((t*.22)%1.5)*c.width-c.width*.25;
      const sg=ctx.createLinearGradient(sx,0,sx+60,0);
      sg.addColorStop(0,"transparent");
      sg.addColorStop(.5,dark?"rgba(110,80,255,.04)":"rgba(82,56,224,.025)");
      sg.addColorStop(1,"transparent");
      ctx.fillStyle=sg;ctx.fillRect(0,0,c.width,c.height);
      raf=requestAnimationFrame(draw);
    };
    draw();
    window.addEventListener("resize",resize);
    return()=>{cancelAnimationFrame(raf);window.removeEventListener("resize",resize);};
  },[dark]);
  return<canvas ref={ref} style={{position:"absolute",inset:0,width:"100%",height:"100%",pointerEvents:"none"}}/>;
}

// ─── ANIMATED COUNTER ────────────────────────────────────────────────────────
function AnimatedCounter({to, duration=900}){
  const [cur,setCur]=useState(0);
  const [done,setDone]=useState(false);
  useEffect(()=>{
    if(typeof to!=="number"){return;}
    let start=null,raf;
    const tick=ts=>{
      if(!start)start=ts;
      const p=Math.min((ts-start)/duration,1);
      const ease=1-Math.pow(1-p,3);
      const val=Math.round(to*ease);
      setCur(val);
      if(p<1)raf=requestAnimationFrame(tick);
      else setDone(true);
    };
    raf=requestAnimationFrame(tick);
    return()=>cancelAnimationFrame(raf);
  },[to,duration]);
  return<span style={{display:"inline-block",animation:done?"none":"countIn .3s ease"}}>{cur}</span>;
}

// ─── PRIMITIVES ───────────────────────────────────────────────────────────────
const Chip=({children,active,onClick,color="#6e50ff",style={}})=>(
  <button onClick={onClick} style={{padding:"5px 13px",borderRadius:20,border:`1px solid ${active?color:"rgba(255,255,255,0.1)"}`,background:active?color+"28":"transparent",color:active?color:"var(--text2)",fontSize:11,fontWeight:active?700:500,cursor:"pointer",transition:"all .15s",fontFamily:"inherit",whiteSpace:"nowrap",...style}}>
    {children}
  </button>
);

const Badge=({children,color,bg,style={}})=>(
  <span style={{background:bg||"rgba(110,80,255,0.15)",color:color||"var(--accent2)",fontSize:9,fontWeight:700,padding:"2px 7px",borderRadius:20,whiteSpace:"nowrap",letterSpacing:.8,textTransform:"uppercase",display:"inline-block",...style}}>{children}</span>
);

const Bar=({v,max=100,color="var(--accent)",h=4})=>(
  <div style={{background:"rgba(255,255,255,0.06)",borderRadius:2,height:h,overflow:"hidden",marginTop:3}}>
    <div style={{width:`${Math.min(100,(v/max)*100)}%`,height:"100%",background:color,borderRadius:2,transition:"width .6s cubic-bezier(.4,0,.2,1)",boxShadow:`0 0 5px ${color}66`}}/>
  </div>
);

function QtyBtn({val,onChange}){
  return(
    <div style={{display:"flex",alignItems:"center",gap:0,border:"1px solid var(--border)",borderRadius:8,overflow:"hidden"}}>
      <button onClick={()=>onChange(Math.max(1,val-1))} style={{width:26,height:26,border:"none",background:"var(--surface2)",color:"var(--text2)",cursor:"pointer",fontSize:14,fontFamily:"inherit",display:"flex",alignItems:"center",justifyContent:"center",transition:"all .15s"}} onMouseEnter={e=>e.currentTarget.style.background="var(--surface3)"} onMouseLeave={e=>e.currentTarget.style.background="var(--surface2)"}>−</button>
      <span style={{width:28,textAlign:"center",fontSize:12,fontWeight:700,fontFamily:"'JetBrains Mono', monospace",color:"var(--text)",background:"var(--surface)"}}>{val}</span>
      <button onClick={()=>onChange(Math.min(16,val+1))} style={{width:26,height:26,border:"none",background:"var(--surface2)",color:"var(--text2)",cursor:"pointer",fontSize:14,fontFamily:"inherit",display:"flex",alignItems:"center",justifyContent:"center",transition:"all .15s"}} onMouseEnter={e=>e.currentTarget.style.background="var(--surface3)"} onMouseLeave={e=>e.currentTarget.style.background="var(--surface2)"}>+</button>
    </div>
  );
}

function SrcLink({id}){
  const s=SOURCES[id];if(!s)return null;
  return<a href={safeUrl(s.url)} target="_blank" rel="noopener noreferrer" style={{display:"inline-flex",gap:3,padding:"2px 7px",borderRadius:5,background:"rgba(255,255,255,0.04)",border:"1px solid var(--border2)",fontSize:9,color:"var(--text2)",textDecoration:"none",fontWeight:600,transition:"all .15s"}} onMouseEnter={e=>{e.currentTarget.style.borderColor="var(--accent)";e.currentTarget.style.color="var(--accent2)"}} onMouseLeave={e=>{e.currentTarget.style.borderColor="var(--border2)";e.currentTarget.style.color="var(--text2)"}}>↗ {s.badge}</a>;
}

// ─── HARDWARE CARD ────────────────────────────────────────────────────────────
function HwCard({hw,qty,selected,comparing,onSelect,onQty,onCompare}){
  const [hov,setHov]=useState(false);
  const [specOpen,setSpecOpen]=useState(false);
  const bc=BRAND_COLOR[hw.brand]||"#6e50ff";
  const totalVram=hw.vram*qty,totalUSD=hw.priceUSD*qty;
  const isNew=hw.released?.match(/2025/);
  const tps=hw.tokensPerSec||{};
  const hasFullSpec=!!(hw.cudaCores||hw.tensorCores||hw.memBusWidth||hw.boostClockMHz);
  const archFull={Blackwell:"Blackwell (5th Gen)","Ada Lovelace":"Ada Lovelace (4th Gen)",Hopper:"Hopper (3rd Gen)",Ampere:"Ampere (2nd Gen)",Turing:"Turing (1st Gen)",Orin:"Orin Edge",CDNA1:"CDNA 1 (GFX908)",CDNA2:"CDNA 2 (GFX90A)",CDNA3:"CDNA 3 (GFX940)",RDNA4:"RDNA 4",RDNA3:"RDNA 3",RDNA2:"RDNA 2",Battlemage:"Battlemage (Xe2)",Alchemist:"Alchemist (Xe-HPG)","Gaudi 2":"Gaudi 2 (Greco)","Gaudi 3":"Gaudi 3 (Greco+)"}[hw.gen]||hw.gen;
  return(
    <div onClick={()=>onSelect(hw)} onMouseEnter={()=>setHov(true)} onMouseLeave={()=>setHov(false)} className={`fade-up holo-card${selected?" neon-glow":""}`}
      style={{
        border:`1px solid ${selected?"var(--accent3)":comparing?"var(--amber)":hov?bc+"cc":bc+"44"}`,
        borderLeft:`4px solid ${selected?"var(--accent)":comparing?"var(--amber)":bc}`,
        borderRadius:14,padding:"14px 15px 14px 13px",cursor:"pointer",
        background:selected?"rgba(110,80,255,0.08)":"var(--surface)",
        transition:"all .2s",position:"relative",
        boxShadow:selected?`0 0 0 1px var(--accent)44,0 0 20px ${bc}22,0 8px 32px rgba(0,0,0,.5)`:hov?`0 8px 24px rgba(0,0,0,.45),0 0 12px ${bc}18`:"var(--card)"
      }}>
      {isNew&&<div style={{position:"absolute",top:-9,left:12}}><Badge color="#fff" bg="var(--green2)">NEW 2025</Badge></div>}
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:9}}>
        <div style={{display:"flex",gap:5,flexWrap:"wrap"}}>
          <Badge color={bc} bg={bc+"22"}>{hw.brand}</Badge>
          <Badge color="var(--text2)" bg="rgba(255,255,255,0.05)">{SEG_LABEL[hw.segment]||hw.segment}</Badge>
          {hw.nvlink&&<Badge color="#5599ff" bg="rgba(85,153,255,0.15)">NVLink</Badge>}
          {!hw.inStock&&<Badge color="var(--amber)" bg="rgba(255,184,48,0.15)">Pre-order</Badge>}
        </div>
        <span style={{fontSize:9,color:"var(--text3)",fontFamily:"'JetBrains Mono', monospace"}}>{hw.gen}</span>
      </div>
      <div style={{fontWeight:700,fontSize:13.5,color:"var(--text)",lineHeight:1.2,marginBottom:2}}>{hw.shortName}</div>
      <div style={{fontSize:10,color:"var(--text3)",marginBottom:10}}>{hw.vramType} · {hw.pcie}</div>

      {/* Specs grid */}
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"6px 10px",marginBottom:10}}>
        {[
          ["VRAM","Video RAM",fmtVram(hw.vram)],
          ["BW","Mem. Bandwidth",fmtBW(hw.bandwidth)],
          ["TDP","Thermal Power",fmtW(hw.tdp)],
          ["FP16","Half-Precision",fmtTF(hw.fp16)]
        ].map(([k,full,v])=>(
          <div key={k} style={{display:"flex",flexDirection:"column",gap:1}}>
            <span style={{fontSize:8,color:"var(--text3)",fontWeight:600,textTransform:"uppercase",letterSpacing:.4,lineHeight:1}}>{full}</span>
            <span style={{fontSize:12,fontWeight:700,color:"var(--text)",fontFamily:"'JetBrains Mono', monospace"}}>{v}</span>
          </div>
        ))}
      </div>

      {/* VRAM bar */}
      <div style={{marginBottom:10}}>
        <Bar v={hw.vram} max={400} color={bc}/>
      </div>

      {/* Token rates */}
      {(tps.llama70b||tps.llama8b||tps.mistral7b)&&(
        <div style={{display:"flex",gap:4,flexWrap:"wrap",marginBottom:10}}>
          {tps.llama70b&&<div style={{fontSize:9,background:"rgba(110,80,255,0.15)",color:"var(--accent2)",padding:"2px 7px",borderRadius:5,fontWeight:700,fontFamily:"'JetBrains Mono', monospace"}}>70B:{tps.llama70b}t/s</div>}
          {tps.llama8b&&<div style={{fontSize:9,background:"rgba(0,229,160,0.12)",color:"var(--green)",padding:"2px 7px",borderRadius:5,fontWeight:700,fontFamily:"'JetBrains Mono', monospace"}}>8B:{tps.llama8b}t/s</div>}
          {tps.mistral7b&&<div style={{fontSize:9,background:"rgba(255,184,48,0.12)",color:"var(--amber)",padding:"2px 7px",borderRadius:5,fontWeight:700,fontFamily:"'JetBrains Mono', monospace"}}>7B:{tps.mistral7b}t/s</div>}
        </div>
      )}

      {/* Price block — USD + INR */}
      <div style={{background:"rgba(255,255,255,0.025)",borderRadius:10,padding:"8px 10px",marginBottom:10,border:"1px solid var(--border2)"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline",marginBottom:2}}>
          <span style={{fontSize:15,fontWeight:700,color:"var(--text)",fontFamily:"'JetBrains Mono', monospace"}}>{fmtUSDFull(hw.priceUSD)}</span>
          <span style={{fontSize:13,fontWeight:800,color:"var(--green)",fontFamily:"'JetBrains Mono', monospace"}}>{fmtINR(hw.priceUSD)}</span>
        </div>
        <div style={{fontSize:9,color:"var(--text3)"}}>USD MSRP · INR live · Jun 2026</div>
        {qty>1&&(
          <div style={{marginTop:6,paddingTop:6,borderTop:"1px solid var(--border2)"}}>
            <div style={{display:"flex",justifyContent:"space-between"}}>
              <span style={{fontSize:11,fontWeight:700,color:"var(--accent2)",fontFamily:"'JetBrains Mono', monospace"}}>{fmtUSDFull(totalUSD)} ×{qty}</span>
              <span style={{fontSize:11,fontWeight:700,color:"var(--green)",fontFamily:"'JetBrains Mono', monospace"}}>{fmtINR(totalUSD)}</span>
            </div>
            <div style={{fontSize:9,color:"var(--text3)",marginTop:1}}>{fmtVram(totalVram)} total · {hw.tdp*qty}W total</div>
          </div>
        )}
      </div>

      {/* Controls */}
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}} onClick={e=>e.stopPropagation()}>
        <div style={{display:"flex",alignItems:"center",gap:6}}>
          <span style={{fontSize:9,color:"var(--text3)",fontWeight:700}}>QTY</span>
          <QtyBtn val={qty} onChange={v=>onQty(hw.id,v)}/>
          {qty>1&&<span style={{fontSize:10,background:"rgba(0,229,160,0.12)",color:"var(--green)",padding:"2px 7px",borderRadius:5,fontWeight:700,fontFamily:"'JetBrains Mono', monospace"}}>{fmtVram(totalVram)}</span>}
        </div>
        <div style={{display:"flex",gap:5}}>
          {hasFullSpec&&<button onClick={e=>{e.stopPropagation();setSpecOpen(o=>!o);}} style={{fontSize:10,padding:"4px 9px",borderRadius:8,border:`1px solid ${specOpen?bc+"99":"var(--border)"}`,background:specOpen?bc+"18":"transparent",color:specOpen?bc:"var(--text3)",cursor:"pointer",fontWeight:600,fontFamily:"inherit",transition:"all .15s"}}>
            {specOpen?"▲ Specs":"▼ Specs"}
          </button>}
          <button onClick={e=>{e.stopPropagation();onCompare(hw.id);}} style={{fontSize:10,padding:"4px 10px",borderRadius:8,border:`1px solid ${comparing?"var(--amber)":"var(--border)"}`,background:comparing?"rgba(255,184,48,0.15)":"transparent",color:comparing?"var(--amber)":"var(--text2)",cursor:"pointer",fontWeight:600,fontFamily:"inherit",transition:"all .15s"}}>
            {comparing?"− Comp":"+ Comp"}
          </button>
        </div>
      </div>

      {/* Full Spec Sheet — phone product style */}
      {specOpen&&(
        <div onClick={e=>e.stopPropagation()} style={{marginTop:12,padding:"12px 14px",background:"rgba(255,255,255,0.03)",borderRadius:10,border:`1px solid ${bc}33`,borderTop:`3px solid ${bc}`}}>
          <div style={{fontWeight:700,fontSize:11,color:bc,marginBottom:10,letterSpacing:.5,textTransform:"uppercase"}}>
            {hw.name} — Full Specifications
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"8px 12px"}}>
            {[
              ["Architecture",archFull],
              ["GPU Die / Topology",hw.topology||"—"],
              hw.cudaCores?["CUDA / Shader Cores",hw.cudaCores.toLocaleString()]:null,
              hw.tensorCores?["Tensor Cores",`${hw.tensorCores.toLocaleString()} (${hw.gen?.includes("Blackwell")||hw.topology?.startsWith("GB")?"5th Gen":hw.gen?.includes("Hopper")||hw.topology?.startsWith("GH")?"4th Gen":hw.gen?.includes("Ada")||hw.topology?.startsWith("AD")?"4th Gen":"3rd Gen"})`]:null,
              hw.rtCores?["RT Cores",`${hw.rtCores} (${hw.topology?.startsWith("GB")?"4th Gen":"3rd Gen"})`]:null,
              ["Memory",`${hw.vram} GB ${hw.vramType}`],
              hw.memBusWidth?["Memory Bus Width",`${hw.memBusWidth}-bit`]:null,
              ["Memory Bandwidth",fmtBW(hw.bandwidth)],
              hw.boostClockMHz?["GPU Boost Clock",`${hw.boostClockMHz.toLocaleString()} MHz`]:null,
              ["FP16 / Half-Precision",fmtTF(hw.fp16)+" TFLOPS"],
              hw.fp8?["FP8 Transformer Engine",fmtTF(hw.fp8)+" TFLOPS"]:null,
              hw.int8?["INT8 / Deep Learning",fmtTF(hw.int8)+" TOPS"]:null,
              hw.fp4?["FP4 Sparsity",fmtTF(hw.fp4)+" TOPS"]:null,
              ["Thermal Design Power (TDP)",fmtW(hw.tdp)],
              ["Bus Interface",hw.pcie],
              ["NVLink",hw.nvlink?"Yes — Multi-GPU support":"No"],
              ["Form Factor",hw.segment==="datacenter"?"Data Center / Server":"PCIe Add-in Card"],
              ["Released",hw.released||"—"],
              ["AI Rating",`${hw.rating}/10`],
            ].filter(Boolean).map(([k,v])=>(
              <div key={k} style={{borderBottom:"1px solid rgba(255,255,255,0.05)",paddingBottom:6}}>
                <div style={{fontSize:9,color:"var(--text3)",fontWeight:600,textTransform:"uppercase",letterSpacing:.3,marginBottom:2}}>{k}</div>
                <div style={{fontSize:11,fontWeight:700,color:"var(--text)",fontFamily:"'JetBrains Mono', monospace",lineHeight:1.3}}>{v}</div>
              </div>
            ))}
          </div>
          {hw.notes&&(
            <div style={{marginTop:10,fontSize:10,color:"var(--text3)",lineHeight:1.6,padding:"8px 10px",background:"rgba(255,255,255,0.02)",borderRadius:7,borderLeft:`3px solid ${bc}`}}>
              {hw.notes}
            </div>
          )}
          {hw.useCase&&(
            <div style={{marginTop:8,display:"flex",gap:5,flexWrap:"wrap"}}>
              {hw.useCase.map(u=><Badge key={u} color={bc} bg={bc+"18"}>{u}</Badge>)}
            </div>
          )}
        </div>
      )}

      <div style={{marginTop:8,display:"flex",gap:4,flexWrap:"wrap"}}>
        {(hw.sources||[]).slice(0,3).map(s=><SrcLink key={s} id={s}/>)}
      </div>
    </div>
  );
}

// ─── HW COMPARE TABLE ─────────────────────────────────────────────────────────
function HwCompareTable({ids}){
  const items=ids.map(id=>ALL_HW.find(h=>h.id===id)).filter(Boolean);
  if(items.length<2)return<div style={{color:"var(--text3)",textAlign:"center",padding:"2.5rem",fontSize:13}}>Select 2 or more items to compare.</div>;
  const rows=[
    {k:"vram",l:"VRAM",hi:true,fmt:v=>fmtVram(v)},
    {k:"priceUSD",l:"USD Price",hi:false,fmt:v=>fmtUSDFull(v)},
    {k:"priceINR",l:"INR Price",hi:false,fmt:(v,h)=>fmtINR(h.priceUSD)},
    {k:"bandwidth",l:"Memory BW",hi:true,fmt:v=>fmtBW(v)},
    {k:"fp16",l:"FP16 TFLOPS",hi:true,fmt:v=>fmtTF(v)},
    {k:"fp8",l:"FP8 TFLOPS",hi:true,fmt:v=>v?fmtTF(v):"—"},
    {k:"int8",l:"INT8 TOPS",hi:true,fmt:v=>v?fmtTF(v):"—"},
    {k:"tdp",l:"TDP",hi:false,fmt:v=>fmtW(v)},
    {k:"rating",l:"AI Rating",hi:true,fmt:v=>`${v}/10`},
    {k:"vram_per_dollar",l:"GB/$",hi:true,fmt:(v,h)=>`${(h.vram/h.priceUSD*1000).toFixed(2)}`},
  ];
  return(
    <div style={{overflowX:"auto"}}>
      <table style={{width:"100%",borderCollapse:"collapse",fontSize:12,minWidth:460}}>
        <thead>
          <tr style={{borderBottom:"1px solid var(--border)"}}>
            <th style={{textAlign:"left",padding:"8px 10px",color:"var(--text2)",fontWeight:600,whiteSpace:"nowrap"}}>Spec</th>
            {items.map(h=><th key={h.id} style={{textAlign:"right",padding:"8px 10px",color:BRAND_COLOR[h.brand]||"var(--accent2)",fontWeight:700,whiteSpace:"nowrap",fontSize:11}}>{h.shortName}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.map(row=>{
            const vals=items.map(h=>row.k==="priceINR"?h.priceUSD*USD_TO_INR:row.k==="vram_per_dollar"?null:h[row.k]??null);
            const nums=vals.filter(v=>v!=null);
            const best=nums.length?row.hi?Math.max(...nums):Math.min(...nums):null;
            return(
              <tr key={row.k} style={{borderBottom:"1px solid rgba(255,255,255,0.03)"}}>
                <td style={{padding:"7px 10px",color:"var(--text2)",fontWeight:600,whiteSpace:"nowrap",fontSize:11}}>{row.l}</td>
                {items.map((h,i)=>{
                  const v=vals[i];const isBest=v!==null&&v===best;
                  return<td key={h.id} style={{padding:"7px 10px",textAlign:"right",fontWeight:isBest?800:500,color:isBest?"var(--green)":"var(--text)",fontFamily:"'JetBrains Mono', monospace",fontSize:12}}>
                    {row.fmt(v,h)}{isBest&&<span style={{fontSize:9,marginLeft:4,color:"var(--green)"}}>★</span>}
                  </td>;
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ─── KV CACHE CALCULATOR ─────────────────────────────────────────────────────
function KVCacheCalc({model,buildVram}){
  const [ctxIdx,setCtxIdx]=useState(3);
  const [batch,setBatch]=useState(1);
  const [precision,setPrecision]=useState("fp16");
  const bpwMap={fp16:2,bf16:2,fp8:1,int8:1,int4:.5};
  const bpw=bpwMap[precision]||2;
  const ctx=CTX_PRESETS[ctxIdx]||4096;
  const layers=model?.arch?.layers||32;
  const heads=model?.arch?.heads||8;
  const headDim=model?.arch?.headDim||128;
  const kvBytes=2*layers*heads*headDim*ctx*batch*bpw;
  const kvGB=kvBytes/1e9;
  const kvDisplay=kvGB<1?`${(kvBytes/1e6).toFixed(1)} MB`:`${kvGB.toFixed(3)} GB`;
  const perToken=(kvBytes/batch/ctx)/1024;
  const refVram=buildVram>0?buildVram:80;
  const concUsers=Math.max(1,Math.floor(refVram*1e9/kvBytes));
  const ctxColor=ctx>32768?"var(--red)":ctx>8192?"var(--amber)":"var(--green)";
  return(
    <div style={{background:"var(--surface)",border:"1px solid var(--border)",borderRadius:14,padding:"18px 20px"}}>
      <div style={{fontWeight:700,fontSize:14,marginBottom:4,color:"var(--text)"}}>🧮 KV Cache Calculator</div>
      {model?<div style={{fontSize:11,color:"var(--text2)",marginBottom:14,background:"rgba(110,80,255,0.1)",borderRadius:8,padding:"5px 10px"}}>
        Model: <strong style={{color:"var(--accent2)"}}>{model.name}</strong> · {layers}L · {heads}KV-heads · {headDim}d
      </div>:<div style={{fontSize:11,color:"var(--text3)",marginBottom:14}}>Select a model in the Models tab for precise estimates.</div>}

      {/* Context token presets */}
      <div style={{marginBottom:14}}>
        <div style={{fontSize:10,color:"var(--text3)",fontWeight:700,textTransform:"uppercase",letterSpacing:.5,marginBottom:8}}>Context Tokens</div>
        <div style={{display:"flex",gap:4,flexWrap:"wrap"}}>
          {CTX_PRESETS.map((v,i)=>(
            <button key={v} onClick={()=>setCtxIdx(i)} style={{padding:"4px 10px",borderRadius:8,border:`1px solid ${i===ctxIdx?"var(--accent)":"var(--border)"}`,background:i===ctxIdx?"rgba(110,80,255,0.2)":"transparent",color:i===ctxIdx?"var(--accent2)":"var(--text2)",fontSize:10,fontWeight:700,cursor:"pointer",fontFamily:"'JetBrains Mono', monospace",transition:"all .15s"}}>
              {fmtCtx(v)}
            </button>
          ))}
        </div>
        <div style={{fontSize:11,color:"var(--text3)",marginTop:5}}>
          Selected: <span style={{color:ctxColor,fontWeight:700,fontFamily:"'JetBrains Mono', monospace"}}>{ctx.toLocaleString()} tokens ({fmtCtx(ctx)} context)</span>
        </div>
      </div>

      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:14}}>
        <div>
          <div style={{fontSize:10,color:"var(--text3)",fontWeight:700,textTransform:"uppercase",letterSpacing:.5,marginBottom:6}}>Batch Size</div>
          <div style={{display:"flex",alignItems:"center",gap:8}}>
            <input type="range" min={1} max={64} step={1} value={batch} onChange={e=>setBatch(Number(e.target.value))}/>
            <span style={{fontSize:13,fontWeight:700,color:"var(--accent2)",fontFamily:"'JetBrains Mono', monospace",minWidth:28}}>{batch}</span>
          </div>
        </div>
        <div>
          <div style={{fontSize:10,color:"var(--text3)",fontWeight:700,textTransform:"uppercase",letterSpacing:.5,marginBottom:6}}>KV Precision</div>
          <select value={precision} onChange={e=>setPrecision(e.target.value)} style={{width:"100%"}}>
            {Object.entries(bpwMap).map(([k,v])=><option key={k} value={k}>{k.toUpperCase()} ({v} B/elem)</option>)}
          </select>
        </div>
      </div>

      <div style={{display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:8,marginBottom:12}}>
        {[
          {l:"KV Cache Size",v:kvDisplay,c:"var(--accent2)"},
          {l:"Per Token",v:`${perToken.toFixed(2)} KB`,c:"var(--green)"},
          {l:`Batch ×${batch} Total`,v:kvGB*batch<1?`${(kvGB*batch*1000).toFixed(1)} MB`:`${(kvGB*batch).toFixed(3)} GB`,c:"var(--amber)"},
          {l:`~Concurrent Users`,v:`~${concUsers}`,c:ctxColor},
        ].map(({l,v,c})=>(
          <div key={l} style={{background:"rgba(255,255,255,0.03)",borderRadius:10,padding:"10px 12px",border:"1px solid var(--border2)"}}>
            <div style={{fontSize:9,color:"var(--text3)",fontWeight:700,textTransform:"uppercase",letterSpacing:.4,marginBottom:3}}>{l}</div>
            <div style={{fontSize:15,fontWeight:800,color:c,fontFamily:"'JetBrains Mono', monospace"}}>{v}</div>
          </div>
        ))}
      </div>

      {buildVram>0&&<div style={{background:"rgba(0,229,160,0.06)",borderRadius:8,padding:"8px 12px",fontSize:10,color:"var(--text2)",marginBottom:10,border:"1px solid rgba(0,229,160,0.15)"}}>
        Build VRAM: <strong style={{color:"var(--green)"}}>{buildVram} GB</strong> · KV needs: <strong style={{color:kvGB<=buildVram?"var(--green)":"var(--red)"}}>{kvDisplay}</strong> · {kvGB<=buildVram?"✓ Fits":"✗ Exceeds build VRAM"}
      </div>}

      <div style={{background:"rgba(110,80,255,0.06)",borderRadius:8,padding:"8px 12px",fontSize:10,color:"var(--text2)",lineHeight:1.7}}>
        <code style={{color:"var(--accent2)",fontFamily:"'JetBrains Mono', monospace",fontSize:10}}>2 × L × H × d × ctx × batch × bytes_per_elem</code>
        {model&&<div style={{color:"var(--text3)",marginTop:2}}>2×{layers}×{heads}×{headDim}×{fmtCtx(ctx)}×{batch}×{bpw} = <strong style={{color:"var(--accent2)"}}>{kvDisplay}</strong></div>}
        <div style={{fontSize:9,color:"var(--text3)",marginTop:4}}>*Concurrent users = build VRAM / per-request KV. Add model weights for full VRAM estimate.</div>
      </div>
    </div>
  );
}

// ─── VRAM CALCULATOR ─────────────────────────────────────────────────────────
function VramCalc({selectedMap}){
  const [params,setParams]=useState(7);
  const [quant,setQuant]=useState("Q4_K_M");
  const [ctx,setCtx]=useState(4096);
  const [batch,setBatch]=useState(1);
  const bpwTbl={"BF16":16,"GGUF FP16":16,"Q8_0":8,"Q6_K":6.5,"Q5_K_M":5.5,"Q5_K_S":5.25,"Q5_0":5,"Q4_K_M":4.5,"Q4_K_S":4.25,"Q4_0":4,"Q4_1":4,"IQ4_XS":4.25,"Q3_K_L":3.5,"Q3_K_M":3.35,"Q3_K_S":3.25,"IQ3_M":3.06,"Q2_K":2.63,"IQ2_XXS":2.3,"IQ1_S":1.56};
  const bits=bpwTbl[quant]||4.5;
  // Model weights: params (B) × bits-per-weight ÷ 8 = bytes → GB
  const modelGB=parseFloat(((params*1e9*bits/8)/1e9).toFixed(2));

  // KV Cache: 2 × Layers × KV-Heads × HeadDim × ContextLen × Batch × 2 bytes (FP16)
  // Architecture estimated from parameter count (GQA-style modern LLMs)
  const estL=params<=1?22:params<=3?26:params<=7?32:params<=9?32:params<=14?40:params<=27?46:params<=72?80:80;
  const estH=8;   // GQA standard: 8 KV heads for most modern models
  const estD=params<=3?96:128; // head dimension
  const kvBytes=2*estL*estH*estD*ctx*batch*2; // 2 bytes = FP16
  const kvGB=parseFloat((kvBytes/1e9).toFixed(3));

  const total=parseFloat((modelGB+kvGB).toFixed(1));
  const fits=Object.entries(selectedMap).filter(([id,qty])=>{const h=ALL_HW.find(x=>x.id===id);return h&&h.vram*qty>=total;});
  return(
    <div style={{background:"var(--surface)",border:"1px solid var(--border)",borderRadius:14,padding:"18px 20px"}}>
      <div style={{fontWeight:700,fontSize:14,marginBottom:14,color:"var(--text)"}}>📐 VRAM Requirement Calculator</div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(130px,1fr))",gap:12,marginBottom:14}}>
        {[["Model Params (B)",params,setParams,.5,700,.5],["Context Tokens",ctx,setCtx,128,131072,128],["Batch Size",batch,setBatch,1,32,1]].map(([l,v,fn,mn,mx,st])=>(
          <div key={l}>
            <div style={{fontSize:10,color:"var(--text3)",fontWeight:700,textTransform:"uppercase",letterSpacing:.5,marginBottom:6}}>{l}</div>
            <div style={{display:"flex",alignItems:"center",gap:6}}>
              <input type="range" min={mn} max={mx} step={st} value={v} onChange={e=>fn(Number(e.target.value))}/>
              <span style={{fontSize:12,fontWeight:700,color:"var(--accent2)",fontFamily:"'JetBrains Mono', monospace",minWidth:32}}>{v}</span>
            </div>
          </div>
        ))}
        <div>
          <div style={{fontSize:10,color:"var(--text3)",fontWeight:700,textTransform:"uppercase",letterSpacing:.5,marginBottom:6}}>Quantization</div>
          <select value={quant} onChange={e=>setQuant(e.target.value)} style={{width:"100%"}}>
            {Object.keys(bpwTbl).map(k=><option key={k} value={k}>{k}</option>)}
          </select>
        </div>
      </div>
      <div style={{display:"flex",gap:10,flexWrap:"wrap",alignItems:"center",marginBottom:12}}>
        <div style={{background:"rgba(110,80,255,0.1)",borderRadius:12,padding:"14px 20px",textAlign:"center",border:"1px solid rgba(110,80,255,0.25)"}}>
          <div style={{fontSize:9,color:"var(--accent2)",fontWeight:700,textTransform:"uppercase",letterSpacing:.5,marginBottom:3}}>Est. VRAM</div>
          <div style={{fontSize:28,fontWeight:800,color:"var(--accent2)",fontFamily:"'JetBrains Mono', monospace"}}>{total} GB</div>
          <div style={{fontSize:9,color:"var(--text3)"}}>{modelGB} GB model + {kvGB} GB KV cache</div>
        </div>
        <div style={{background:fits.length>0?"rgba(0,229,160,0.08)":"rgba(255,75,110,0.08)",borderRadius:12,padding:"14px 20px",textAlign:"center",border:`1px solid ${fits.length>0?"rgba(0,229,160,0.25)":"rgba(255,75,110,0.25)"}`}}>
          <div style={{fontSize:9,fontWeight:700,color:fits.length>0?"var(--green)":"var(--red)",textTransform:"uppercase",letterSpacing:.5,marginBottom:3}}>Build HW</div>
          <div style={{fontSize:18,fontWeight:700,color:fits.length>0?"var(--green)":"var(--red)",fontFamily:"'JetBrains Mono', monospace"}}>{Object.keys(selectedMap).length===0?"No HW":fits.length>0?`${fits.length} Fit ✓`:"None Fit ✗"}</div>
        </div>
      </div>
      {/* Formula box */}
      <div style={{background:"rgba(110,80,255,0.06)",borderRadius:9,padding:"10px 13px",border:"1px solid rgba(110,80,255,0.18)"}}>
        <div style={{fontSize:9,color:"var(--accent2)",fontWeight:700,textTransform:"uppercase",letterSpacing:.5,marginBottom:5}}>Formulas</div>
        <div style={{fontSize:10,color:"var(--text2)",lineHeight:1.8,fontFamily:"'JetBrains Mono',monospace"}}>
          <div><span style={{color:"var(--text3)"}}>Model weights:</span> {params}B × {bits} bpw ÷ 8 = <span style={{color:"var(--accent2)",fontWeight:700}}>{modelGB} GB</span></div>
          <div><span style={{color:"var(--text3)"}}>KV cache:</span> 2 × L{estL} × H{estH} × d{estD} × {ctx.toLocaleString()} ctx × {batch} batch × 2B = <span style={{color:"var(--amber)",fontWeight:700}}>{kvGB} GB</span></div>
          <div style={{fontSize:9,color:"var(--text3)",marginTop:3}}>L=layers, H=KV-heads, d=head-dim estimated from {params}B param count (GQA model).</div>
        </div>
      </div>
    </div>
  );
}

// ─── BUILD PANEL ─────────────────────────────────────────────────────────────
function BuildPanel({selectedMap,onQty,onClear}){
  const entries=Object.entries(selectedMap).map(([id,qty])=>{const h=ALL_HW.find(x=>x.id===id);return h?{h,qty}:null;}).filter(Boolean);
  if(!entries.length)return(
    <div style={{textAlign:"center",padding:"3.5rem",color:"var(--text3)"}}>
      <div style={{fontSize:48,marginBottom:12,animation:"float 3s ease infinite"}}>🛠️</div>
      <div style={{fontWeight:700,fontSize:15,marginBottom:6,color:"var(--text2)"}}>Build is empty</div>
      <div style={{fontSize:12}}>Click any hardware card to add it to your build.</div>
    </div>
  );
  const totalVram=entries.reduce((a,{h,qty})=>a+h.vram*qty,0);
  const totalTDP=entries.reduce((a,{h,qty})=>a+h.tdp*qty,0);
  const totalUSD=entries.reduce((a,{h,qty})=>a+h.priceUSD*qty,0);
  const totalFP16=entries.reduce((a,{h,qty})=>a+h.fp16*qty,0);
  const totalFP8=entries.reduce((a,{h,qty})=>a+(h.fp8||0)*qty,0);
  const compatModels=MODELS.filter(m=>m.quants.some(q=>q.vramReq<=totalVram));
  // Power: (TDP_W ÷ 1000) × 24 h/day × 30 days × ₹8/kWh (India avg)
  const monthlyPowerINR=Math.round((totalTDP/1000)*24*30*8);
  return(
    <div className="fade-up">
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
        <div style={{fontWeight:700,fontSize:16,color:"var(--text)"}}>Build Summary</div>
        <button onClick={onClear} style={{fontSize:11,padding:"5px 12px",borderRadius:8,border:"1px solid var(--red)",color:"var(--red)",background:"transparent",cursor:"pointer",fontWeight:600,fontFamily:"inherit",transition:"all .15s"}} onMouseEnter={e=>e.currentTarget.style.background="rgba(255,75,110,0.1)"} onMouseLeave={e=>e.currentTarget.style.background="transparent"}>🗑 Clear</button>
      </div>

      {/* Summary stats */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(110px,1fr))",gap:8,marginBottom:18}}>
        {[
          {l:"Total VRAM",v:fmtVram(totalVram),c:"var(--accent2)"},
          {l:"Total TDP",v:fmtW(totalTDP),c:"var(--amber)"},
          {l:"FP16 TFLOPS",v:fmtTF(totalFP16),c:"var(--green)"},
          {l:"FP8 TFLOPS",v:totalFP8?fmtTF(totalFP8):"N/A",c:"var(--accent3)"},
          {l:"Cost USD",v:fmtUSD(totalUSD),c:"#5599ff"},
          {l:"Cost INR",v:fmtINR(totalUSD),c:"var(--green)"},
          {l:"Power/Month",v:`₹${monthlyPowerINR.toLocaleString("en-IN")}`,c:"var(--amber)"},
          {l:"Models Fit",v:`${compatModels.length}/${MODELS.length}`,c:compatModels.length>0?"var(--green)":"var(--red)"},
        ].map(({l,v,c})=>(
          <div key={l} style={{background:"rgba(255,255,255,0.03)",borderRadius:10,padding:"10px 12px",border:"1px solid var(--border2)"}}>
            <div style={{fontSize:9,color:"var(--text3)",fontWeight:700,textTransform:"uppercase",letterSpacing:.5,marginBottom:3}}>{l}</div>
            <div style={{fontSize:13,fontWeight:800,color:c,fontFamily:"'JetBrains Mono', monospace"}}>{v}</div>
          </div>
        ))}
      </div>

      {/* Items */}
      {entries.map(({h,qty})=>(
        <div key={h.id} style={{display:"flex",alignItems:"center",gap:10,padding:"10px 12px",borderRadius:10,background:"rgba(255,255,255,0.025)",border:"1px solid var(--border2)",marginBottom:6}}>
          <div style={{flex:1,minWidth:0}}>
            <div style={{fontWeight:700,fontSize:12}}>
              <span style={{color:BRAND_COLOR[h.brand]||"var(--accent)",fontSize:10,marginRight:4,fontWeight:800}}>{h.brand}</span>
              {h.shortName} <span style={{color:"var(--text3)",fontWeight:400}}>×{qty}</span>
            </div>
            <div style={{fontSize:10,color:"var(--text2)",fontFamily:"'JetBrains Mono', monospace",marginTop:2}}>
              {fmtVram(h.vram*qty)} · {fmtUSDFull(h.priceUSD*qty)} · {fmtINR(h.priceUSD*qty)} · {fmtW(h.tdp*qty)}
            </div>
          </div>
          <div onClick={e=>e.stopPropagation()}><QtyBtn val={qty} onChange={v=>onQty(h.id,v)}/></div>
          <div style={{display:"flex",gap:3}}>{(h.sources||[]).slice(0,2).map(s=><SrcLink key={s} id={s}/>)}</div>
        </div>
      ))}

      {/* Compatible models */}
      <div style={{marginTop:16,fontWeight:700,fontSize:12,color:"var(--text2)",marginBottom:10}}>Compatible AI Models ({compatModels.length})</div>
      <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
        {MODELS.map(m=>{
          const best=m.quants.filter(q=>q.vramReq<=totalVram).sort((a,b)=>b.quality-a.quality)[0];
          return(
            <div key={m.id} style={{padding:"7px 11px",borderRadius:10,border:`1px solid ${best?"rgba(0,229,160,0.3)":"rgba(255,75,110,0.2)"}`,background:best?"rgba(0,229,160,0.05)":"rgba(255,75,110,0.03)"}}>
              <div style={{fontSize:11,fontWeight:700,color:best?"var(--green)":"var(--red)"}}>{m.name}</div>
              {best?<div style={{fontSize:9,color:"var(--text3)",fontFamily:"'JetBrains Mono', monospace"}}>{best.format} · {best.quality}% · {best.speed}t/s</div>:<div style={{fontSize:9,color:"var(--red)"}}>Needs {m.quants[m.quants.length-1]?.vramReq}GB+</div>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── MODEL CARD ───────────────────────────────────────────────────────────────
function ModelCard({model,totalVram,selectedModel,onSelect,compareA,compareB,onCompareA,onCompareB,onRemove}){
  const [open,setOpen]=useState(false);
  const bestQ=model.quants.filter(q=>q.vramReq<=totalVram).sort((a,b)=>b.quality-a.quality)[0];
  const canRun=totalVram>0&&!!bestQ;
  const isA=compareA?.id===model.id,isB=compareB?.id===model.id;
  const catColor={LLM:"var(--accent2)",Reasoning:"var(--amber)",Code:"var(--green)",Vision:"#ff8888"}[model.category]||"var(--text2)";
  // Live HuggingFace stats (from weekly scrape)
  const hfId=model.hfUrl?.replace("https://huggingface.co/","");
  const live=hfId?HF_LIVE[hfId]:null;
  return(
    <div className="fade-up" style={{background:"var(--surface)",border:`1px solid ${selectedModel?.id===model.id?"var(--accent3)":isA?"rgba(110,80,255,0.5)":isB?"rgba(0,229,160,0.5)":canRun?"rgba(0,229,160,0.2)":"var(--border)"}`,borderRadius:14,overflow:"hidden",transition:"border .2s"}}>
      <div onClick={()=>setOpen(!open)} style={{padding:"13px 15px",cursor:"pointer"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:8}}>
          <div>
            <div style={{fontWeight:700,fontSize:13.5,color:"var(--text)"}}>{model.name}</div>
            <div style={{fontSize:10,color:"var(--text3)",marginTop:2}}>{model.developer} · {model.license} · {model.released}</div>
          </div>
          <div style={{display:"flex",gap:4,flexWrap:"wrap",justifyContent:"flex-end"}}>
            <Badge color={catColor} bg={catColor+"22"}>{model.category}</Badge>
            {model._custom
              ?<Badge color="var(--amber)" bg="rgba(255,183,77,0.12)">★ Custom</Badge>
              :<Badge color={canRun?"var(--green)":"var(--red)"} bg={canRun?"rgba(0,229,160,0.1)":"rgba(255,75,110,0.1)"}>{canRun?`✓ ${bestQ.format}`:"Needs VRAM"}</Badge>
            }
            {model.params>0&&<Badge color="var(--accent2)" bg="rgba(110,80,255,0.1)">{model.params}B</Badge>}
            {onRemove&&<button onClick={e=>{e.stopPropagation();onRemove();}} style={{padding:"2px 8px",borderRadius:5,border:"1px solid var(--red)",background:"rgba(255,75,110,0.1)",color:"var(--red)",fontSize:9,fontWeight:700,cursor:"pointer",fontFamily:"inherit",lineHeight:1.5}}>✕ Remove</button>}
          </div>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(5,1fr)",gap:6,marginBottom:8}}>
          {[
            ["MMLU","Massive Multitask Language Understanding",model.benchmarks.mmlu],
            ["HellaSwag","Commonsense NLI Reasoning",model.benchmarks.hellaswag],
            ["ARC-C","AI2 Reasoning Challenge",model.benchmarks.arc],
            ["GSM8K","Grade School Math 8K",model.benchmarks.gsm8k],
            ["HumanEval","Python Code Generation",model.benchmarks.humaneval],
          ].filter(([,,v])=>v).map(([k,full,v])=>(
            <div key={k} title={full}>
              <div style={{fontSize:8,color:"var(--accent2)",textTransform:"uppercase",letterSpacing:.3,marginBottom:1,fontWeight:700,fontFamily:"'JetBrains Mono',monospace"}}>{k}</div>
              <div style={{fontSize:7,color:"var(--text3)",lineHeight:1.2,marginBottom:2,overflow:"hidden",display:"-webkit-box",WebkitLineClamp:2,WebkitBoxOrient:"vertical"}}>{full}</div>
              <div style={{fontSize:13,fontWeight:800,color:"var(--text)",fontFamily:"'JetBrains Mono', monospace"}}>{v}</div>
              <Bar v={v} color={catColor}/>
            </div>
          ))}
        </div>
        <div style={{display:"flex",gap:5,flexWrap:"wrap",alignItems:"center"}}>
          <span style={{fontSize:9,color:"var(--text3)"}}>Ctx: <span style={{color:"var(--accent2)",fontWeight:700,fontFamily:"'JetBrains Mono', monospace"}}>{fmtCtx(model.contextLen)}</span></span>
          <span style={{fontSize:9,color:"var(--text3)"}}>Family: <span style={{color:"var(--text2)",fontWeight:600}}>{model.family}</span></span>
          {model.quants.length>0&&(()=>{const maxSpd=model.quants.reduce((x,q)=>Math.max(x,q.speed||0),0);return maxSpd>0?<span style={{fontSize:9,background:"rgba(0,229,160,0.1)",color:"var(--green)",padding:"2px 7px",borderRadius:5,fontWeight:700,fontFamily:"'JetBrains Mono', monospace"}}>⚡ {maxSpd}+ t/s</span>:null;})()}
          {model.quants.length>0&&(()=>{const minVr=Math.min(...model.quants.map(q=>q.vramReq).filter(v=>v>0));return minVr?<span style={{fontSize:9,background:"rgba(110,80,255,0.1)",color:"var(--accent2)",padding:"2px 7px",borderRadius:5,fontWeight:700,fontFamily:"'JetBrains Mono', monospace"}}>min {minVr}GB</span>:null;})()}
          <a href={safeUrl(model.hfUrl)} target="_blank" rel="noopener noreferrer" onClick={e=>e.stopPropagation()} style={{fontSize:9,color:"var(--accent2)",textDecoration:"none",padding:"2px 7px",borderRadius:4,background:"rgba(110,80,255,0.1)"}}>↗ HuggingFace</a>
          {live&&fmtDL(live.downloads_30d)&&<span title="Monthly downloads (HuggingFace)" style={{fontSize:9,color:"var(--green)",padding:"2px 7px",borderRadius:4,background:"rgba(0,229,160,0.08)",fontWeight:700,fontFamily:"'JetBrains Mono',monospace"}}>↓ {fmtDL(live.downloads_30d)}/mo</span>}
          {live?.likes&&<span title="HuggingFace likes" style={{fontSize:9,color:"var(--amber)",padding:"2px 7px",borderRadius:4,background:"rgba(255,183,77,0.1)",fontWeight:700}}>♥ {fmtDL(live.likes)}</span>}
          {live?.lastModified&&<span title={`Last updated on HuggingFace: ${live.lastModified}`} style={{fontSize:9,color:"var(--text3)",padding:"2px 5px"}}>🔄 {fmtAge(live.lastModified)}</span>}
          <span style={{marginLeft:"auto",fontSize:10,color:"var(--text3)"}}>{open?"▲ hide":"▼ details"}</span>
        </div>
      </div>

      {open&&(
        <div style={{padding:"0 15px 15px",borderTop:"1px solid var(--border)"}}>
          {/* Quantizations table */}
          <div style={{fontWeight:700,fontSize:11,color:"var(--text2)",margin:"12px 0 8px"}}>Quantizations & File Formats</div>
          {model._custom&&model.quants.length===0&&(
            <div style={{padding:"16px",background:"rgba(110,80,255,0.05)",borderRadius:10,border:"1px dashed var(--border)",marginBottom:12,textAlign:"center"}}>
              <div style={{fontSize:12,color:"var(--text2)",marginBottom:6}}>No quantization data for custom model.</div>
              <div style={{display:"flex",gap:10,justifyContent:"center",flexWrap:"wrap",fontSize:11}}>
                {model._liveDownloads!=null&&<span style={{color:"var(--green)",fontWeight:700}}>↓ {fmtDL(model._liveDownloads)}/mo</span>}
                {model._liveLikes!=null&&<span style={{color:"var(--amber)",fontWeight:700}}>♥ {fmtDL(model._liveLikes)}</span>}
                {model._liveModified&&<span style={{color:"var(--text3)"}}>🔄 {fmtAge(model._liveModified)}</span>}
                {model._livePipeline&&<span style={{color:"var(--accent2)",background:"rgba(110,80,255,0.1)",padding:"1px 7px",borderRadius:5}}>{model._livePipeline}</span>}
              </div>
              {model._liveTags?.length>0&&<div style={{marginTop:8,display:"flex",gap:4,flexWrap:"wrap",justifyContent:"center"}}>{model._liveTags.slice(0,10).map(t=><span key={t} style={{fontSize:9,padding:"2px 6px",borderRadius:5,background:"rgba(110,80,255,0.08)",color:"var(--accent2)"}}>{t}</span>)}</div>}
              <a href={safeUrl(model.hfUrl)} target="_blank" rel="noopener noreferrer" style={{display:"inline-block",marginTop:10,fontSize:11,color:"var(--accent2)",textDecoration:"none",padding:"5px 14px",borderRadius:7,background:"rgba(110,80,255,0.12)",border:"1px solid var(--border)"}}>View full model on HuggingFace ↗</a>
            </div>
          )}
          <div style={{overflowX:"auto"}}>
            <table style={{width:"100%",borderCollapse:"collapse",fontSize:11,minWidth:500}}>
              <thead><tr style={{borderBottom:"1px solid var(--border)"}}>
                {["Format","Size","VRAM Req","Speed (t/s)","Quality","Perplexity","Bits/W"].map(h=>(
                  <th key={h} style={{textAlign:h==="Format"?"left":"right",padding:"4px 8px",color:"var(--text3)",fontWeight:600,whiteSpace:"nowrap",fontSize:10}}>{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {model.quants.map(q=>{
                  const fits=totalVram>0&&totalVram>=q.vramReq;
                  return(
                    <tr key={q.format} style={{borderBottom:"1px solid rgba(255,255,255,0.03)",background:fits?"rgba(0,229,160,0.03)":"transparent"}}>
                      <td style={{padding:"5px 8px",fontWeight:700,fontFamily:"'JetBrains Mono', monospace",color:fits?"var(--green)":"var(--text)"}}>{q.format}</td>
                      <td style={{padding:"5px 8px",textAlign:"right",fontFamily:"'JetBrains Mono', monospace"}}>{q.size} GB</td>
                      <td style={{padding:"5px 8px",textAlign:"right",fontFamily:"'JetBrains Mono', monospace",color:fits?"var(--green)":"var(--red)"}}>{q.vramReq} GB{fits?" ✓":""}</td>
                      <td style={{padding:"5px 8px",textAlign:"right",fontFamily:"'JetBrains Mono', monospace"}}>{q.speed}</td>
                      <td style={{padding:"5px 8px",textAlign:"right"}}>
                        <span style={{color:q.quality>=95?"var(--green)":q.quality>=85?"var(--amber)":"var(--red)",fontWeight:700,fontFamily:"'JetBrains Mono', monospace"}}>{q.quality}%</span>
                      </td>
                      <td style={{padding:"5px 8px",textAlign:"right",fontFamily:"'JetBrains Mono', monospace",color:"var(--text2)"}}>{q.ppl}</td>
                      <td style={{padding:"5px 8px",textAlign:"right",fontFamily:"'JetBrains Mono', monospace",color:"var(--text3)"}}>{q.bpw}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Full Model Specification */}
          {(()=>{
            const q4=model.quants.find(q=>q.format==="Q4_K_M");
            const q8=model.quants.find(q=>q.format==="Q8_0");
            const bf=model.quants.find(q=>q.format==="BF16");
            const minVramArr=model.quants.map(q=>q.vramReq).filter(v=>v>0);const minVram=minVramArr.length?Math.min(...minVramArr):null;
            const q4speed=q4?.speed||0;
            const estW=model.params>200?2000:model.params>100?1000:model.params>40?400:model.params>15?250:model.params>5?150:80;
            const co2=q4speed>0?((estW*0.2278)/q4speed).toFixed(2):"N/A";
            const specs=[
              ["Parameters",`${model.params}B (${(model.params*1e9).toLocaleString()} total)`,"mono"],
              ["Architecture",model.arch?`${model.arch.layers} layers · ${model.arch.heads} KV heads · dim ${model.arch.headDim}`:"—","mono"],
              ["Context Window",`${fmtCtx(model.contextLen)} tokens (${model.contextLen.toLocaleString()})`,"mono"],
              ["Storage — BF16",bf?`${bf.size} GB on disk`:"—","mono"],
              ["Storage — Q4_K_M",q4?`${q4.size} GB on disk`:"—","mono"],
              ["Storage — Q8_0",q8?`${q8.size} GB on disk`:"—","mono"],
              ["Min VRAM Required",minVram?`${minVram} GB`:"—","mono"],
              ["Developer",model.developer,"text"],
              ["License",model.license,"text"],
              ["Released",model.released,"text"],
              ["Est. CO₂ / 1k tokens",co2!=="N/A"?`${co2} g CO₂ (India grid 0.82 kg/kWh)`:"N/A","mono"],
              ["Math — GSM8K",model.benchmarks.gsm8k!=null?`${model.benchmarks.gsm8k}% · Grade School Math 8K`:"N/A","text"],
              ["Reasoning — ARC-C",model.benchmarks.arc!=null?`${model.benchmarks.arc}% · AI2 Reasoning Challenge`:"N/A","text"],
              ["Knowledge — MMLU",model.benchmarks.mmlu!=null?`${model.benchmarks.mmlu}% · 57-subject test`:"N/A","text"],
              ["Code — HumanEval",model.benchmarks.humaneval!=null?`${model.benchmarks.humaneval}% · Python pass@1`:"N/A","text"],
            ];
            return(
              <div style={{margin:"14px 0 12px",padding:"12px 14px",background:"rgba(110,80,255,0.04)",borderRadius:10,border:"1px solid var(--border2)"}}>
                <div style={{fontWeight:700,fontSize:11,color:"var(--text2)",marginBottom:10,textTransform:"uppercase",letterSpacing:.5}}>📋 Full Model Specification</div>
                <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(178px,1fr))",gap:"7px 14px"}}>
                  {specs.map(([k,v,t])=>(
                    <div key={k}>
                      <div style={{fontSize:9,color:"var(--text3)",fontWeight:700,textTransform:"uppercase",letterSpacing:.3,marginBottom:2}}>{k}</div>
                      <div style={{fontSize:10,color:"var(--text)",lineHeight:1.4,fontFamily:t==="mono"?"'JetBrains Mono',monospace":"inherit",fontWeight:t==="mono"?600:500}}>{v}</div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })()}

          {/* Stress Tests */}
          <div style={{fontWeight:700,fontSize:11,color:"var(--text2)",margin:"14px 0 8px"}}>⚡ Stress Test Results</div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(220px,1fr))",gap:6}}>
            {model.stressTests.map((st,i)=>(
              <div key={i} style={{padding:"9px 11px",background:"rgba(255,255,255,0.025)",borderRadius:9,border:"1px solid var(--border2)"}}>
                <div style={{fontWeight:700,fontSize:11,color:"var(--text)",marginBottom:5}}>{st.hw}</div>
                <div style={{display:"flex",gap:5,flexWrap:"wrap",fontSize:10}}>
                  <span style={{color:"var(--accent2)",fontFamily:"'JetBrains Mono', monospace",fontWeight:700}}>{st.tokens_sec}t/s</span>
                  <span style={{color:"var(--text3)",fontFamily:"'JetBrains Mono', monospace"}}>{st.latency_ms}ms</span>
                  <span style={{color:"var(--text2)",fontFamily:"'JetBrains Mono', monospace"}}>{st.vram_used}GB</span>
                  {st.ctx&&<span style={{color:"var(--text3)",fontFamily:"'JetBrains Mono', monospace"}}>{fmtCtx(st.ctx)}ctx</span>}
                  <span style={{marginLeft:"auto",fontWeight:800,padding:"1px 7px",borderRadius:5,background:st.score>=90?"rgba(0,229,160,0.15)":st.score>=75?"rgba(255,184,48,0.15)":"rgba(255,75,110,0.15)",color:st.score>=90?"var(--green)":st.score>=75?"var(--amber)":"var(--red)",fontFamily:"'JetBrains Mono', monospace",fontSize:11}}>{st.score}/100</span>
                </div>
              </div>
            ))}
          </div>

          {/* Benchmark legend */}
          <div style={{marginTop:12,padding:"10px 12px",background:"rgba(255,255,255,0.02)",borderRadius:9,border:"1px solid var(--border2)"}}>
            <div style={{fontWeight:700,fontSize:10,color:"var(--text3)",marginBottom:7,textTransform:"uppercase",letterSpacing:.5}}>Benchmark Glossary</div>
            <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(200px,1fr))",gap:"5px 12px"}}>
              {[
                ["MMLU","Massive Multitask Language Understanding — 57 subject knowledge test (0–100%)"],
                ["HellaSwag","Commonsense NLI Reasoning — sentence completion (0–100%)"],
                ["ARC-C","AI2 Reasoning Challenge — science Q&A, hard set (0–100%)"],
                ["GSM8K","Grade School Math 8K — multi-step math word problems (0–100%)"],
                ["HumanEval","Python Code Generation — pass@1 functional correctness (0–100%)"],
                ["PPL","Perplexity — lower = better language model fit"],
                ["BPW","Bits Per Weight — compression level of GGUF quantization"],
                ["t/s","Tokens Per Second — generation throughput on hardware"],
              ].map(([k,v])=>(
                <div key={k} style={{display:"flex",gap:5,alignItems:"flex-start"}}>
                  <span style={{fontSize:9,fontWeight:800,color:"var(--accent2)",fontFamily:"'JetBrains Mono',monospace",flexShrink:0,minWidth:72,paddingTop:1}}>{k}</span>
                  <span style={{fontSize:9,color:"var(--text3)",lineHeight:1.4}}>{v}</span>
                </div>
              ))}
            </div>
          </div>

          <div style={{marginTop:12,display:"flex",gap:6,flexWrap:"wrap"}}>
            <button onClick={()=>onSelect(model)} style={{padding:"5px 13px",borderRadius:8,background:selectedModel?.id===model.id?"var(--accent)":"rgba(110,80,255,0.15)",color:selectedModel?.id===model.id?"#fff":"var(--accent2)",border:"1px solid var(--accent)",cursor:"pointer",fontSize:11,fontWeight:700,fontFamily:"inherit",transition:"all .15s"}}>
              {selectedModel?.id===model.id?"✓ Selected for KV Calc":"Select for KV Calc"}
            </button>
            <button onClick={()=>onCompareA(model)} style={{padding:"5px 13px",borderRadius:8,background:isA?"rgba(110,80,255,0.2)":"transparent",color:isA?"var(--accent2)":"var(--text2)",border:"1px solid var(--border)",cursor:"pointer",fontSize:11,fontWeight:600,fontFamily:"inherit"}}>Compare A</button>
            <button onClick={()=>onCompareB(model)} style={{padding:"5px 13px",borderRadius:8,background:isB?"rgba(0,229,160,0.2)":"transparent",color:isB?"var(--green)":"var(--text2)",border:"1px solid var(--border)",cursor:"pointer",fontSize:11,fontWeight:600,fontFamily:"inherit"}}>Compare B</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── MODEL COMPARE ────────────────────────────────────────────────────────────
function ModelCompare({a,b}){
  if(!a&&!b)return<div style={{color:"var(--text3)",textAlign:"center",padding:"2.5rem",fontSize:13}}>Select Compare A and B from any model card.</div>;
  if(!a||!b)return<div style={{color:"var(--text3)",textAlign:"center",padding:"2.5rem",fontSize:13}}>Select one more model to compare.</div>;
  const rows=[
    {l:"Params",ka:"params",fmt:v=>`${v}B`,hi:true},
    {l:"Context",ka:"contextLen",fmt:v=>fmtCtx(v),hi:true},
    {l:"MMLU",ka:"benchmarks.mmlu",fmt:v=>`${v}%`,hi:true},
    {l:"Hellaswag",ka:"benchmarks.hellaswag",fmt:v=>`${v}%`,hi:true},
    {l:"ARC",ka:"benchmarks.arc",fmt:v=>`${v}%`,hi:true},
    {l:"GSM8K",ka:"benchmarks.gsm8k",fmt:v=>`${v}%`,hi:true},
    {l:"HumanEval",ka:"benchmarks.humaneval",fmt:v=>`${v}%`,hi:true},
    {l:"Best Quant Speed",ka:null,fmt:(v,m)=>`${m.quants.reduce((x,q)=>Math.max(x,q.speed),0)}t/s`,hi:true},
    {l:"Min VRAM",ka:null,fmt:(v,m)=>{const a=m.quants.map(q=>q.vramReq).filter(x=>x>0);return a.length?`${Math.min(...a)} GB`:"N/A";},hi:false},
  ];
  const getVal=(m,key)=>{if(!key)return null;const p=key.split(".");return p.reduce((o,k)=>o?.[k],m)??null;};
  return(
    <div style={{overflowX:"auto"}}>
      <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
        <thead>
          <tr style={{borderBottom:"1px solid var(--border)"}}>
            <th style={{textAlign:"left",padding:"8px 10px",color:"var(--text2)",fontWeight:600}}>Metric</th>
            <th style={{textAlign:"right",padding:"8px 10px",color:"var(--accent2)",fontWeight:700}}>{a.name}</th>
            <th style={{textAlign:"right",padding:"8px 10px",color:"var(--green)",fontWeight:700}}>{b.name}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(row=>{
            const va=row.ka?getVal(a,row.ka):null;
            const vb=row.ka?getVal(b,row.ka):null;
            const da=row.fmt(va,a),db=row.fmt(vb,b);
            const numA=parseFloat(da),numB=parseFloat(db);
            const aWins=!isNaN(numA)&&!isNaN(numB)&&(row.hi?numA>numB:numA<numB);
            const bWins=!isNaN(numA)&&!isNaN(numB)&&(row.hi?numB>numA:numB<numA);
            return(
              <tr key={row.l} style={{borderBottom:"1px solid rgba(255,255,255,0.03)"}}>
                <td style={{padding:"7px 10px",color:"var(--text2)",fontWeight:600,fontSize:11}}>{row.l}</td>
                <td style={{padding:"7px 10px",textAlign:"right",fontFamily:"'JetBrains Mono', monospace",color:aWins?"var(--accent2)":"var(--text)",fontWeight:aWins?800:500}}>{da}{aWins&&" ★"}</td>
                <td style={{padding:"7px 10px",textAlign:"right",fontFamily:"'JetBrains Mono', monospace",color:bWins?"var(--green)":"var(--text)",fontWeight:bWins?800:500}}>{db}{bWins&&" ★"}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ─── FAQ ITEM (accordion) ─────────────────────────────────────────────────────
function FAQItem({q,a}){
  const [open,setOpen]=useState(false);
  return(
    <div style={{borderRadius:10,border:"1px solid var(--border)",overflow:"hidden",marginBottom:6,transition:"border .2s"}}>
      <button onClick={()=>setOpen(!open)} style={{width:"100%",textAlign:"left",padding:"12px 16px",background:"var(--surface2)",border:"none",cursor:"pointer",display:"flex",justifyContent:"space-between",alignItems:"center",gap:10,fontFamily:"inherit",transition:"background .15s"}} onMouseEnter={e=>e.currentTarget.style.background="var(--surface3)"} onMouseLeave={e=>e.currentTarget.style.background="var(--surface2)"}>
        <span style={{fontSize:13,fontWeight:600,color:"var(--text)",flex:1}}>{q}</span>
        <span style={{fontSize:12,color:"var(--accent2)",fontWeight:700,flexShrink:0,transform:open?"rotate(180deg)":"none",transition:"transform .2s"}}>▼</span>
      </button>
      {open&&(
        <div style={{padding:"12px 16px",background:"var(--surface)",borderTop:"1px solid var(--border)",fontSize:12,color:"var(--text2)",lineHeight:1.8}}>
          {a}
        </div>
      )}
    </div>
  );
}

// ─── CONCURRENT REQUEST SIMULATOR ────────────────────────────────────────────
function ConcurrentSimulator({selectedMap,selectedModel}){
  const [concUsers,setConcUsers]=useState(25);
  const [avgPrompt,setAvgPrompt]=useState(400);
  const [avgResponse,setAvgResponse]=useState(400);

  const calc=useMemo(()=>{
    const hwEntries=Object.entries(selectedMap||{})
      .map(([id,qty])=>{const h=ALL_HW.find(x=>x.id===id);return h?{h,qty}:null;})
      .filter(Boolean);
    const hw=hwEntries[0]?.h||ALL_HW.find(x=>x.id==="h100_sxm");
    const numGpu=hwEntries[0]?.qty||1;
    const totalVram=(hw?.vram||80)*numGpu;

    let modelVram,modelLabel,baseTps;
    if(selectedModel){
      const q=selectedModel.quants[0];
      modelVram=q?.vramReq||selectedModel.params*2;
      modelLabel=selectedModel.name;
      const cat=selectedModel.params<=9?"llama8b":"llama70b";
      baseTps=(hw?.tokensPerSec?.[cat]||40)*numGpu;
    } else {
      modelVram=64; modelLabel="32B Model (BF16)";
      const t=hw?.tokensPerSec;
      baseTps=t?.llama70b&&t?.llama8b
        ?Math.round((t.llama70b*0.35+t.llama8b*0.12)*numGpu)
        :45*numGpu;
    }

    // KV cache bytes per token: 2 × Layers × KV-Heads × HeadDim × 2 bytes (FP16)
    // Use model architecture when available, otherwise estimate for a 7B model
    const kvLayers=selectedModel?.arch?.layers||32;
    const kvHeads=selectedModel?.arch?.heads||8;
    const kvHeadDim=selectedModel?.arch?.headDim||128;
    const kvBytesPerTok=2*kvLayers*kvHeads*kvHeadDim*2; // FP16
    const kvMbPerTok=kvBytesPerTok/(1024*1024);
    // Total KV per concurrent user = (prompt+response) tokens × bytes/token
    const kvGbPerUser=((avgPrompt+avgResponse)*kvMbPerTok)/1024;
    const vramUsed=Math.min(modelVram+kvGbPerUser*concUsers+2,totalVram);
    const vramPct=Math.min(100,(vramUsed/totalVram)*100);

    const maxByVram=Math.max(1,Math.floor((totalVram-modelVram-2)/Math.max(kvGbPerUser,0.001)));
    // Batched throughput: sqrt scaling models the sub-linear gain from batching (up to 6× max)
    const batchedTps=baseTps*Math.min(Math.sqrt(Math.max(concUsers,1)),6);
    // TTFT: prefill (prompt processing) at 10× decode speed
    const prefillTps=baseTps*10;
    const ttft=Math.max(0.05,avgPrompt/Math.max(prefillTps,1));
    // GPU util: fraction of decode capacity consumed by all concurrent responses
    const targetDecodeWindow=30; // seconds window for GPU util estimate
    const gpuUtil=Math.min(100,((concUsers*avgResponse)/targetDecodeWindow)/Math.max(batchedTps,1)*100);
    const queueDepth=Math.max(0,concUsers-maxByVram);
    const errorRate=queueDepth>10?Math.min(50,(queueDepth-10)*2):0;
    const concHeadroom=Math.max(0,Math.min(100,100-Math.max(vramPct,gpuUtil)));
    const status=gpuUtil>90||vramPct>90?"Critical":gpuUtil>75||vramPct>80?"Warning":"Normal";
    const kvFormula={kvLayers,kvHeads,kvHeadDim,kvBytesPerTok,kvMbPerTok};

    const dotCount=Math.min(concUsers,60);
    const states=Array.from({length:dotCount},(_,i)=>{
      if(i>=maxByVram)return"queued";
      if(errorRate>0&&i%Math.max(1,Math.floor(100/errorRate))===0)return"failed";
      return"processing";
    });

    return{hw,numGpu,totalVram,modelLabel,modelVram,vramUsed,vramPct,gpuUtil,ttft,queueDepth,errorRate,concHeadroom,status,states,kvFormula,kvGbPerUser,batchedTps,baseTps};
  },[selectedMap,selectedModel,concUsers,avgPrompt,avgResponse]);

  const STATUS_COL={Normal:"var(--green)",Warning:"var(--amber)",Critical:"var(--red)"};
  const DOT_COL={processing:"#3B82F6",queued:"#F59E0B",failed:"#EF4444",done:"#10B981"};

  // ── live dot animation ──────────────────────────────────────────────────────
  const [liveStates,setLiveStates]=useState([]);

  // Re-seed when slider changes cause a new states array
  const stateKey=calc.states.join('');
  useEffect(()=>{
    setLiveStates(calc.states.map(s=>({state:s,tick:0})));
  },[stateKey]); // eslint-disable-line react-hooks/exhaustive-deps

  // Animation tick every 550 ms
  useEffect(()=>{
    const id=setInterval(()=>{
      setLiveStates(prev=>{
        if(!prev.length)return prev;
        const next=prev.map(d=>({...d,tick:d.tick+1}));
        for(let i=0;i<next.length;i++){
          if(next[i].state==='done'){
            // Promote oldest queued to processing, then reset this dot
            const qi=next.findIndex((x,j)=>j!==i&&x.state==='queued');
            if(qi>=0) next[qi]={...next[qi],state:'processing',tick:0};
            next[i]={...next[i],state:'processing',tick:0};
          } else if(next[i].state==='processing'){
            // ~12 % chance per tick to complete
            if(Math.random()<0.12) next[i]={...next[i],state:'done',tick:0};
          }
          // queued & failed pulse via tick — no state changes
        }
        return next;
      });
    },550);
    return()=>clearInterval(id);
  },[]);
  const sc=STATUS_COL[calc.status];

  const SRow=({label,value,setValue,min,max,step,fmt})=>(
    <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:8}}>
      <div style={{width:155,fontSize:11,color:"var(--text2)",flexShrink:0}}>{label}</div>
      <input type="range" min={min} max={max} step={step} value={value} onChange={e=>setValue(Number(e.target.value))} style={{flex:1,accentColor:"var(--accent)"}}/>
      <div style={{width:75,fontSize:12,fontFamily:"'JetBrains Mono',monospace",color:"var(--accent2)",textAlign:"right",fontWeight:700}}>{fmt(value)}</div>
    </div>
  );

  const msgText=calc.status==="Normal"
    ?`System is healthy. All ${concUsers} concurrent users served comfortably. TTFT within acceptable range.`
    :calc.status==="Warning"
    ?`System under moderate load. Consider scaling hardware or reducing concurrency. Queue depth: ${calc.queueDepth}.`
    :`Critical: System overloaded. ${calc.queueDepth} requests queued. Error rate ${calc.errorRate.toFixed(1)}%. Scale out immediately.`;

  return(
    <div style={{background:"var(--surface)",border:"1px solid var(--border)",borderRadius:14,padding:"20px 24px",marginTop:20}}>
      <div style={{fontWeight:700,fontSize:16,color:"var(--text)",marginBottom:4}}>🔁 Concurrent Request Simulator</div>
      <div style={{fontSize:11,color:"var(--text3)",marginBottom:16}}>
        Drag the sliders to simulate different load scenarios on your{" "}
        <strong style={{color:"var(--accent2)"}}>{calc.hw?.shortName||"H100 SXM5"} × {calc.numGpu} + {calc.modelLabel}</strong> setup.
      </div>

      <div style={{background:"rgba(255,255,255,0.02)",borderRadius:10,padding:"14px 16px",marginBottom:16}}>
        <SRow label="Concurrent users" value={concUsers} setValue={setConcUsers} min={1} max={100} step={1} fmt={v=>`${v}`}/>
        <SRow label="Avg prompt length" value={avgPrompt} setValue={setAvgPrompt} min={50} max={4096} step={50} fmt={v=>`${v} tok`}/>
        <SRow label="Avg response length" value={avgResponse} setValue={setAvgResponse} min={50} max={2048} step={50} fmt={v=>`${v} tok`}/>
      </div>

      <div style={{display:"grid",gridTemplateColumns:"repeat(5,1fr)",gap:8,marginBottom:10}}>
        {[["Status",calc.status,sc],["Est. TTFT",calc.ttft<1?`${(calc.ttft*1000).toFixed(0)}ms`:`${calc.ttft.toFixed(1)}s`,"var(--text)"],["Error rate",`${calc.errorRate.toFixed(0)}%`,calc.errorRate>0?"var(--red)":"var(--text)"],["Queue depth",`${calc.queueDepth}`,calc.queueDepth>0?"var(--amber)":"var(--text)"],["GPU util.",`${calc.gpuUtil.toFixed(0)}%`,calc.gpuUtil>90?"var(--red)":calc.gpuUtil>75?"var(--amber)":"var(--text)"]].map(([l,v,c])=>(
          <div key={l} style={{background:"rgba(255,255,255,0.03)",border:"1px solid var(--border2)",borderRadius:9,padding:"10px 12px"}}>
            <div style={{fontSize:9,color:"var(--text3)",textTransform:"uppercase",fontWeight:700,letterSpacing:.5,marginBottom:4}}>{l}</div>
            <div style={{fontSize:15,fontWeight:800,color:c,fontFamily:"'JetBrains Mono',monospace"}}>{v}</div>
          </div>
        ))}
      </div>

      <div style={{display:"inline-flex",flexDirection:"column",background:"rgba(255,255,255,0.03)",border:"1px solid var(--border2)",borderRadius:9,padding:"10px 16px",marginBottom:14}}>
        <div style={{fontSize:9,color:"var(--text3)",textTransform:"uppercase",fontWeight:700,letterSpacing:.5,marginBottom:2}}>VRAM used</div>
        <div style={{fontSize:20,fontWeight:800,color:"var(--text)",fontFamily:"'JetBrains Mono',monospace"}}>{calc.vramUsed.toFixed(0)} GB</div>
      </div>

      {[["VRAM usage",calc.vramPct,calc.vramPct>90?"#EF4444":calc.vramPct>75?"#F59E0B":"#854D0E"],["GPU utilization",calc.gpuUtil,calc.gpuUtil>90?"#EF4444":calc.gpuUtil>75?"#F59E0B":"#16A34A"],["Concurrency headroom",calc.concHeadroom,"#16A34A"]].map(([l,p,c])=>(
        <div key={l} style={{marginBottom:10}}>
          <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}>
            <span style={{fontSize:11,color:"var(--text2)"}}>{l}</span>
            <span style={{fontSize:11,fontWeight:700,color:"var(--text2)",fontFamily:"'JetBrains Mono',monospace"}}>{p.toFixed(0)}%</span>
          </div>
          <div style={{height:8,background:"var(--border)",borderRadius:4,overflow:"hidden"}}>
            <div style={{width:`${Math.min(100,p)}%`,height:"100%",background:c,borderRadius:4,transition:"width .3s ease"}}/>
          </div>
        </div>
      ))}

      <div style={{marginBottom:12}}>
        <div style={{fontSize:11,color:"var(--text2)",marginBottom:8}}>Request state — each dot = 1 request</div>
        <div style={{display:"flex",flexWrap:"wrap",gap:5}}>
          {(liveStates.length?liveStates:calc.states.map(s=>({state:s,tick:0}))).map((d,i)=>{
            const s=typeof d==="string"?d:d.state;
            const tick=typeof d==="object"?d.tick:0;
            const col=DOT_COL[s];
            // Processing: scale pulses 1.12 ↔ 0.92 every 2 ticks
            const isProc=s==="processing";
            const isDone=s==="done";
            const isFail=s==="failed";
            const isQueue=s==="queued";
            const pCycle=tick%4;
            const scale=isProc?(pCycle<2?1.12:0.92):isDone?1.18:1;
            const opacity=isFail?(tick%2===0?1:0.35):isQueue?(tick%6<3?1:0.55):1;
            const shadow=isDone?`0 0 10px ${col}cc`:isProc&&pCycle<2?`0 0 7px ${col}88`:"none";
            const label=isDone?"✓":isFail?"✗":`${i+1}`;
            return(
              <div key={i} title={s.charAt(0).toUpperCase()+s.slice(1)} style={{
                width:26,height:26,borderRadius:"50%",
                background:col+(isDone?"55":"22"),
                border:`${isDone?3:2}px solid ${col}`,
                display:"flex",alignItems:"center",justifyContent:"center",
                fontSize:isDone||isFail?11:8,fontWeight:700,color:col,
                fontFamily:"'JetBrains Mono',monospace",
                transform:`scale(${scale})`,
                opacity,
                boxShadow:shadow,
                transition:"transform 0.28s ease,opacity 0.28s ease,box-shadow 0.28s ease,background 0.2s,border-color 0.2s",
              }}>
                {label}
              </div>
            );
          })}
        </div>
        <div style={{display:"flex",gap:16,marginTop:8,flexWrap:"wrap"}}>
          {[["Processing","#3B82F6","Actively generating tokens, pulses"],["Queued","#F59E0B","Waiting for VRAM slot, breathes"],["Failed","#EF4444","Dropped — VRAM/queue overflow, blinks"],["Done","#10B981","Request completed, green flash"]].map(([l,c,tip])=>(
            <div key={l} title={tip} style={{display:"flex",alignItems:"center",gap:5,cursor:"default"}}>
              <div style={{width:10,height:10,borderRadius:"50%",border:`2px solid ${c}`,background:c+"33"}}/>
              <span style={{fontSize:10,color:"var(--text3)"}}>{l}</span>
            </div>
          ))}
        </div>
      </div>

      <div style={{padding:"10px 14px",borderRadius:9,background:sc+"18",border:`1px solid ${sc}44`,fontSize:11,color:"var(--text2)",lineHeight:1.5}}>
        <span style={{color:sc,fontWeight:700}}>●</span>{" "}{msgText}
      </div>

      {/* Formula annotations */}
      <div style={{marginTop:14,background:"rgba(110,80,255,0.06)",borderRadius:9,padding:"10px 13px",border:"1px solid rgba(110,80,255,0.18)"}}>
        <div style={{fontSize:9,color:"var(--accent2)",fontWeight:700,textTransform:"uppercase",letterSpacing:.5,marginBottom:6}}>Formulas Used</div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(280px,1fr))",gap:"5px 16px",fontSize:10,fontFamily:"'JetBrains Mono',monospace",lineHeight:1.8,color:"var(--text2)"}}>
          <div><span style={{color:"var(--text3)"}}>KV bytes/token</span> = 2 × L{calc.kvFormula.kvLayers} × H{calc.kvFormula.kvHeads} × d{calc.kvFormula.kvHeadDim} × 2B = <span style={{color:"var(--accent2)",fontWeight:700}}>{(calc.kvFormula.kvMbPerTok*1024).toFixed(0)} KB/tok</span></div>
          <div><span style={{color:"var(--text3)"}}>KV per user</span> = (prompt+resp) × KB/tok ÷ 1024 = ({avgPrompt}+{avgResponse}) × {(calc.kvFormula.kvMbPerTok*1024).toFixed(0)} KB ÷ 1024 = <span style={{color:"var(--amber)",fontWeight:700}}>{calc.kvGbPerUser.toFixed(3)} GB</span></div>
          <div><span style={{color:"var(--text3)"}}>Batched TPS</span> = base_tps × min(√users, 6) = {calc.baseTps} × {Math.min(Math.sqrt(Math.max(concUsers,1)),6).toFixed(2)} = <span style={{color:"var(--green)",fontWeight:700}}>{Math.round(calc.batchedTps)} t/s</span></div>
          <div><span style={{color:"var(--text3)"}}>TTFT</span> = prompt_tokens ÷ prefill_tps = {avgPrompt} ÷ {calc.baseTps*10} = <span style={{color:"var(--text)",fontWeight:700}}>{calc.ttft<1?`${(calc.ttft*1000).toFixed(0)}ms`:`${calc.ttft.toFixed(2)}s`}</span></div>
          <div><span style={{color:"var(--text3)"}}>GPU util</span> = (users × resp_tokens ÷ 30s) ÷ batched_tps × 100 = <span style={{color:calc.gpuUtil>90?"var(--red)":calc.gpuUtil>75?"var(--amber)":"var(--green)",fontWeight:700}}>{calc.gpuUtil.toFixed(0)}%</span></div>
          <div style={{fontSize:9,color:"var(--text3)",fontFamily:"inherit"}}>Architecture: {selectedModel?`${selectedModel.name} (${calc.kvFormula.kvLayers}L × ${calc.kvFormula.kvHeads}H × ${calc.kvFormula.kvHeadDim}d)`:"Default 7B estimate (32L × 8H × 128d)"}</div>
        </div>
      </div>
    </div>
  );
}

// ─── STRESS TEST DEPLOYER ─────────────────────────────────────────────────────
function StressTestDeployer({selectedMap,selectedModel}){
  const [scriptType,setScriptType]=useState("ollama");
  const [concurrency,setConcurrency]=useState(25);
  const [totalRequests,setTotalRequests]=useState(100);
  const [copied,setCopied]=useState(false);

  // Derive build info from selectedMap
  const hwEntries=useMemo(()=>
    Object.entries(selectedMap||{}).map(([id,qty])=>{
      const h=ALL_HW.find(x=>x.id===id);return h?{h,qty}:null;
    }).filter(Boolean)
  ,[selectedMap]);
  const primaryEntry=hwEntries[0];
  const hw=primaryEntry?.h;
  const gpuCount=hwEntries.reduce((a,{qty})=>a+qty,0)||1;
  const vramGb=hwEntries.reduce((a,{h,qty})=>a+h.vram*qty,0)||(hw?.vram||80);
  const tdpW=hwEntries.reduce((a,{h,qty})=>a+h.tdp*qty,0)||(hw?.tdp||400);

  const hasHw=hwEntries.length>0;
  const hasModel=!!selectedModel;

  // Choose best fitting quant
  const bestQuant=useMemo(()=>{
    if(!selectedModel)return{format:"Q4_K_M"};
    const fits=selectedModel.quants.filter(q=>q.vramReq<=vramGb);
    return fits.length?fits[0]:selectedModel.quants[selectedModel.quants.length-1];
  },[selectedModel,vramGb]);

  const params=useMemo(()=>({
    gpuName:hw?.shortName||"GPU",
    gpuCount,
    vramGb,
    tdpW,
    modelName:selectedModel?.name||"",
    modelId:selectedModel?.id||"model",
    hfModelId:selectedModel?.hfUrl?.replace("https://huggingface.co/","")||"",
    ollamaTag:selectedModel?toOllamaTag(selectedModel.id,bestQuant.format):"",
    paramsBillion:selectedModel?.params||7,
    contextSize:Math.min(selectedModel?.contextLen||32768,32768),
    quantFormat:bestQuant.format,
    concurrency,
    totalRequests,
  }),[hw,gpuCount,vramGb,tdpW,selectedModel,bestQuant,concurrency,totalRequests]);

  const script=useMemo(()=>{
    if(!hasModel||!hasHw)return"# Select a model and add hardware to your build first.";
    try{
      if(scriptType==="ollama") return buildOllamaScript(params);
      if(scriptType==="llamacpp") return buildLlamaCppScript(params);
      if(scriptType==="vllm") return buildVllmScript(params);
      return buildPythonScript(params);
    }catch(e){
      return`# Script generation error: ${e.message}\n# Please check your model and hardware selection.`;
    }
  },[scriptType,params,hasModel,hasHw]);

  const ext=scriptType==="python"?".py":".sh";
  const filename=`stress-test-${params.modelId}-${scriptType}${ext}`;

  const runpodGpuType=hw?RUNPOD_GPU_MAP[hw.id]:null;
  const runpodUrl=runpodGpuType
    ?`https://www.runpod.io/console/gpu-secure-cloud?gpuDisplayName=${encodeURIComponent(runpodGpuType)}&gpuCount=${gpuCount}`
    :"https://www.runpod.io/console/gpu-secure-cloud";
  const onRunPod=hw&&!RUNPOD_GPU_MAP[hw.id];

  const doCopy=()=>{
    navigator.clipboard.writeText(script).then(()=>{setCopied(true);setTimeout(()=>setCopied(false),2000);});
  };
  const doDownload=()=>{
    const blob=new Blob([script],{type:"text/plain"});
    const a=document.createElement("a");
    a.href=URL.createObjectURL(blob);
    a.download=filename;
    a.click();
  };

  const TABS=[
    {key:"ollama",label:"Ollama",icon:"🦙",desc:"ollama serve + parallel slots"},
    {key:"llamacpp",label:"llama.cpp",icon:"⚡",desc:"llama-server + Apache Bench"},
    {key:"vllm",label:"vLLM",icon:"🚀",desc:"OpenAI API server + locust"},
    {key:"python",label:"Python asyncio",icon:"🐍",desc:"aiohttp concurrent loop"},
  ];

  return(
    <div style={{background:"var(--surface)",border:"1px solid var(--border)",borderRadius:14,padding:"20px 24px",marginBottom:20}}>
      {/* Header */}
      <div style={{fontWeight:700,fontSize:16,color:"var(--text)",marginBottom:4}}>🚀 Deploy & Stress Test</div>
      <div style={{fontSize:11,color:"var(--text3)",marginBottom:14}}>Pre-built scripts with parameters auto-filled from your build — no AI, pure template substitution. Copy, download, or deploy directly on RunPod.</div>

      {/* Status banner */}
      <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:14}}>
        <div style={{padding:"5px 12px",borderRadius:7,fontSize:11,fontWeight:600,
          background:hasHw?"rgba(0,229,160,0.08)":"rgba(255,184,48,0.08)",
          border:`1px solid ${hasHw?"rgba(0,229,160,0.25)":"rgba(255,184,48,0.25)"}`,
          color:hasHw?"var(--green)":"var(--amber)"}}>
          {hasHw?`⚡ ${hwEntries.map(({h,qty})=>`${h.shortName}×${qty}`).join(" + ")}  (${vramGb} GB, ${tdpW} W)`:"⚠ No hardware in build"}
        </div>
        <div style={{padding:"5px 12px",borderRadius:7,fontSize:11,fontWeight:600,
          background:hasModel?"rgba(110,80,255,0.08)":"rgba(255,184,48,0.08)",
          border:`1px solid ${hasModel?"rgba(110,80,255,0.25)":"rgba(255,184,48,0.25)"}`,
          color:hasModel?"var(--accent2)":"var(--amber)"}}>
          {hasModel?`🧠 ${selectedModel.name}  (${bestQuant.format}, ${bestQuant.vramReq} GB)`:"⚠ No model selected"}
        </div>
      </div>

      {/* Script type tabs */}
      <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:14}}>
        {TABS.map(t=>(
          <button key={t.key} onClick={()=>setScriptType(t.key)} style={{
            padding:"6px 14px",borderRadius:8,border:"none",cursor:"pointer",fontFamily:"inherit",
            background:scriptType===t.key?"var(--accent)":"var(--surface2)",
            color:scriptType===t.key?"#fff":"var(--text2)",
            fontWeight:scriptType===t.key?700:500,fontSize:11,
            boxShadow:scriptType===t.key?"0 0 8px var(--accent)55":"none",
            transition:"all .15s",
          }}>
            {t.icon} {t.label}
            <span style={{display:"block",fontSize:9,color:scriptType===t.key?"rgba(255,255,255,0.7)":"var(--text3)",fontWeight:400,marginTop:1}}>{t.desc}</span>
          </button>
        ))}
      </div>

      {/* Parameter summary */}
      {(hasHw||hasModel)&&(
        <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:12}}>
          {[
            ["Concurrency","concurrent requests",concurrency,setConcurrency,1,100,1],
            ["Total requests","total to send",totalRequests,setTotalRequests,10,500,10],
          ].map(([label,hint,val,fn,mn,mx,step])=>(
            <div key={label} style={{flex:"1 1 180px",background:"rgba(255,255,255,0.02)",borderRadius:9,padding:"10px 13px",border:"1px solid var(--border2)"}}>
              <div style={{fontSize:10,color:"var(--text3)",marginBottom:4}}>{label} <span style={{fontSize:9}}>({hint})</span></div>
              <div style={{display:"flex",alignItems:"center",gap:8}}>
                <input type="range" min={mn} max={mx} step={step} value={val} onChange={e=>fn(Number(e.target.value))} style={{flex:1,accentColor:"var(--accent)"}}/>
                <span style={{fontSize:13,fontWeight:700,color:"var(--accent2)",fontFamily:"'JetBrains Mono',monospace",minWidth:32,textAlign:"right"}}>{val}</span>
              </div>
            </div>
          ))}
          {hasModel&&<div style={{flex:"1 1 120px",background:"rgba(255,255,255,0.02)",borderRadius:9,padding:"10px 13px",border:"1px solid var(--border2)"}}>
            <div style={{fontSize:10,color:"var(--text3)",marginBottom:4}}>Context window</div>
            <div style={{fontSize:13,fontWeight:700,color:"var(--text)",fontFamily:"'JetBrains Mono',monospace"}}>{params.contextSize.toLocaleString()} tok</div>
          </div>}
          {hasModel&&<div style={{flex:"1 1 120px",background:"rgba(255,255,255,0.02)",borderRadius:9,padding:"10px 13px",border:"1px solid var(--border2)"}}>
            <div style={{fontSize:10,color:"var(--text3)",marginBottom:4}}>Quant format</div>
            <div style={{fontSize:13,fontWeight:700,color:"var(--accent2)",fontFamily:"'JetBrains Mono',monospace"}}>{params.quantFormat}</div>
          </div>}
        </div>
      )}

      {/* Script box */}
      <div style={{position:"relative",marginBottom:14}}>
        <div style={{
          background:"#0a0a16",border:"1px solid var(--border2)",borderRadius:10,
          padding:"14px 16px",maxHeight:380,overflowY:"auto",overflowX:"auto",
          fontFamily:"'JetBrains Mono',monospace",fontSize:11,lineHeight:1.65,
          color:hasHw&&hasModel?"#c4b8ff":"var(--text3)",whiteSpace:"pre",
        }}>
          {script}
        </div>
      </div>

      {/* Action buttons */}
      <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
        <button onClick={doCopy} disabled={!hasHw||!hasModel} style={{
          padding:"9px 18px",borderRadius:9,border:"none",cursor:hasHw&&hasModel?"pointer":"not-allowed",
          background:copied?"var(--green)":"var(--accent)",color:"#fff",fontWeight:700,fontSize:12,
          fontFamily:"inherit",transition:"all .2s",opacity:hasHw&&hasModel?1:0.5,
        }}>
          {copied?"✓ Copied!":"📋 Copy Script"}
        </button>
        <button onClick={doDownload} disabled={!hasHw||!hasModel} style={{
          padding:"9px 18px",borderRadius:9,border:"1px solid var(--border)",cursor:hasHw&&hasModel?"pointer":"not-allowed",
          background:"var(--surface2)",color:"var(--text)",fontWeight:700,fontSize:12,
          fontFamily:"inherit",transition:"all .2s",opacity:hasHw&&hasModel?1:0.5,
        }}>
          ⬇ Download {ext}
        </button>
        <a href={runpodUrl} target="_blank" rel="noopener noreferrer" style={{textDecoration:"none"}}>
          <button style={{
            padding:"9px 18px",borderRadius:9,border:"none",cursor:"pointer",
            background:"linear-gradient(135deg,#7c3aed,#4f46e5)",color:"#fff",
            fontWeight:700,fontSize:12,fontFamily:"inherit",transition:"all .2s",
            display:"flex",alignItems:"center",gap:7,
          }}>
            <span style={{fontSize:16}}>▲</span>
            Deploy on RunPod
            {onRunPod&&<span style={{fontSize:9,opacity:.7,fontWeight:400}}>(generic GPU list)</span>}
          </button>
        </a>
        {hasModel&&(
          <a href={selectedModel.hfUrl} target="_blank" rel="noopener noreferrer" style={{textDecoration:"none"}}>
            <button style={{
              padding:"9px 18px",borderRadius:9,border:"1px solid var(--border)",cursor:"pointer",
              background:"var(--surface2)",color:"var(--text2)",fontWeight:700,fontSize:12,fontFamily:"inherit",
            }}>
              🤗 Model on HuggingFace ↗
            </button>
          </a>
        )}
      </div>

      {onRunPod&&(
        <div style={{marginTop:8,fontSize:10,color:"var(--amber)",padding:"5px 10px",background:"rgba(255,184,48,0.07)",borderRadius:6,border:"1px solid rgba(255,184,48,0.2)"}}>
          ⚠ {hw?.shortName} is not available on RunPod — link opens the GPU cloud browser. Select the closest equivalent GPU manually.
        </div>
      )}
      {!hasHw&&!hasModel&&(
        <div style={{marginTop:8,fontSize:11,color:"var(--text3)"}}>
          → Add hardware in the <strong style={{color:"var(--accent2)"}}>Build</strong> tab and select a model in the <strong style={{color:"var(--accent2)"}}>Models</strong> tab to generate scripts.
        </div>
      )}
    </div>
  );
}

// ─── POWER COST CALCULATOR ────────────────────────────────────────────────────
function PowerCostCalc({selectedMap}){
  const [rateINR,setRateINR]=useState(8);     // ₹/kWh
  const [hoursDay,setHoursDay]=useState(24);  // operating hours per day
  const [pue,setPue]=useState(1.2);           // Power Usage Effectiveness (datacenter overhead)

  if(!selectedMap||Object.keys(selectedMap).length===0){
    return(
      <div style={{background:"var(--surface)",border:"1px solid var(--border)",borderRadius:14,padding:"18px 20px"}}>
        <div style={{fontWeight:700,fontSize:14,marginBottom:10,color:"var(--text)"}}>⚡ Power Cost Calculator</div>
        <div style={{color:"var(--text3)",fontSize:12}}>Add hardware to your build to estimate power costs.</div>
      </div>
    );
  }
  const entries=Object.entries(selectedMap).map(([id,qty])=>{const h=ALL_HW.find(x=>x.id===id);return h?{h,qty}:null;}).filter(Boolean);
  const totalW=entries.reduce((a,{h,qty})=>a+h.tdp*qty,0);
  const effectiveW=totalW*pue;                // wall-power including cooling overhead
  // Formula: (W ÷ 1000) × hours/day × days × ₹/kWh × PUE
  const dailyINR=(effectiveW/1000)*hoursDay*rateINR;
  const monthlyINR=dailyINR*30;
  const annuallyINR=dailyINR*365;
  const monthlyUSD=monthlyINR/(_liveRate||83.5);
  const annuallyUSD=annuallyINR/(_liveRate||83.5);
  const kwhPerMonth=(effectiveW/1000)*hoursDay*30;

  return(
    <div style={{background:"var(--surface)",border:"1px solid var(--border)",borderRadius:14,padding:"18px 20px"}}>
      <div style={{fontWeight:700,fontSize:14,marginBottom:4,color:"var(--text)"}}>⚡ Power Cost Calculator</div>
      <div style={{fontSize:10,color:"var(--text3)",marginBottom:14}}>Actual wall-power cost including cooling overhead (PUE).</div>

      {/* Sliders */}
      <div style={{background:"rgba(255,255,255,0.02)",borderRadius:10,padding:"12px 14px",marginBottom:14}}>
        {[
          ["Electricity rate","₹/kWh",rateINR,setRateINR,3,20,0.5],
          ["GPU hours / day","h",hoursDay,setHoursDay,1,24,1],
          ["PUE (cooling overhead)","×",pue,setPue,1.0,2.0,0.05],
        ].map(([label,unit,val,fn,mn,mx,step])=>(
          <div key={label} style={{display:"flex",alignItems:"center",gap:8,marginBottom:8}}>
            <div style={{width:175,fontSize:11,color:"var(--text2)",flexShrink:0}}>{label}</div>
            <input type="range" min={mn} max={mx} step={step} value={val} onChange={e=>fn(Number(e.target.value))} style={{flex:1,accentColor:"var(--accent)"}}/>
            <span style={{fontSize:12,fontWeight:700,color:"var(--accent2)",fontFamily:"'JetBrains Mono',monospace",minWidth:44,textAlign:"right"}}>{val}{unit}</span>
          </div>
        ))}
      </div>

      {/* Results */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(130px,1fr))",gap:8,marginBottom:14}}>
        {[
          ["GPU TDP",`${totalW} W`,"var(--amber)"],
          ["Wall Power",`${Math.round(effectiveW)} W`,"var(--amber)"],
          ["kWh / Month",`${kwhPerMonth.toFixed(0)} kWh`,"var(--text2)"],
          ["Daily",`₹${Math.round(dailyINR).toLocaleString("en-IN")}`,"var(--text)"],
          ["Monthly INR",`₹${Math.round(monthlyINR).toLocaleString("en-IN")}`,"var(--green)"],
          ["Monthly USD",`$${monthlyUSD.toFixed(0)}`,"var(--accent2)"],
          ["Annually INR",`₹${Math.round(annuallyINR).toLocaleString("en-IN")}`,"var(--red)"],
          ["Annually USD",`$${annuallyUSD.toFixed(0)}`,"var(--red)"],
        ].map(([l,v,c])=>(
          <div key={l} style={{background:"rgba(255,255,255,0.03)",borderRadius:9,padding:"9px 11px",border:"1px solid var(--border2)"}}>
            <div style={{fontSize:9,color:"var(--text3)",fontWeight:700,textTransform:"uppercase",letterSpacing:.4,marginBottom:3}}>{l}</div>
            <div style={{fontSize:13,fontWeight:800,color:c,fontFamily:"'JetBrains Mono',monospace"}}>{v}</div>
          </div>
        ))}
      </div>

      {/* Formula box */}
      <div style={{background:"rgba(110,80,255,0.06)",borderRadius:9,padding:"10px 13px",border:"1px solid rgba(110,80,255,0.18)"}}>
        <div style={{fontSize:9,color:"var(--accent2)",fontWeight:700,textTransform:"uppercase",letterSpacing:.5,marginBottom:5}}>Formula</div>
        <div style={{fontSize:10,color:"var(--text2)",lineHeight:1.9,fontFamily:"'JetBrains Mono',monospace"}}>
          <div><span style={{color:"var(--text3)"}}>Wall power</span> = TDP_W × PUE = {totalW} × {pue} = <span style={{color:"var(--amber)",fontWeight:700}}>{Math.round(effectiveW)} W</span></div>
          <div><span style={{color:"var(--text3)"}}>kWh/month</span> = (W ÷ 1000) × h/day × 30 = ({Math.round(effectiveW)} ÷ 1000) × {hoursDay} × 30 = <span style={{color:"var(--text)",fontWeight:700}}>{kwhPerMonth.toFixed(0)} kWh</span></div>
          <div><span style={{color:"var(--text3)"}}>Monthly cost</span> = kWh × ₹/kWh = {kwhPerMonth.toFixed(0)} × ₹{rateINR} = <span style={{color:"var(--green)",fontWeight:700}}>₹{Math.round(monthlyINR).toLocaleString("en-IN")}</span></div>
          <div style={{fontSize:9,color:"var(--text3)",marginTop:3}}>PUE (Power Usage Effectiveness) accounts for cooling, networking, and facility overhead. Typical: 1.1–1.5 for server rooms, 1.0 for consumer desktops.</div>
        </div>
      </div>
    </div>
  );
}

// ─── TCO CALCULATOR ───────────────────────────────────────────────────────────
function TCOCalculator({selectedMap}){
  const [gpuPriceLakh,setGpuPriceLakh]=useState(16);
  const [serverHwLakh,setServerHwLakh]=useState(5);
  const [electricityRate,setElectricityRate]=useState(8);
  const [gpuHoursDay,setGpuHoursDay]=useState(12);
  const [itStaffCost,setItStaffCost]=useState(50000);
  const [deprecYears,setDeprecYears]=useState(3);
  const [currency,setCurrency]=useState("INR");
  const rate=_liveRate||83.5;

  // Derive actual GPU TDP from selected build; fallback = 400 W (generic A100 placeholder)
  const hwEntries=useMemo(()=>Object.entries(selectedMap||{}).map(([id,qty])=>{const h=ALL_HW.find(x=>x.id===id);return h?{h,qty}:null;}).filter(Boolean),[selectedMap]);
  const actualGpuTdpW=hwEntries.length>0?hwEntries.reduce((a,{h,qty})=>a+h.tdp*qty,0):400;
  const gpuLabel=hwEntries.length>0?hwEntries.map(({h,qty})=>`${h.shortName}×${qty}`).join(" + "):"Generic (400 W fallback)";
  // Estimated throughput from selected hardware (tokens/sec for ~32B model equivalent)
  const hwTps=hwEntries.length>0
    ?hwEntries.reduce((a,{h,qty})=>a+(h.tokensPerSec?.llama70b||h.tokensPerSec?.llama8b||45)*qty,0)
    :45;

  const L=100000;
  const capex=(gpuPriceLakh+serverHwLakh+1.5)*L;
  // Power: (TDP_W ÷ 1000) × h/day × 30 days × ₹/kWh
  const kwhPerMonth=(actualGpuTdpW/1000)*gpuHoursDay*30;
  const electricityMonthly=kwhPerMonth*electricityRate;
  const monthlyOpex=electricityMonthly+itStaffCost;
  const monthlyDep=capex/(deprecYears*12);
  const monthlyTotal=monthlyOpex+monthlyDep;
  const costPerEmployee=monthlyTotal/200;
  // Requests/month: tokens/sec × 3600 s/h × h/day × 30 days ÷ avg_tokens_per_request
  const avgTokPerReq=900;
  const reqPerMonth=(hwTps*3600*gpuHoursDay*30)/avgTokPerReq;
  const costPerRequest=monthlyTotal/Math.max(reqPerMonth,1);
  const threeYearTotal=capex+monthlyOpex*36;

  // Cloud on-demand pricing (2025, per GPU-hour in USD)
  // Sources: AWS pricing page, GCP calculator, Azure pricing as of Q2 2025
  const cloudHrs=gpuHoursDay*30;
  const awsA100perHr=4.10;   // p4d.24xlarge ÷ 8 GPUs ($32.77/hr shared)
  const awsA10GperHr=1.006;  // g5.xlarge — A10G 24 GB
  const awsV100perHr=3.06;   // p3.2xlarge — V100 16 GB
  const gcpA100perHr=3.673;  // a2-highgpu-1g — A100 40 GB
  const gcpL4perHr=1.33;     // g2-standard-4 — L4 24 GB
  const gcpT4perHr=0.95;     // n1-standard-8 + T4 16 GB
  const azureA100perHr=3.673;// NC24ads_A100_v4 — A100 80 GB
  const azureA10perHr=1.17;  // NV6ads_A10_v5 — A10 24 GB
  const azureV100perHr=3.06; // NC6s_v3 — V100 16 GB
  const togetherTokPerM=0.88;// Together AI Llama-3.3-70B $/M tokens (input+output avg)
  const togetherMonthlyTokens=(hwTps*3600*gpuHoursDay*30)/1e6; // equivalent usage
  const togetherMonthlyCostINR=togetherTokPerM*togetherMonthlyTokens*rate;
  const e2eA100INR=Math.round(99.78*cloudHrs*rate); // E2E Networks A100 ₹99.78/hr reserved rate

  // E2E break-even
  const breakEvenMonths=Math.round(capex/Math.max(e2eA100INR-monthlyOpex,1));

  const fmtINRK=v=>{const abs=Math.abs(v);if(abs>=1e7)return`₹${(v/1e7).toFixed(2)}Cr`;if(abs>=1e5)return`₹${(v/1e5).toFixed(1)}L`;if(abs>=1e3)return`₹${(v/1e3).toFixed(0)}K`;return`₹${Math.round(v)}`;};
  const fmtL=v=>fmtINRK(v);
  const fmtK=v=>fmtINRK(v);
  const fmtUSDVal=v=>v>=1000?`$${Math.round(v/1000)}K`:`$${Math.round(v)}`;

  const depPct=Math.round(monthlyDep/monthlyTotal*100);
  const elecPct=Math.max(1,Math.round(electricityMonthly/monthlyTotal*100));
  const itPct=Math.max(1,Math.round(itStaffCost/monthlyTotal*100));

  const SRow=({label,value,setValue,min,max,step,type="other"})=>{
    let dispVal,altNote,unitLabel;
    if(type==="lakh"){
      const usd=Math.round(value*L/rate);
      if(currency==="INR"){dispVal=value;unitLabel="₹L";altNote=`≈ ${fmtUSDVal(usd)} USD`;}
      else{dispVal=usd;unitLabel="$";altNote=`≈ ₹${value}L INR`;}
    } else if(type==="staff"){
      const usd=Math.round(value/rate);
      if(currency==="INR"){dispVal=value;unitLabel="₹/mo";altNote=`≈ $${usd.toLocaleString()}/mo USD`;}
      else{dispVal=usd;unitLabel="$/mo";altNote=`≈ ₹${value.toLocaleString("en-IN")}/mo INR`;}
    } else if(type==="elec"){
      const usd=parseFloat((value/rate).toFixed(4));
      if(currency==="INR"){dispVal=value;unitLabel="₹/kWh";altNote=`≈ $${usd}/kWh USD`;}
      else{dispVal=usd;unitLabel="$/kWh";altNote=`≈ ₹${value}/kWh INR`;}
    } else {
      dispVal=value;unitLabel=type==="hrs"?"hrs":type==="yrs"?"yrs":"";altNote="";
    }
    const onTextChange=(e)=>{
      const n=parseFloat(e.target.value);if(isNaN(n))return;
      if(type==="lakh"&&currency==="USD") setValue(Math.min(max,Math.max(min,parseFloat((n*rate/L).toFixed(1)))));
      else if(type==="staff"&&currency==="USD") setValue(Math.min(max,Math.max(min,Math.round(n*rate))));
      else if(type==="elec"&&currency==="USD") setValue(Math.min(max,Math.max(min,parseFloat((n*rate).toFixed(1)))));
      else setValue(Math.min(max,Math.max(min,parseFloat(String(n)))));
    };
    return(
      <div style={{marginBottom:10}}>
        <div style={{display:"flex",alignItems:"center",gap:8}}>
          <div style={{width:165,fontSize:11,color:"var(--text2)",flexShrink:0}}>{label}</div>
          <input type="range" min={min} max={max} step={step} value={value} onChange={e=>setValue(Number(e.target.value))} style={{flex:1,accentColor:"var(--accent)"}}/>
          <input type="number" value={dispVal} onChange={onTextChange} style={{width:74,background:"var(--surface2)",border:"1px solid var(--border)",borderRadius:6,color:"var(--accent2)",padding:"3px 5px",fontSize:11,fontFamily:"'JetBrains Mono',monospace",textAlign:"right",outline:"none"}}/>
          <span style={{fontSize:9,color:"var(--text3)",minWidth:44,textAlign:"right",flexShrink:0,fontFamily:"'JetBrains Mono',monospace"}}>{unitLabel}</span>
        </div>
        {altNote&&<div style={{textAlign:"right",fontSize:9,color:"var(--text3)",marginTop:2,lineHeight:1.3}}>{altNote}</div>}
      </div>
    );
  };

  return(
    <div style={{background:"var(--surface)",border:"1px solid var(--border)",borderRadius:14,padding:"20px 24px",marginTop:16}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:8,marginBottom:4}}>
        <div style={{fontWeight:700,fontSize:16,color:"var(--text)"}}>💰 Total Cost of Ownership Calculator</div>
        <div style={{display:"flex",background:"var(--surface2)",borderRadius:8,padding:3,border:"1px solid var(--border)"}}>
          {["INR","USD"].map(c=>(
            <button key={c} onClick={()=>setCurrency(c)} style={{padding:"4px 14px",borderRadius:6,border:"none",background:currency===c?"var(--accent)":"transparent",color:currency===c?"#fff":"var(--text3)",fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:"inherit",transition:"all .15s"}}>
              {c==="INR"?"₹ INR":"$ USD"}
            </button>
          ))}
        </div>
      </div>
      <div style={{fontSize:11,color:"var(--text3)",marginBottom:8}}>
        Adjust inputs · showing <strong style={{color:"var(--accent2)"}}>{currency==="INR"?"Indian Rupees (₹)":"US Dollars ($)"}</strong> · live rate: <span style={{fontFamily:"'JetBrains Mono',monospace",color:"var(--green)"}}>₹{Math.round(rate)}/$</span> · type directly into any field.
      </div>

      {/* Hardware TDP auto-detected banner */}
      <div style={{background:hwEntries.length>0?"rgba(0,229,160,0.07)":"rgba(255,184,48,0.07)",border:`1px solid ${hwEntries.length>0?"rgba(0,229,160,0.25)":"rgba(255,184,48,0.25)"}`,borderRadius:9,padding:"7px 12px",marginBottom:14,fontSize:11,color:"var(--text2)"}}>
        {hwEntries.length>0
          ?<>⚡ Using actual build TDP: <strong style={{color:"var(--green)"}}>{actualGpuTdpW} W</strong> from <span style={{color:"var(--accent2)"}}>{gpuLabel}</span></>
          :<>⚠ No build selected — using <strong style={{color:"var(--amber)"}}>400 W</strong> placeholder. Add hardware in the Build tab for accurate power costs.</>
        }
      </div>

      <div style={{background:"rgba(255,255,255,0.02)",borderRadius:10,padding:"14px 16px",marginBottom:16}}>
        <SRow label="GPU price" value={gpuPriceLakh} setValue={setGpuPriceLakh} min={5} max={50} step={0.5} type="lakh"/>
        <SRow label="Server hardware" value={serverHwLakh} setValue={setServerHwLakh} min={1} max={20} step={0.5} type="lakh"/>
        <SRow label="Electricity rate" value={electricityRate} setValue={setElectricityRate} min={3} max={20} step={0.5} type="elec"/>
        <SRow label="GPU hours / day" value={gpuHoursDay} setValue={setGpuHoursDay} min={1} max={24} step={1} type="hrs"/>
        <SRow label="IT staff cost" value={itStaffCost} setValue={setItStaffCost} min={10000} max={500000} step={5000} type="staff"/>
        <SRow label="Depreciation" value={deprecYears} setValue={setDeprecYears} min={1} max={10} step={1} type="yrs"/>
      </div>

      {/* Key output metrics */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(145px,1fr))",gap:8,marginBottom:12}}>
        {[["Capex (hardware)",fmtL(capex),"var(--accent2)"],["Monthly opex",fmtK(monthlyOpex),"var(--amber)"],["Cost/month (w/ dep.)",fmtL(monthlyTotal),"var(--text)"],["Cost per employee/mo",`₹${Math.round(costPerEmployee).toLocaleString("en-IN")}`,"var(--text2)"],["Cost per request",`₹${costPerRequest.toFixed(2)}`,"var(--green)"],["3-year total",fmtL(threeYearTotal),"var(--red)"]].map(([l,v,c])=>(
          <div key={l} style={{background:"rgba(255,255,255,0.03)",border:"1px solid var(--border2)",borderRadius:9,padding:"10px 12px"}}>
            <div style={{fontSize:9,color:"var(--text3)",textTransform:"uppercase",fontWeight:700,letterSpacing:.4,marginBottom:4,lineHeight:1.3}}>{l}</div>
            <div style={{fontSize:15,fontWeight:800,color:c,fontFamily:"'JetBrains Mono',monospace"}}>{v}</div>
          </div>
        ))}
      </div>

      {/* Formula box */}
      <div style={{background:"rgba(110,80,255,0.06)",borderRadius:9,padding:"10px 13px",border:"1px solid rgba(110,80,255,0.18)",marginBottom:16}}>
        <div style={{fontSize:9,color:"var(--accent2)",fontWeight:700,textTransform:"uppercase",letterSpacing:.5,marginBottom:5}}>Formulas</div>
        <div style={{fontSize:10,color:"var(--text2)",lineHeight:1.85,fontFamily:"'JetBrains Mono',monospace"}}>
          <div><span style={{color:"var(--text3)"}}>Capex</span> = (GPU + Server + 1.5 misc) × ₹1L = ({gpuPriceLakh} + {serverHwLakh} + 1.5) × ₹1L = <span style={{color:"var(--accent2)",fontWeight:700}}>{fmtL(capex)}</span></div>
          <div><span style={{color:"var(--text3)"}}>kWh/month</span> = (TDP_W ÷ 1000) × h/day × 30 = ({actualGpuTdpW} ÷ 1000) × {gpuHoursDay} × 30 = <span style={{color:"var(--amber)",fontWeight:700}}>{kwhPerMonth.toFixed(0)} kWh</span></div>
          <div><span style={{color:"var(--text3)"}}>Electricity/mo</span> = kWh × ₹/kWh = {kwhPerMonth.toFixed(0)} × ₹{electricityRate} = <span style={{color:"var(--amber)",fontWeight:700}}>{fmtK(electricityMonthly)}</span></div>
          <div><span style={{color:"var(--text3)"}}>Monthly dep.</span> = Capex ÷ (dep_years × 12) = {fmtL(capex)} ÷ ({deprecYears} × 12) = <span style={{color:"var(--text)",fontWeight:700}}>{fmtK(monthlyDep)}</span></div>
          <div><span style={{color:"var(--text3)"}}>Req/month</span> = TPS × 3600 × h/day × 30 ÷ avg_tok = {hwTps} × 3600 × {gpuHoursDay} × 30 ÷ {avgTokPerReq} = <span style={{color:"var(--green)",fontWeight:700}}>{Math.round(reqPerMonth).toLocaleString()}</span></div>
          <div><span style={{color:"var(--text3)"}}>Cost/request</span> = monthly_total ÷ req/month = {fmtL(monthlyTotal)} ÷ {Math.round(reqPerMonth).toLocaleString()} = <span style={{color:"var(--green)",fontWeight:700}}>₹{costPerRequest.toFixed(3)}</span></div>
        </div>
      </div>

      {/* Cloud comparison — dynamic, real 2025 pricing */}
      <div style={{marginBottom:16}}>
        <div style={{fontWeight:700,fontSize:12,color:"var(--text)",marginBottom:4}}>vs Cloud Alternatives — monthly at {gpuHoursDay}h/day</div>
        <div style={{fontSize:10,color:"var(--text3)",marginBottom:10}}>Prices: AWS/GCP/Azure on-demand 2025 · E2E Networks India reserved rate · scaled to {gpuHoursDay}h/day × 30 days.</div>

        {/* Table header */}
        <div style={{display:"grid",gridTemplateColumns:"1fr auto auto",gap:"0 10px",padding:"5px 8px",borderBottom:"1px solid var(--border)",marginBottom:4}}>
          {["Provider / Instance","Monthly (INR)","vs On-Prem"].map((h,i)=>(
            <div key={h} style={{fontSize:9,color:"var(--text3)",fontWeight:700,textTransform:"uppercase",letterSpacing:.4,textAlign:i===0?"left":"right"}}>{h}</div>
          ))}
        </div>

        {[
          // [label, usd/hr, tier-color, note]
          {label:"Your On-Prem (above)",monthly:monthlyTotal,color:"var(--green)",note:`${actualGpuTdpW}W build · ${gpuHoursDay}h/day · ₹${electricityRate}/kWh`,isOnprem:true},
          {label:"E2E Networks — A100 80GB (India)",monthly:e2eA100INR,color:"var(--amber)",note:`₹99.78/hr reserved · ${cloudHrs}h`},
          {label:"AWS p4d — A100 80GB SXM (÷8 GPU)",monthly:Math.round(awsA100perHr*cloudHrs*rate),color:"var(--red)",note:`$${awsA100perHr}/hr on-demand · ${cloudHrs}h`},
          {label:"AWS g5 — A10G 24GB",monthly:Math.round(awsA10GperHr*cloudHrs*rate),color:"var(--red)",note:`$${awsA10GperHr}/hr on-demand · ${cloudHrs}h`},
          {label:"AWS p3 — V100 16GB",monthly:Math.round(awsV100perHr*cloudHrs*rate),color:"var(--red)",note:`$${awsV100perHr}/hr on-demand · ${cloudHrs}h`},
          {label:"GCP a2-highgpu — A100 40GB",monthly:Math.round(gcpA100perHr*cloudHrs*rate),color:"#60a5fa",note:`$${gcpA100perHr}/hr on-demand · ${cloudHrs}h`},
          {label:"GCP g2 — L4 24GB",monthly:Math.round(gcpL4perHr*cloudHrs*rate),color:"#60a5fa",note:`$${gcpL4perHr}/hr on-demand · ${cloudHrs}h`},
          {label:"GCP n1 + T4 16GB",monthly:Math.round(gcpT4perHr*cloudHrs*rate),color:"#60a5fa",note:`$${gcpT4perHr}/hr on-demand · ${cloudHrs}h`},
          {label:"Azure NC24ads — A100 80GB",monthly:Math.round(azureA100perHr*cloudHrs*rate),color:"#818cf8",note:`$${azureA100perHr}/hr on-demand · ${cloudHrs}h`},
          {label:"Azure NV6ads — A10 24GB",monthly:Math.round(azureA10perHr*cloudHrs*rate),color:"#818cf8",note:`$${azureA10perHr}/hr on-demand · ${cloudHrs}h`},
          {label:"Azure NC6s_v3 — V100 16GB",monthly:Math.round(azureV100perHr*cloudHrs*rate),color:"#818cf8",note:`$${azureV100perHr}/hr on-demand · ${cloudHrs}h`},
          {label:"Together AI — Llama 3.3 70B API",monthly:Math.round(togetherMonthlyCostINR),color:"var(--accent2)",note:`$${togetherTokPerM}/M tokens · equiv. usage`},
        ].map(({label,monthly,color,note,isOnprem},idx,arr)=>{
          const ratio=monthly/Math.max(monthlyTotal,1);
          const cheaper=!isOnprem&&monthly<monthlyTotal;
          const moreExpensive=!isOnprem&&monthly>monthlyTotal;
          const pctDiff=Math.abs(Math.round((ratio-1)*100));
          return(
            <div key={label} style={{padding:"8px 8px",borderBottom:idx<arr.length-1?"1px solid rgba(255,255,255,0.04)":"none",background:isOnprem?"rgba(0,229,160,0.04)":"transparent",borderRadius:isOnprem?7:0}}>
              <div style={{display:"grid",gridTemplateColumns:"1fr auto auto",gap:"0 10px",alignItems:"center"}}>
                <div>
                  <div style={{fontSize:11,color:isOnprem?"var(--green)":"var(--text)",fontWeight:isOnprem?700:500}}>{label}</div>
                  <div style={{fontSize:9,color:"var(--text3)",marginTop:1}}>{note}</div>
                </div>
                <div style={{textAlign:"right",fontWeight:700,color,fontFamily:"'JetBrains Mono',monospace",fontSize:11,whiteSpace:"nowrap"}}>{fmtINRK(monthly)}</div>
                <div style={{textAlign:"right",minWidth:72}}>
                  {isOnprem
                    ?<span style={{fontSize:10,color:"var(--green)",fontWeight:700,background:"rgba(0,229,160,0.12)",padding:"2px 7px",borderRadius:4}}>Baseline</span>
                    :<span style={{fontSize:10,fontWeight:700,color:cheaper?"var(--green)":moreExpensive?"var(--red)":"var(--text3)",background:cheaper?"rgba(0,229,160,0.1)":moreExpensive?"rgba(255,75,110,0.1)":"transparent",padding:"2px 7px",borderRadius:4}}>
                      {cheaper?`${pctDiff}% cheaper`:moreExpensive?`${pctDiff}% costlier`:"≈ same"}
                    </span>
                  }
                </div>
              </div>
            </div>
          );
        })}

        <div style={{marginTop:10,display:"flex",gap:8,flexWrap:"wrap",fontSize:10,color:"var(--text3)"}}>
          <div style={{padding:"4px 9px",borderRadius:5,background:"rgba(255,75,110,0.1)",border:"1px solid rgba(255,75,110,0.2)"}}>Break-even vs E2E Networks: <strong style={{color:"var(--amber)"}}>{Math.min(breakEvenMonths,240)} months</strong></div>
          <div style={{padding:"4px 9px",borderRadius:5,background:"rgba(22,163,74,0.08)",border:"1px solid rgba(22,163,74,0.2)"}}>No per-token API cost = biggest long-term advantage at scale</div>
        </div>

        <div style={{marginTop:8,padding:"8px 10px",background:"rgba(255,255,255,0.02)",borderRadius:7,border:"1px solid var(--border2)",fontSize:9,color:"var(--text3)",lineHeight:1.6}}>
          Cloud prices: AWS on-demand Q2 2025 · GCP on-demand Q2 2025 · Azure on-demand Q2 2025 · E2E Networks reserved rate ₹99.78/hr · Together AI $0.88/M tokens · Spot/reserved instances 40–70% cheaper. Always verify current rates before budgeting.
        </div>
      </div>

      {/* Per-request cost breakdown */}
      <div>
        <div style={{fontWeight:700,fontSize:12,color:"var(--text)",marginBottom:4}}>Per-request cost breakdown</div>
        <div style={{fontSize:10,color:"var(--text3)",marginBottom:10}}>Avg {avgTokPerReq} tokens/request · {Math.round(reqPerMonth).toLocaleString()} req/month at {hwTps} t/s</div>
        {[["Hardware depreciation",depPct,"#2563EB"],["Electricity",elecPct,"#16A34A"],["IT staff allocation",itPct,"#F59E0B"]].map(([l,p,c])=>(
          <div key={l} style={{marginBottom:10}}>
            <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}>
              <span style={{fontSize:11,color:"var(--text2)"}}>{l}</span>
              <span style={{fontSize:11,fontWeight:700,color:"var(--text2)",fontFamily:"'JetBrains Mono',monospace"}}>{p}%</span>
            </div>
            <div style={{height:8,background:"var(--border)",borderRadius:4,overflow:"hidden"}}>
              <div style={{width:`${Math.min(100,p)}%`,height:"100%",background:c,borderRadius:4,transition:"width .3s"}}/>
            </div>
          </div>
        ))}
        <div style={{fontSize:10,color:"var(--text3)",marginTop:8,padding:"8px 10px",background:"rgba(22,163,74,0.08)",border:"1px solid rgba(22,163,74,0.2)",borderRadius:7}}>
          No per-token API fees — this is your biggest cost advantage over cloud APIs at scale.
        </div>
      </div>
    </div>
  );
}

// ─── SCROLL TO TOP ────────────────────────────────────────────────────────────
function ScrollTop(){
  const [vis,setVis]=useState(false);
  useEffect(()=>{const h=()=>setVis(window.scrollY>400);window.addEventListener("scroll",h,{passive:true});return()=>window.removeEventListener("scroll",h);},[]);
  return(
    <div style={{position:"fixed",bottom:24,right:24,zIndex:999,transition:"all .3s",opacity:vis?1:0,transform:vis?"scale(1)":"scale(.7)",pointerEvents:vis?"auto":"none"}}>
      <button onClick={()=>window.scrollTo({top:0,behavior:"smooth"})} style={{width:44,height:44,borderRadius:"50%",border:"none",background:"linear-gradient(135deg,var(--accent),#3366cc)",color:"#fff",fontSize:18,cursor:"pointer",boxShadow:"0 4px 20px rgba(110,80,255,.5)",display:"flex",alignItems:"center",justifyContent:"center"}}>↑</button>
    </div>
  );
}

// ─── STRESS TEST TOOLS DATA ───────────────────────────────────────────────────
function scoreColor(s){return s>=85?"var(--green)":s>=70?"#84cc16":s>=50?"var(--amber)":"var(--red)";}
function scoreLabel(s){return s>=85?"Excellent":s>=70?"Good":s>=50?"Fair":"Poor";}

// ─── CUSTOM MODEL / HARDWARE HELPERS ─────────────────────────────────────────
function mapPipeline(p){
  return({"text-generation":"LLM","text2text-generation":"LLM","conversational":"LLM","image-to-text":"Vision","visual-question-answering":"Vision","image-classification":"Vision","image-text-to-text":"Vision","text-to-image":"Vision","feature-extraction":"LLM","fill-mask":"LLM","automatic-speech-recognition":"LLM","token-classification":"LLM"}[p])||"LLM";
}

function AddModelModal({open,onClose,onAdd,existing}){
  const [hfId,setHfId]=useState("");
  const [loading,setLoading]=useState(false);
  const [error,setError]=useState(null);
  const [preview,setPreview]=useState(null);

  const handleFetch=async()=>{
    const id=hfId.trim();
    if(!id||!id.includes("/")){setError("Enter a valid model ID like org/model-name");return;}
    if(existing.includes(id)){setError("This model is already in the explorer.");return;}
    setLoading(true);setError(null);setPreview(null);
    try{
      const r=await fetch(`https://huggingface.co/api/models/${id}`);
      if(!r.ok)throw new Error(`HTTP ${r.status} — not found or private`);
      setPreview(await r.json());
    }catch(e){setError(e.message);}
    finally{setLoading(false);}
  };

  const handleAdd=()=>{
    if(!preview)return;
    const id=hfId.trim();
    onAdd({
      id:"cm_"+id.replace(/[^a-z0-9]/gi,"_").toLowerCase(),
      name:preview.id||id,
      family:id.split("/")[0],
      params:0,
      category:mapPipeline(preview.pipeline_tag),
      developer:id.split("/")[0],
      license:preview.cardData?.license||"Unknown",
      released:preview.lastModified?.slice(0,7)||"—",
      contextLen:4096,
      hfUrl:`https://huggingface.co/${id}`,
      arch:null,quants:[],benchmarks:{},stressTests:[],
      _custom:true,_hfId:id,
      _liveDownloads:preview.downloads,
      _liveLikes:preview.likes,
      _liveModified:preview.lastModified,
      _liveTags:preview.tags||[],
      _livePipeline:preview.pipeline_tag,
    });
    setHfId("");setPreview(null);setError(null);onClose();
  };

  if(!open)return null;
  const inp={padding:"9px 12px",borderRadius:9,border:"1px solid var(--border)",background:"var(--surface2)",color:"var(--text)",fontSize:12,outline:"none",fontFamily:"'JetBrains Mono',monospace",width:"100%"};
  return(
    <div onClick={onClose} style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.75)",zIndex:1000,display:"flex",alignItems:"center",justifyContent:"center",backdropFilter:"blur(6px)"}}>
      <div onClick={e=>e.stopPropagation()} style={{background:"var(--surface)",border:"1px solid var(--border3)",borderRadius:18,padding:28,maxWidth:500,width:"92%",boxShadow:"0 40px 80px rgba(0,0,0,0.8)"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
          <div style={{fontWeight:700,fontSize:16,color:"var(--text)"}}>+ Add HuggingFace Model</div>
          <button onClick={onClose} style={{background:"none",border:"none",color:"var(--text3)",fontSize:20,cursor:"pointer",lineHeight:1}}>✕</button>
        </div>
        <div style={{fontSize:12,color:"var(--text2)",marginBottom:14,lineHeight:1.6}}>Fetch live stats for any <strong>public</strong> HuggingFace model. Enter the full model ID (org/name).</div>
        <div style={{display:"flex",gap:8,marginBottom:10}}>
          <input value={hfId} onChange={e=>setHfId(e.target.value)} onKeyDown={e=>e.key==="Enter"&&handleFetch()}
            placeholder="e.g. mistralai/Mistral-7B-Instruct-v0.3" style={{...inp,borderRadius:9}}/>
          <button onClick={handleFetch} disabled={loading}
            style={{padding:"9px 18px",borderRadius:9,border:"none",background:"var(--accent)",color:"#fff",fontSize:12,fontWeight:700,cursor:loading?"not-allowed":"pointer",opacity:loading?0.7:1,fontFamily:"inherit",whiteSpace:"nowrap"}}>
            {loading?"…":"Fetch"}
          </button>
        </div>
        {error&&<div style={{fontSize:11,color:"var(--red)",marginBottom:12,padding:"8px 12px",borderRadius:8,background:"rgba(255,75,110,0.1)"}}>{error}</div>}
        {preview&&(
          <div style={{background:"var(--surface2)",borderRadius:12,padding:"14px 16px",marginBottom:16,border:"1px solid var(--border)"}}>
            <div style={{fontWeight:700,fontSize:13,color:"var(--text)",marginBottom:8,fontFamily:"'JetBrains Mono',monospace"}}>{preview.id}</div>
            <div style={{display:"flex",gap:10,flexWrap:"wrap",fontSize:11,marginBottom:8}}>
              {preview.downloads!=null&&<span style={{color:"var(--green)",fontWeight:700}}>↓ {fmtDL(preview.downloads)}/mo</span>}
              {preview.likes!=null&&<span style={{color:"var(--amber)",fontWeight:700}}>♥ {fmtDL(preview.likes)}</span>}
              {preview.pipeline_tag&&<span style={{color:"var(--accent2)",background:"rgba(110,80,255,0.12)",padding:"1px 7px",borderRadius:5,fontWeight:600}}>🏷 {preview.pipeline_tag}</span>}
              {preview.gated&&<span style={{color:"var(--amber)",background:"rgba(255,183,77,0.1)",padding:"1px 7px",borderRadius:5,fontWeight:600}}>🔒 Gated</span>}
              {preview.lastModified&&<span style={{color:"var(--text3)"}}>🔄 {fmtAge(preview.lastModified)}</span>}
            </div>
            {preview.tags?.length>0&&<div style={{display:"flex",gap:4,flexWrap:"wrap"}}>{preview.tags.slice(0,8).map(t=><span key={t} style={{fontSize:9,padding:"2px 7px",borderRadius:5,background:"rgba(110,80,255,0.08)",color:"var(--accent2)"}}>{t}</span>)}</div>}
          </div>
        )}
        <div style={{display:"flex",gap:8,justifyContent:"flex-end",marginTop:4}}>
          <button onClick={onClose} style={{padding:"9px 16px",borderRadius:9,border:"1px solid var(--border)",background:"none",color:"var(--text2)",fontSize:12,fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}>Cancel</button>
          <button onClick={handleAdd} disabled={!preview}
            style={{padding:"9px 20px",borderRadius:9,border:"none",background:preview?"var(--green)":"var(--surface3)",color:preview?"#000":"var(--text3)",fontSize:12,fontWeight:700,cursor:preview?"pointer":"not-allowed",fontFamily:"inherit",transition:"all .15s"}}>
            Add to Explorer
          </button>
        </div>
      </div>
    </div>
  );
}

function AddHwModal({open,onClose,onAdd}){
  const [form,setForm]=useState({name:"",brand:"NVIDIA",segment:"consumer",vram:"",priceUSD:"",tdp:"",fp16:"",bandwidth:""});
  const set=(k,v)=>setForm(f=>({...f,[k]:v}));

  const handleAdd=()=>{
    if(!form.name.trim()||!form.vram)return;
    onAdd({
      id:"ch_"+form.name.trim().replace(/[^a-z0-9]/gi,"_").toLowerCase()+"_"+Math.floor(Math.random()*9999),
      name:form.name.trim(),shortName:form.name.trim(),
      brand:form.brand,series:"Custom",gen:"Custom",
      segment:form.segment,
      vram:Number(form.vram)||0,vramType:"GDDR6",
      priceUSD:Number(form.priceUSD)||0,
      tdp:Number(form.tdp)||0,
      bandwidth:Number(form.bandwidth)||0,
      fp16:Number(form.fp16)||0,
      fp8:null,int8:null,fp4:null,
      nvlink:false,pcie:"PCIe",released:"Custom",
      rating:5.0,inStock:true,sources:[],notes:"Custom entry",
      useCase:[],tokensPerSec:{},_custom:true,
    });
    setForm({name:"",brand:"NVIDIA",segment:"consumer",vram:"",priceUSD:"",tdp:"",fp16:"",bandwidth:""});
    onClose();
  };

  if(!open)return null;
  const inp={padding:"7px 10px",borderRadius:8,border:"1px solid var(--border)",background:"var(--surface2)",color:"var(--text)",fontSize:12,outline:"none",fontFamily:"inherit",width:"100%"};
  return(
    <div onClick={onClose} style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.75)",zIndex:1000,display:"flex",alignItems:"center",justifyContent:"center",backdropFilter:"blur(6px)"}}>
      <div onClick={e=>e.stopPropagation()} style={{background:"var(--surface)",border:"1px solid var(--border3)",borderRadius:18,padding:28,maxWidth:460,width:"92%",boxShadow:"0 40px 80px rgba(0,0,0,0.8)"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
          <div style={{fontWeight:700,fontSize:16,color:"var(--text)"}}>+ Add Custom Hardware</div>
          <button onClick={onClose} style={{background:"none",border:"none",color:"var(--text3)",fontSize:20,cursor:"pointer",lineHeight:1}}>✕</button>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:16}}>
          <div style={{gridColumn:"1/-1"}}>
            <div style={{fontSize:10,color:"var(--text3)",fontWeight:700,textTransform:"uppercase",letterSpacing:.5,marginBottom:4}}>GPU / Device Name *</div>
            <input value={form.name} onChange={e=>set("name",e.target.value)} placeholder="e.g. RTX 4090 Ti" style={inp}/>
          </div>
          <div>
            <div style={{fontSize:10,color:"var(--text3)",fontWeight:700,textTransform:"uppercase",letterSpacing:.5,marginBottom:4}}>Brand</div>
            <select value={form.brand} onChange={e=>set("brand",e.target.value)} style={inp}>
              <option>NVIDIA</option><option>AMD</option><option>Intel</option><option>Apple</option><option>Other</option>
            </select>
          </div>
          <div>
            <div style={{fontSize:10,color:"var(--text3)",fontWeight:700,textTransform:"uppercase",letterSpacing:.5,marginBottom:4}}>Segment</div>
            <select value={form.segment} onChange={e=>set("segment",e.target.value)} style={inp}>
              <option value="consumer">Consumer</option>
              <option value="workstation">Workstation</option>
              <option value="datacenter">Data Center</option>
              <option value="edge">Edge</option>
            </select>
          </div>
          <div>
            <div style={{fontSize:10,color:"var(--text3)",fontWeight:700,textTransform:"uppercase",letterSpacing:.5,marginBottom:4}}>VRAM (GB) *</div>
            <input type="number" value={form.vram} onChange={e=>set("vram",e.target.value)} placeholder="24" style={inp}/>
          </div>
          <div>
            <div style={{fontSize:10,color:"var(--text3)",fontWeight:700,textTransform:"uppercase",letterSpacing:.5,marginBottom:4}}>Price USD</div>
            <input type="number" value={form.priceUSD} onChange={e=>set("priceUSD",e.target.value)} placeholder="1599" style={inp}/>
          </div>
          <div>
            <div style={{fontSize:10,color:"var(--text3)",fontWeight:700,textTransform:"uppercase",letterSpacing:.5,marginBottom:4}}>TDP (W)</div>
            <input type="number" value={form.tdp} onChange={e=>set("tdp",e.target.value)} placeholder="450" style={inp}/>
          </div>
          <div>
            <div style={{fontSize:10,color:"var(--text3)",fontWeight:700,textTransform:"uppercase",letterSpacing:.5,marginBottom:4}}>FP16 TFLOPS</div>
            <input type="number" value={form.fp16} onChange={e=>set("fp16",e.target.value)} placeholder="82.6" style={inp}/>
          </div>
          <div>
            <div style={{fontSize:10,color:"var(--text3)",fontWeight:700,textTransform:"uppercase",letterSpacing:.5,marginBottom:4}}>Bandwidth GB/s</div>
            <input type="number" value={form.bandwidth} onChange={e=>set("bandwidth",e.target.value)} placeholder="1008" style={inp}/>
          </div>
        </div>
        <div style={{display:"flex",gap:8,justifyContent:"flex-end"}}>
          <button onClick={onClose} style={{padding:"9px 16px",borderRadius:9,border:"1px solid var(--border)",background:"none",color:"var(--text2)",fontSize:12,fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}>Cancel</button>
          <button onClick={handleAdd} disabled={!form.name||!form.vram}
            style={{padding:"9px 20px",borderRadius:9,border:"none",background:(form.name&&form.vram)?"var(--accent)":"var(--surface3)",color:(form.name&&form.vram)?"#fff":"var(--text3)",fontSize:12,fontWeight:700,cursor:(form.name&&form.vram)?"pointer":"not-allowed",fontFamily:"inherit",transition:"all .15s"}}>
            Add to Explorer
          </button>
        </div>
      </div>
    </div>
  );
}

const STRESS_TOOLS=[
  {
    badge:"Best overall",badgeBg:"rgba(34,197,94,0.15)",badgeColor:"#22c55e",
    name:"Locust",subtitle:"Python-based load tester",
    desc:"Write test scenarios in plain Python. Simulates real users hitting your vLLM OpenAI-compatible API. Best for your use case.",
    specs:[
      ["What it tests","Concurrent users, ramp-up, sustained load"],
      ["Output","Live dashboard: req/s, latency P50/P95/P99, failures"],
      ["Setup effort","Low — 20 lines of Python"],
      ["Best for","Showing the ramp-up curve to failure"],
    ],
    tags:["pip install locust","Web UI included","OpenAI API compatible"],
    install:"pip install locust",
    cmd:null,
    link:"https://locust.io",
  },
  {
    badge:"Purpose-built for LLMs",badgeBg:"rgba(96,165,250,0.15)",badgeColor:"#60a5fa",
    name:"llmperf",subtitle:"LLM-specific benchmark tool",
    desc:"Built by Anyscale specifically for LLM inference benchmarking. Measures TTFT, inter-token latency, and throughput natively.",
    specs:[
      ["What it measures","TTFT, tokens/sec, p50/p95/p99 per metric"],
      ["Works with","vLLM, OpenAI, any OpenAI-compatible endpoint"],
      ["Output","JSON report with all LLM-specific metrics"],
      ["Best for","Precise benchmarking for mentor report"],
    ],
    tags:["github: ray-project/llmperf","TTFT native","CSV export"],
    install:"pip install llmperf",
    cmd:null,
    link:"https://github.com/ray-project/llmperf",
  },
  {
    badge:"Built into vLLM",badgeBg:"rgba(167,139,250,0.15)",badgeColor:"#a78bfa",
    name:"vLLM benchmark_serving.py",subtitle:"Ships with vLLM. No extra install.",
    desc:"Runs concurrent requests against your server and prints a full report. Zero setup if you already have vLLM.",
    specs:[
      ["Command","python benchmark_serving.py --num-prompts 200 --request-rate 10"],
      ["Output","Throughput, avg TTFT, P99 latency"],
      ["Best for","Quick first pass before full stress test"],
    ],
    tags:["Zero setup","Built-in datasets","Request rate control"],
    install:null,
    cmd:"python benchmark_serving.py --num-prompts 200 --request-rate 10",
    link:"https://github.com/vllm-project/vllm",
  },
  {
    badge:"Monitoring (run always)",badgeBg:"rgba(251,146,60,0.15)",badgeColor:"#fb923c",
    name:"Prometheus + Grafana + nvidia-smi",subtitle:"Real-time GPU monitoring stack",
    desc:"While Locust hammers the API, these tools show what's happening inside the GPU in real time.",
    specs:[
      ["nvidia-smi dmon","GPU utilization, VRAM usage, temperature every second"],
      ["vLLM /metrics endpoint","Queue depth, running requests, KV cache usage"],
      ["Grafana dashboard","Visual timeline of all metrics — great for demo"],
    ],
    tags:["Free & open source","vLLM native metrics","Live dashboard"],
    install:null,
    cmd:"nvidia-smi dmon -s u",
    link:"https://grafana.com",
  },
];

// ─── TABS ─────────────────────────────────────────────────────────────────────
const TABS=[
  {id:"hardware",label:"🖥 Hardware"},
  {id:"models",label:"🤖 Models"},
  {id:"build",label:"🛠 Build"},
  {id:"compare",label:"⚖ Compare"},
  {id:"tools",label:"🧮 Tools"},
  {id:"stress",label:"🔥 Stress Test"},
  {id:"sources",label:"📚 Sources"},
  {id:"guide",label:"📖 Guide"},
];

// ─── MAIN APP ─────────────────────────────────────────────────────────────────
export default function App(){
  const [dark,setDark]=useState(()=>{
    try{const s=localStorage.getItem("localai-theme");return s?s==="dark":true;}
    catch(e){return true;}
  });
  const toggleDark=useCallback(()=>{
    setDark(d=>{
      try{localStorage.setItem("localai-theme",d?"light":"dark");}catch(e){}
      return !d;
    });
  },[]);

  // ── Live USD→INR exchange rate from Frankfurter API ──
  const [rateInfo,setRateInfo]=useState({rate:USD_TO_INR,date:null,loading:true,error:false});
  useEffect(()=>{
    const controller=new AbortController();
    const tid=setTimeout(()=>controller.abort(),6000);
    fetch("https://api.frankfurter.dev/v1/latest?base=USD&symbols=INR",{signal:controller.signal})
      .then(r=>{if(!r.ok)throw new Error(`HTTP ${r.status}`);return r.json();})
      .then(d=>{
        const rate=d?.rates?.INR;
        // Sanity-check: USD/INR has been 70–130 since 2010; reject implausible values
        if(typeof rate==="number"&&rate>50&&rate<200){
          _liveRate=rate;
          setRateInfo({rate,date:d.date||null,loading:false,error:false});
        } else {
          setRateInfo({rate:USD_TO_INR,date:null,loading:false,error:true});
        }
      })
      .catch(e=>{if(e?.name!=="AbortError")setRateInfo({rate:USD_TO_INR,date:null,loading:false,error:true});})
      .finally(()=>clearTimeout(tid));
    return()=>controller.abort();
  },[]);

  const [tab,setTab]=useState("hardware");
  const [selectedMap,setSelectedMap]=useState({});
  const [comparingHw,setComparingHw]=useState([]);
  const [compareA,setCompareA]=useState(null);
  const [compareB,setCompareB]=useState(null);
  const [selectedModel,setSelectedModel]=useState(null);

  // Custom user-added models & hardware (persisted in localStorage)
  const [customModels,setCustomModels]=useState(()=>{try{return JSON.parse(localStorage.getItem("localai_custom_models")||"[]");}catch{return[];}});
  const [customHardware,setCustomHardware]=useState(()=>{try{return JSON.parse(localStorage.getItem("localai_custom_hardware")||"[]");}catch{return[];}});
  const [addModelOpen,setAddModelOpen]=useState(false);
  const [addHwOpen,setAddHwOpen]=useState(false);
  const saveCustomModels=useCallback(models=>{setCustomModels(models);try{localStorage.setItem("localai_custom_models",JSON.stringify(models));}catch{};},[]);
  const saveCustomHardware=useCallback(hw=>{setCustomHardware(hw);try{localStorage.setItem("localai_custom_hardware",JSON.stringify(hw));}catch{};},[]);
  const addCustomModel=useCallback(m=>saveCustomModels([...customModels,m]),[customModels,saveCustomModels]);
  const removeCustomModel=useCallback(id=>saveCustomModels(customModels.filter(m=>m.id!==id)),[customModels,saveCustomModels]);
  const addCustomHardware=useCallback(h=>saveCustomHardware([...customHardware,h]),[customHardware,saveCustomHardware]);
  const removeCustomHardware=useCallback(id=>saveCustomHardware(customHardware.filter(h=>h.id!==id)),[customHardware,saveCustomHardware]);

  // HW filters
  const [brandFilter,setBrandFilter]=useState("All");
  const [segFilter,setSegFilter]=useState("All");
  const [maxPrice,setMaxPrice]=useState(300000);
  const [priceCurrency,setPriceCurrency]=useState("USD");
  const [sortBy,setSortBy]=useState("rating");
  const [search,setSearch]=useState("");
  const [minVram,setMinVram]=useState(0);

  // Model filters
  const [modelSearch,setModelSearch]=useState("");
  const [modelCat,setModelCat]=useState("All");

  const handleSelect=useCallback(hw=>{
    setSelectedMap(m=>{
      const n={...m};
      if(n[hw.id])delete n[hw.id]; else n[hw.id]=1;
      return n;
    });
  },[]);
  const handleQty=useCallback((id,qty)=>{
    setSelectedMap(m=>({...m,[id]:qty}));
  },[]);
  const toggleComp=useCallback(id=>{
    setComparingHw(p=>p.includes(id)?p.filter(x=>x!==id):[...p,id]);
  },[]);

  const totalVram=useMemo(()=>Object.entries(selectedMap).reduce((a,[id,qty])=>{const h=ALL_HW.find(x=>x.id===id);return a+(h?h.vram*qty:0);},0),[selectedMap]);
  const buildCount=Object.keys(selectedMap).length;

  const filteredHw=useMemo(()=>{
    let arr=[...ALL_HW,...customHardware].filter(h=>{
      if(brandFilter!=="All"&&h.brand!==brandFilter)return false;
      if(segFilter!=="All"&&h.segment!==segFilter)return false;
      if(h.priceUSD>maxPrice)return false;
      if(h.vram<minVram)return false;
      if(search){const q=search.toLowerCase();if(![h.name,h.shortName,h.brand,h.gen,h.vramType,h.series].some(x=>x?.toLowerCase().includes(q)))return false;}
      return true;
    });
    const sortMap={rating:(a,b)=>b.rating-a.rating,vram:(a,b)=>b.vram-a.vram,bandwidth:(a,b)=>b.bandwidth-a.bandwidth,fp16:(a,b)=>b.fp16-a.fp16,price_asc:(a,b)=>a.priceUSD-b.priceUSD,price_desc:(a,b)=>b.priceUSD-a.priceUSD};
    return arr.sort(sortMap[sortBy]||sortMap.rating);
  },[brandFilter,segFilter,maxPrice,minVram,search,sortBy,customHardware]);

  const filteredModels=useMemo(()=>{
    let arr=[...MODELS,...customModels];
    if(modelCat!=="All")arr=arr.filter(m=>m.category===modelCat);
    if(modelSearch){const q=modelSearch.toLowerCase();arr=arr.filter(m=>[m.name,m.family,m.developer,m.category].some(x=>x?.toLowerCase().includes(q)));}
    return arr;
  },[modelCat,modelSearch,customModels]);

  const tabBadge={build:buildCount>0?buildCount:null,compare:comparingHw.length>0?comparingHw.length:null};

  return(
    <>
      <StyleInject dark={dark}/>

      {/* ── HERO ── */}
      <div style={{position:"relative",overflow:"hidden",background:"var(--bg2)",borderBottom:"1px solid var(--border)",padding:"40px 24px 36px",transition:"background .4s"}}>
        <NeuralBg dark={dark}/>
        <div style={{position:"relative",zIndex:1,maxWidth:1400,margin:"0 auto"}}>
          <div style={{display:"flex",gap:6,alignItems:"center",marginBottom:16,flexWrap:"wrap"}}>
            {/* Logo icon */}
            <div style={{width:36,height:36,borderRadius:10,background:"linear-gradient(135deg,var(--accent),#4488ff)",display:"flex",alignItems:"center",justifyContent:"center",boxShadow:"0 0 20px rgba(110,80,255,.4)",flexShrink:0}}><span style={{fontSize:18}}>⚡</span></div>

            {/* Glitch + Gradient title */}
            <div style={{fontWeight:800,fontSize:22,letterSpacing:-.5,lineHeight:1}}>
              <span className="glitch-wrap gradient-title" data-text="LocalAIDeploy">LocalAIDeploy</span>
              {" "}<span style={{color:"var(--text3)",fontWeight:400,fontSize:11,verticalAlign:"middle",WebkitTextFillColor:"var(--text3)"}}>v3.0</span>
            </div>

            {/* Right: theme toggle + brand chips */}
            <div style={{marginLeft:"auto",display:"flex",gap:6,flexWrap:"wrap",alignItems:"center"}}>
              {/* Dark / Light mode toggle */}
              <button
                onClick={toggleDark}
                title={dark?"Switch to Light Mode":"Switch to Dark Mode"}
                style={{
                  display:"flex",alignItems:"center",gap:5,
                  padding:"5px 12px",borderRadius:20,
                  border:`1px solid ${dark?"rgba(110,80,255,0.4)":"rgba(192,112,0,0.4)"}`,
                  background:dark?"rgba(110,80,255,0.12)":"rgba(255,184,48,0.14)",
                  color:dark?"var(--accent2)":"var(--amber)",
                  fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:"inherit",
                  transition:"all .3s",whiteSpace:"nowrap",
                  boxShadow:dark?"0 0 12px rgba(110,80,255,0.2)":"0 0 12px rgba(255,184,48,0.2)"
                }}
              >
                <span style={{fontSize:13}}>{dark?"☀️":"🌙"}</span>
                {dark?"Light Mode":"Dark Mode"}
              </button>
              {[["var(--nvidia)","NVIDIA"],["var(--amd)","AMD"],["var(--intel)","Intel"],["var(--apple)","Apple"]].map(([c,l])=>(
                <span key={l} style={{fontSize:10,padding:"3px 9px",borderRadius:20,border:`1px solid ${c}44`,color:c,background:`${c}11`,fontWeight:700}}>{l}</span>
              ))}
            </div>
          </div>

          <div style={{fontSize:14,color:"var(--text2)",maxWidth:520,lineHeight:1.7,marginBottom:20}}>
            Compare every GPU, TPU &amp; NPU for local AI deployment. Live hardware data, model benchmarks across all quantization formats, KV-cache analysis, and cost-aware build planning.
          </div>

          {/* Animated hero stats */}
          <div style={{display:"flex",gap:16,flexWrap:"wrap",alignItems:"flex-end"}}>
            {[
              {v:ALL_HW.length+customHardware.length,l:"Devices",c:"var(--accent2)"},
              {v:MODELS.length+customModels.length,l:"Models",c:"var(--green)"},
              {v:MODELS.reduce((a,m)=>a+m.quants.length,0),l:"Quantizations",c:"var(--amber)"},
            ].map(({v,l,c})=>(
              <div key={l} style={{textAlign:"center"}}>
                <div style={{fontSize:20,fontWeight:800,color:c,fontFamily:"'JetBrains Mono', monospace"}}>
                  <AnimatedCounter to={v}/>
                </div>
                <div style={{fontSize:10,color:"var(--text3)",fontWeight:600,textTransform:"uppercase",letterSpacing:.5}}>{l}</div>
              </div>
            ))}

            {/* Live exchange rate stat */}
            <div style={{textAlign:"center"}}>
              <div style={{fontSize:20,fontWeight:800,color:"var(--text2)",fontFamily:"'JetBrains Mono', monospace"}}>
                {rateInfo.loading?"…":`₹${rateInfo.rate.toFixed(2)}`}
              </div>
              <div style={{display:"flex",alignItems:"center",gap:4,justifyContent:"center"}}>
                <div style={{fontSize:10,color:"var(--text3)",fontWeight:600,textTransform:"uppercase",letterSpacing:.5}}>per USD</div>
                {!rateInfo.loading&&!rateInfo.error&&(
                  <span style={{fontSize:8,padding:"1px 5px",borderRadius:8,background:"rgba(0,229,160,0.15)",color:"var(--green)",fontWeight:700,letterSpacing:.3}}>LIVE</span>
                )}
                {rateInfo.error&&(
                  <span style={{fontSize:8,padding:"1px 5px",borderRadius:8,background:"rgba(255,184,48,0.15)",color:"var(--amber)",fontWeight:700}}>EST</span>
                )}
              </div>
            </div>

            {buildCount>0&&<div style={{textAlign:"center"}}>
              <div style={{fontSize:20,fontWeight:800,color:"var(--accent2)",fontFamily:"'JetBrains Mono', monospace"}}>{fmtVram(totalVram)}</div>
              <div style={{fontSize:10,color:"var(--text3)",fontWeight:600,textTransform:"uppercase",letterSpacing:.5}}>Build VRAM</div>
            </div>}
          </div>
        </div>
      </div>

      {/* ── TABS ── */}
      <div style={{background:"var(--bg2)",borderBottom:"1px solid var(--border)",position:"sticky",top:0,zIndex:20}}>
        <div style={{maxWidth:1400,margin:"0 auto",padding:"0 20px",display:"flex",gap:0,overflowX:"auto"}}>
          {TABS.map(t=>{
            const badge=tabBadge[t.id];
            return(
              <button key={t.id} onClick={()=>setTab(t.id)} style={{padding:"13px 16px",border:"none",background:"transparent",color:tab===t.id?"var(--accent2)":"var(--text2)",fontWeight:tab===t.id?700:500,fontSize:12,cursor:"pointer",borderBottom:`2px solid ${tab===t.id?"var(--accent)":"transparent"}`,transition:"all .15s",whiteSpace:"nowrap",fontFamily:"inherit",position:"relative"}}>
                {t.label}
                {badge&&<span style={{position:"absolute",top:6,right:4,minWidth:16,height:16,borderRadius:8,background:"var(--accent)",color:"#fff",fontSize:9,fontWeight:700,display:"flex",alignItems:"center",justifyContent:"center",padding:"0 3px"}}>{badge}</span>}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── CONTENT ── */}
      <div style={{maxWidth:1400,margin:"0 auto",padding:"24px 20px"}}>

        {/* ── HARDWARE TAB ── */}
        {tab==="hardware"&&(
          <div className="fade-up">
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",flexWrap:"wrap",gap:12,marginBottom:20}}>
              <div>
                <div style={{fontWeight:700,fontSize:20,color:"var(--text)"}}>Hardware Explorer</div>
                <div style={{fontSize:12,color:"var(--text2)",marginTop:2}}>
                  Showing <strong style={{color:"var(--accent2)"}}>{filteredHw.length}</strong> of {ALL_HW.length+customHardware.length} devices · Prices MSRP Jun 2026
                </div>
              </div>
              <div style={{display:"flex",gap:8,flexWrap:"wrap",alignItems:"center"}}>
                <button onClick={()=>setAddHwOpen(true)} style={{padding:"7px 14px",borderRadius:9,border:"1px solid var(--accent)",background:"rgba(110,80,255,0.1)",color:"var(--accent2)",fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:"inherit",transition:"all .15s",whiteSpace:"nowrap"}} onMouseEnter={e=>e.currentTarget.style.background="rgba(110,80,255,0.2)"} onMouseLeave={e=>e.currentTarget.style.background="rgba(110,80,255,0.1)"}>
                  + Add Hardware
                </button>
                {buildCount>0&&(
                <button onClick={()=>setSelectedMap({})} style={{padding:"7px 13px",borderRadius:9,border:"1px solid var(--red)",background:"rgba(255,75,110,0.1)",color:"var(--red)",fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:"inherit",transition:"all .15s",whiteSpace:"nowrap"}} onMouseEnter={e=>e.currentTarget.style.background="rgba(255,75,110,0.2)"} onMouseLeave={e=>e.currentTarget.style.background="rgba(255,75,110,0.1)"}>
                  🗑 Clear {buildCount} Selected
                </button>
              )}
              <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search…" style={{padding:"7px 12px",borderRadius:9,border:"1px solid var(--border)",background:"var(--surface2)",color:"var(--text)",fontSize:12,outline:"none",fontFamily:"inherit",width:160,transition:"border .15s"}} onFocus={e=>e.target.style.borderColor="var(--accent)"} onBlur={e=>e.target.style.borderColor="var(--border)"}/>
                <select value={sortBy} onChange={e=>setSortBy(e.target.value)}>
                  <option value="rating">AI Rating ↓</option>
                  <option value="vram">VRAM ↓</option>
                  <option value="bandwidth">Bandwidth ↓</option>
                  <option value="fp16">FP16 ↓</option>
                  <option value="price_asc">Price ↑</option>
                  <option value="price_desc">Price ↓</option>
                </select>
              </div>
            </div>

            {/* Filters */}
            <div style={{display:"flex",gap:16,flexWrap:"wrap",marginBottom:20}}>
              <div>
                <div style={{fontSize:10,color:"var(--text3)",fontWeight:700,textTransform:"uppercase",letterSpacing:.5,marginBottom:7}}>Brand</div>
                <div style={{display:"flex",gap:4,flexWrap:"wrap"}}>
                  {BRANDS.map(b=>(
                    <Chip key={b} active={brandFilter===b} onClick={()=>setBrandFilter(b)} color={b==="NVIDIA"?"#76b900":b==="AMD"?"#ed1c24":b==="Intel"?"#0071c5":b==="Apple"?"#aaa":"var(--accent)"}>
                      {b==="All"?"All Brands":b}
                    </Chip>
                  ))}
                </div>
              </div>
              <div>
                <div style={{fontSize:10,color:"var(--text3)",fontWeight:700,textTransform:"uppercase",letterSpacing:.5,marginBottom:7}}>Segment</div>
                <div style={{display:"flex",gap:4,flexWrap:"wrap"}}>
                  {SEGMENTS.map(s=>(
                    <Chip key={s} active={segFilter===s} onClick={()=>setSegFilter(s)}>
                      {s==="All"?"All":SEG_LABEL[s]||s}
                    </Chip>
                  ))}
                </div>
              </div>
              <div style={{minWidth:220}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:7}}>
                  <div style={{fontSize:10,color:"var(--text3)",fontWeight:700,textTransform:"uppercase",letterSpacing:.5}}>Max Price</div>
                  <div style={{display:"flex",background:"var(--surface3)",borderRadius:6,padding:2}}>
                    {["USD","INR"].map(c=>(
                      <button key={c} onClick={()=>setPriceCurrency(c)} style={{padding:"2px 8px",borderRadius:5,border:"none",background:priceCurrency===c?"var(--accent)":"transparent",color:priceCurrency===c?"#fff":"var(--text3)",fontSize:9,fontWeight:700,cursor:"pointer",fontFamily:"inherit",transition:"all .12s"}}>
                        {c==="INR"?"₹ INR":"$ USD"}
                      </button>
                    ))}
                  </div>
                </div>
                <div style={{display:"flex",alignItems:"center",gap:6}}>
                  {priceCurrency==="INR" ? (
                    <input type="range" min={8000} max={25000000} step={10000}
                      value={Math.round(maxPrice*(_liveRate||83.5))}
                      onChange={e=>setMaxPrice(Math.round(Number(e.target.value)/(_liveRate||83.5)))}
                      style={{flex:1}}/>
                  ) : (
                    <input type="range" min={100} max={300000} step={100}
                      value={maxPrice}
                      onChange={e=>setMaxPrice(Number(e.target.value))}
                      style={{flex:1}}/>
                  )}
                  {priceCurrency==="INR" ? (
                    <input type="number" min={8000} max={25000000} step={10000}
                      value={Math.round(maxPrice*(_liveRate||83.5))}
                      onChange={e=>{const inr=Math.max(8000,Math.min(25000000,Number(e.target.value)||8000));setMaxPrice(Math.round(inr/(_liveRate||83.5)));}}
                      style={{width:88,padding:"4px 6px",borderRadius:7,border:"1px solid var(--border)",background:"var(--surface2)",color:"var(--accent2)",fontSize:11,fontFamily:"'JetBrains Mono', monospace",fontWeight:700,outline:"none",textAlign:"right"}}
                      onFocus={e=>e.target.style.borderColor="var(--accent)"}
                      onBlur={e=>e.target.style.borderColor="var(--border)"}/>
                  ) : (
                    <input type="number" min={100} max={300000} step={100}
                      value={maxPrice}
                      onChange={e=>{const v=Math.max(100,Math.min(300000,Number(e.target.value)||100));setMaxPrice(v);}}
                      style={{width:80,padding:"4px 6px",borderRadius:7,border:"1px solid var(--border)",background:"var(--surface2)",color:"var(--accent2)",fontSize:11,fontFamily:"'JetBrains Mono', monospace",fontWeight:700,outline:"none",textAlign:"right"}}
                      onFocus={e=>e.target.style.borderColor="var(--accent)"}
                      onBlur={e=>e.target.style.borderColor="var(--border)"}/>
                  )}
                  <span style={{fontSize:10,color:"var(--text3)",whiteSpace:"nowrap"}}>{priceCurrency==="INR"?"₹":"$"}</span>
                </div>
              </div>
              <div style={{minWidth:200}}>
                <div style={{fontSize:10,color:"var(--text3)",fontWeight:700,textTransform:"uppercase",letterSpacing:.5,marginBottom:7}}>Min VRAM</div>
                <div style={{display:"flex",alignItems:"center",gap:6}}>
                  <input type="range" min={0} max={384} step={4} value={minVram} onChange={e=>setMinVram(Number(e.target.value))} style={{flex:1}}/>
                  <input type="number" min={0} max={384} step={1} value={minVram} onChange={e=>{const v=Math.max(0,Math.min(384,Number(e.target.value)||0));setMinVram(v);}} style={{width:64,padding:"4px 6px",borderRadius:7,border:"1px solid var(--border)",background:"var(--surface2)",color:"var(--accent2)",fontSize:11,fontFamily:"'JetBrains Mono', monospace",fontWeight:700,outline:"none",textAlign:"right"}} onFocus={e=>e.target.style.borderColor="var(--accent)"} onBlur={e=>e.target.style.borderColor="var(--border)"}/>
                  <span style={{fontSize:10,color:"var(--text3)"}}>GB</span>
                </div>
              </div>
            </div>

            {filteredHw.length===0?<div style={{textAlign:"center",padding:"4rem",color:"var(--text3)"}}>No hardware matches your filters.</div>:
              brandFilter==="All" ? (
                ["NVIDIA","AMD","Intel","Apple"].map(brand=>{
                  const brandHw=filteredHw.filter(h=>h.brand===brand);
                  if(!brandHw.length)return null;
                  const bc=BRAND_COLOR[brand];
                  const brandIcon={NVIDIA:"◈",AMD:"◆",Intel:"◉",Apple:"◍"}[brand]||"●";
                  const brandDesc={NVIDIA:"CUDA ecosystem · DLSS · TensorRT · Triton",AMD:"ROCm ecosystem · HIP · MIOpen",Intel:"oneAPI · OpenVINO · IPEX-LLM",Apple:"MLX · Metal · Unified Memory"}[brand]||"";
                  return(
                    <div key={brand} style={{marginBottom:28}}>
                      <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:14,padding:"12px 16px",borderRadius:12,background:`linear-gradient(135deg,${bc}18,${bc}08)`,border:`1px solid ${bc}44`,borderLeft:`5px solid ${bc}`,position:"relative",overflow:"hidden"}}>
                        <div style={{width:42,height:42,borderRadius:10,background:`linear-gradient(135deg,${bc}33,${bc}11)`,border:`1px solid ${bc}55`,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,boxShadow:`0 0 20px ${bc}44`}}>
                          <span style={{fontSize:22,color:bc,fontWeight:900}}>{brandIcon}</span>
                        </div>
                        <div style={{flex:1}}>
                          <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:2}}>
                            <span style={{fontSize:20,fontWeight:900,color:bc,letterSpacing:-0.5,fontFamily:"'Space Grotesk',sans-serif"}}>{brand}</span>
                            <span style={{fontSize:10,background:`${bc}22`,color:bc,padding:"2px 9px",borderRadius:20,fontWeight:700,letterSpacing:.5}}>{brandHw.length} DEVICE{brandHw.length!==1?"S":""}</span>
                          </div>
                          <div style={{fontSize:10,color:"var(--text3)",letterSpacing:.2}}>{brandDesc}</div>
                        </div>
                        <div style={{position:"absolute",right:-20,top:-20,width:120,height:120,borderRadius:"50%",background:`radial-gradient(${bc}12,transparent 70%)`,pointerEvents:"none"}}/>
                      </div>
                      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(285px,1fr))",gap:14}}>
                        {brandHw.map(hw=>(
                          <HwCard key={hw.id} hw={hw} qty={selectedMap[hw.id]||1} selected={!!selectedMap[hw.id]} comparing={comparingHw.includes(hw.id)}
                            onSelect={handleSelect} onQty={handleQty} onCompare={toggleComp}/>
                        ))}
                      </div>
                    </div>
                  );
                })
              ):(
                <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(285px,1fr))",gap:14}}>
                  {filteredHw.map(hw=>(
                    <div key={hw.id} style={{position:"relative"}}>
                      <HwCard hw={hw} qty={selectedMap[hw.id]||1} selected={!!selectedMap[hw.id]} comparing={comparingHw.includes(hw.id)}
                        onSelect={handleSelect} onQty={handleQty} onCompare={toggleComp}/>
                      {hw._custom&&(
                        <button onClick={()=>removeCustomHardware(hw.id)} title="Remove custom hardware"
                          style={{position:"absolute",top:8,right:8,background:"rgba(255,75,110,0.15)",border:"1px solid var(--red)",color:"var(--red)",borderRadius:6,padding:"2px 7px",fontSize:10,fontWeight:700,cursor:"pointer",fontFamily:"inherit",zIndex:2}}>
                          ✕ Remove
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )
            }
          </div>
        )}

        {/* ── MODELS TAB ── */}
        {tab==="models"&&(
          <div className="fade-up">
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:12,marginBottom:20}}>
              <div>
                <div style={{fontWeight:700,fontSize:20,color:"var(--text)"}}>Model Explorer</div>
                <div style={{fontSize:12,color:"var(--text2)",marginTop:2}}>
                  {totalVram>0?<>Build: <strong style={{color:"var(--accent2)",fontFamily:"'JetBrains Mono', monospace"}}>{fmtVram(totalVram)}</strong> VRAM — green = runnable on your build</>:"Select hardware to see compatible quantizations"}
                </div>
              </div>
              <div style={{display:"flex",gap:8,flexWrap:"wrap",alignItems:"center"}}>
                <input value={modelSearch} onChange={e=>setModelSearch(e.target.value)} placeholder="Search models…" style={{padding:"7px 12px",borderRadius:9,border:"1px solid var(--border)",background:"var(--surface2)",color:"var(--text)",fontSize:12,outline:"none",fontFamily:"inherit",width:170}}/>
                <select value={modelCat} onChange={e=>setModelCat(e.target.value)}>
                  <option value="All">All Categories</option>
                  <option value="LLM">LLM</option>
                  <option value="Reasoning">Reasoning</option>
                  <option value="Code">Code</option>
                  <option value="Vision">Vision</option>
                </select>
                <button onClick={()=>setAddModelOpen(true)} style={{padding:"7px 14px",borderRadius:9,border:"1px solid var(--green)",background:"rgba(0,229,160,0.08)",color:"var(--green)",fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:"inherit",transition:"all .15s",whiteSpace:"nowrap"}} onMouseEnter={e=>e.currentTarget.style.background="rgba(0,229,160,0.18)"} onMouseLeave={e=>e.currentTarget.style.background="rgba(0,229,160,0.08)"}>
                  + Add Model
                </button>
              </div>
            </div>

            {/* Side-by-side compare if both selected */}
            {compareA&&compareB&&(
              <div style={{background:"var(--surface)",border:"1px solid var(--border)",borderRadius:14,padding:"16px 18px",marginBottom:20}}>
                <div style={{fontWeight:700,fontSize:13,color:"var(--text)",marginBottom:12}}>
                  ⚖ Model Comparison: <span style={{color:"var(--accent2)"}}>{compareA.name}</span> vs <span style={{color:"var(--green)"}}>{compareB.name}</span>
                </div>
                <ModelCompare a={compareA} b={compareB}/>
              </div>
            )}

            <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(340px,1fr))",gap:14}}>
              {filteredModels.map(m=>(
                <ModelCard key={m.id} model={m} totalVram={totalVram} selectedModel={selectedModel}
                  onSelect={setSelectedModel} compareA={compareA} compareB={compareB}
                  onCompareA={setCompareA} onCompareB={setCompareB}
                  onRemove={m._custom?()=>removeCustomModel(m.id):null}/>
              ))}
            </div>
          </div>
        )}

        {/* ── BUILD TAB ── */}
        {tab==="build"&&(
          <div className="fade-up">
            <div style={{display:"grid",gridTemplateColumns:"1fr 380px",gap:20,alignItems:"start"}}>
              <BuildPanel selectedMap={selectedMap} onQty={handleQty} onClear={()=>setSelectedMap({})}/>
              <div style={{display:"grid",gap:16}}>
                <VramCalc selectedMap={selectedMap}/>
                <KVCacheCalc model={selectedModel} buildVram={totalVram}/>
              </div>
            </div>
          </div>
        )}

        {/* ── COMPARE TAB ── */}
        {tab==="compare"&&(
          <div className="fade-up">
            <div style={{fontWeight:700,fontSize:20,color:"var(--text)",marginBottom:4}}>Hardware Comparison</div>
            <div style={{fontSize:12,color:"var(--text2)",marginBottom:16}}>
              {comparingHw.length===0?"Add hardware to compare using the + Comp button on any card.":`Comparing ${comparingHw.length} device${comparingHw.length>1?"s":""}`}
            </div>
            {comparingHw.length>0&&(
              <div style={{display:"flex",gap:5,flexWrap:"wrap",marginBottom:16}}>
                {comparingHw.map(id=>{const h=ALL_HW.find(x=>x.id===id);return h?(
                  <div key={id} style={{display:"flex",alignItems:"center",gap:5,padding:"4px 10px",borderRadius:8,background:"var(--surface2)",border:"1px solid var(--border)",fontSize:11}}>
                    <span style={{color:BRAND_COLOR[h.brand]||"var(--accent)",fontWeight:700}}>{h.shortName}</span>
                    <button onClick={()=>toggleComp(id)} style={{border:"none",background:"none",color:"var(--red)",cursor:"pointer",fontSize:14,lineHeight:1,fontFamily:"inherit"}}>×</button>
                  </div>
                ):null;})}
                {comparingHw.length>1&&<button onClick={()=>setComparingHw([])} style={{padding:"4px 10px",borderRadius:8,border:"1px solid var(--red)",color:"var(--red)",background:"transparent",cursor:"pointer",fontSize:11,fontFamily:"inherit"}}>Clear All</button>}
              </div>
            )}
            <div style={{background:"var(--surface)",border:"1px solid var(--border)",borderRadius:14,padding:"16px 18px"}}>
              <HwCompareTable ids={comparingHw}/>
            </div>
          </div>
        )}

        {/* ── TOOLS TAB ── */}
        {tab==="tools"&&(
          <div className="fade-up">
            <div style={{fontWeight:700,fontSize:20,color:"var(--text)",marginBottom:4}}>AI Deployment Tools</div>
            <div style={{fontSize:12,color:"var(--text2)",marginBottom:20}}>Calculators to help size your hardware for production workloads.</div>
            <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(320px,1fr))",gap:20}}>
              <KVCacheCalc model={selectedModel} buildVram={totalVram}/>
              <VramCalc selectedMap={selectedMap}/>
              <PowerCostCalc selectedMap={selectedMap}/>
            </div>
            <ConcurrentSimulator selectedMap={selectedMap} selectedModel={selectedModel}/>
            <TCOCalculator selectedMap={selectedMap}/>
          </div>
        )}

        {/* ── STRESS TEST TAB ── */}
        {tab==="stress"&&(
          <div className="fade-up">
            <div style={{fontWeight:700,fontSize:20,color:"var(--text)",marginBottom:4}}>🔥 Stress Test & Benchmarking</div>
            <div style={{fontSize:12,color:"var(--text2)",marginBottom:20}}>Load-test your local AI inference server. Understand results with the score guide, then pick the right tool.</div>

            {/* ── Score Guide Chart ── */}
            <div style={{background:"var(--surface)",border:"1px solid var(--border)",borderRadius:14,padding:"18px 20px",marginBottom:20}}>
              <div style={{fontWeight:700,fontSize:14,color:"var(--text)",marginBottom:14}}>📊 Score Guide — What Does Each Range Mean?</div>
              {/* Segmented bar */}
              <div style={{display:"flex",borderRadius:10,overflow:"hidden",height:32,marginBottom:16,gap:2}}>
                {[["0–50","Poor","#ef4444",50],["50–70","Fair","#f59e0b",20],["70–85","Good","#84cc16",15],["85–95","Great","#22c55e",10],["95–100","Perfect","#10b981",5]].map(([range,label,color,flex])=>(
                  <div key={range} style={{flex,background:color,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",minWidth:0,overflow:"hidden"}}>
                    <div style={{fontSize:9,fontWeight:800,color:"#fff",lineHeight:1}}>{label}</div>
                    <div style={{fontSize:8,color:"rgba(255,255,255,0.8)",lineHeight:1,marginTop:1}}>{range}</div>
                  </div>
                ))}
              </div>
              {/* Tick marks */}
              <div style={{display:"flex",justifyContent:"space-between",fontSize:9,color:"var(--text3)",marginBottom:14,padding:"0 2px"}}>
                {[0,50,70,85,95,100].map(v=><span key={v}>{v}</span>)}
              </div>
              {/* Zone descriptions */}
              <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(200px,1fr))",gap:8}}>
                {[
                  ["🔴 Poor (0–50)","Fails under load. P99 latency > 5 s. Too slow for production inference.","#ef4444"],
                  ["🟡 Fair (50–70)","Handles light load only. Latency spikes under concurrency. Dev/test use.","#f59e0b"],
                  ["🟢 Good (70–85)","Sustains moderate concurrency. P99 < 2 s. Suitable for most use cases.","#84cc16"],
                  ["⭐ Excellent (85+)","Production-grade. Handles ramp-up without spikes. P99 < 500 ms.","#22c55e"],
                ].map(([lbl,desc,color])=>(
                  <div key={lbl} style={{background:"rgba(255,255,255,0.03)",border:"1px solid var(--border2)",borderRadius:9,padding:"10px 12px"}}>
                    <div style={{fontWeight:700,fontSize:11,color,marginBottom:5}}>{lbl}</div>
                    <div style={{fontSize:10,color:"var(--text3)",lineHeight:1.5}}>{desc}</div>
                  </div>
                ))}
              </div>

              {/* Key metrics explained */}
              <div style={{marginTop:14,display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(160px,1fr))",gap:6}}>
                {[
                  ["TTFT","Time To First Token","How fast the first word appears"],
                  ["P50","Median latency","Half of requests are faster than this"],
                  ["P95","95th percentile","95% of requests stay below this"],
                  ["P99","99th percentile","Worst-case latency users will experience"],
                  ["Throughput","Tokens/sec total","Total output speed across all users"],
                  ["t/s per user","Tokens/sec per req","Perceived speed for a single user"],
                ].map(([k,full,explain])=>(
                  <div key={k} style={{background:"rgba(110,80,255,0.06)",borderRadius:7,padding:"7px 10px",border:"1px solid rgba(110,80,255,0.12)"}}>
                    <div style={{fontWeight:800,fontSize:11,color:"var(--accent2)",fontFamily:"'JetBrains Mono',monospace"}}>{k}</div>
                    <div style={{fontSize:9,color:"var(--text2)",fontWeight:600,marginTop:1}}>{full}</div>
                    <div style={{fontSize:9,color:"var(--text3)",marginTop:2}}>{explain}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* ── Selected Model Results ── */}
            <div style={{background:"var(--surface)",border:"1px solid var(--border)",borderRadius:14,padding:"18px 20px",marginBottom:20}}>
              <div style={{fontWeight:700,fontSize:14,color:"var(--text)",marginBottom:4}}>
                📈 {selectedModel?`Stress Test Results — ${selectedModel.name}`:"Stress Test Results"}
              </div>
              {!selectedModel?(
                <div style={{textAlign:"center",padding:"28px 0",color:"var(--text3)",fontSize:12}}>
                  <div style={{fontSize:28,marginBottom:8}}>🤖</div>
                  Select a model from the <strong style={{color:"var(--accent2)"}}>Models</strong> tab to see its stress test scores across hardware.
                </div>
              ):(
                <div>
                  <div style={{fontSize:10,color:"var(--text3)",marginBottom:14}}>
                    Hardware-level results from community benchmarks. Score 0–100 based on throughput, latency, and stability.
                  </div>
                  {/* Results table */}
                  <div style={{overflowX:"auto"}}>
                    <table style={{width:"100%",borderCollapse:"collapse",fontSize:11}}>
                      <thead>
                        <tr style={{borderBottom:"1px solid var(--border)"}}>
                          {["Hardware","Score","Rating","Tokens/s","Latency (ms)","Context","VRAM Used"].map(h=>(
                            <th key={h} style={{textAlign:h==="Hardware"?"left":"right",padding:"6px 10px",color:"var(--text3)",fontWeight:600,fontSize:10,whiteSpace:"nowrap"}}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {[...(selectedModel.stressTests||[])].sort((a,b)=>b.score-a.score).map((st,i)=>(
                          <tr key={st.hw} style={{borderBottom:"1px solid var(--border2)",background:i%2===0?"transparent":"rgba(255,255,255,0.01)"}}>
                            <td style={{padding:"8px 10px",fontWeight:600,color:"var(--text)",whiteSpace:"nowrap"}}>{st.hw}</td>
                            <td style={{padding:"8px 10px",textAlign:"right"}}>
                              <div style={{display:"flex",alignItems:"center",justifyContent:"flex-end",gap:6}}>
                                <div style={{width:60,height:6,background:"var(--surface3)",borderRadius:3,overflow:"hidden"}}>
                                  <div style={{width:`${st.score}%`,height:"100%",background:scoreColor(st.score),borderRadius:3,transition:"width .3s"}}/>
                                </div>
                                <span style={{fontWeight:800,fontFamily:"'JetBrains Mono',monospace",color:scoreColor(st.score),minWidth:28}}>{st.score}</span>
                              </div>
                            </td>
                            <td style={{padding:"8px 10px",textAlign:"right"}}>
                              <span style={{fontSize:10,fontWeight:700,color:scoreColor(st.score),padding:"2px 7px",borderRadius:4,background:scoreColor(st.score)+"18"}}>{scoreLabel(st.score)}</span>
                            </td>
                            <td style={{padding:"8px 10px",textAlign:"right",fontFamily:"'JetBrains Mono',monospace",color:"var(--green)",fontWeight:700}}>{st.tokens_sec??"-"}</td>
                            <td style={{padding:"8px 10px",textAlign:"right",fontFamily:"'JetBrains Mono',monospace",color:"var(--amber)"}}>{st.latency_ms??"-"}</td>
                            <td style={{padding:"8px 10px",textAlign:"right",color:"var(--text2)"}}>{st.ctx?.toLocaleString()??"-"}</td>
                            <td style={{padding:"8px 10px",textAlign:"right",color:"var(--accent2)",fontFamily:"'JetBrains Mono',monospace"}}>{st.vram_used??"-"} GB</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {/* Visual score bars */}
                  <div style={{marginTop:16,display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(180px,1fr))",gap:8}}>
                    {[...(selectedModel.stressTests||[])].sort((a,b)=>b.score-a.score).map(st=>(
                      <div key={st.hw+"v"} style={{background:"rgba(255,255,255,0.02)",border:"1px solid var(--border2)",borderRadius:9,padding:"10px 12px"}}>
                        <div style={{fontSize:10,fontWeight:700,color:"var(--text)",marginBottom:6,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{st.hw}</div>
                        <div style={{height:8,background:"var(--surface3)",borderRadius:4,overflow:"hidden",marginBottom:6}}>
                          <div style={{width:`${st.score}%`,height:"100%",background:`linear-gradient(90deg,${scoreColor(st.score)},${scoreColor(st.score)}aa)`,borderRadius:4,transition:"width .4s"}}/>
                        </div>
                        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                          <span style={{fontWeight:800,fontSize:18,color:scoreColor(st.score),fontFamily:"'JetBrains Mono',monospace"}}>{st.score}</span>
                          <span style={{fontSize:9,color:"var(--text3)"}}>{st.tokens_sec??"-"} t/s · {st.latency_ms??"-"}ms</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* ── Deploy & Stress Test Deployer ── */}
            <StressTestDeployer selectedMap={selectedMap} selectedModel={selectedModel}/>

            {/* ── Stress Test Tool Cards ── */}
            <div style={{fontWeight:700,fontSize:14,color:"var(--text)",marginBottom:12}}>🛠 Best Tools for Stress Testing Your Inference Server</div>
            <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(340px,1fr))",gap:14,marginBottom:8}}>
              {STRESS_TOOLS.map(tool=>(
                <div key={tool.name} style={{background:"var(--surface)",border:"1px solid var(--border)",borderRadius:14,padding:"18px 20px",display:"flex",flexDirection:"column",gap:10}}>
                  {/* Badge + title */}
                  <div>
                    <span style={{display:"inline-block",fontSize:10,fontWeight:700,color:tool.badgeColor,background:tool.badgeBg,padding:"3px 10px",borderRadius:20,marginBottom:8}}>{tool.badge}</span>
                    <div style={{fontWeight:800,fontSize:15,color:"var(--text)",marginBottom:3}}>{tool.name}</div>
                    <div style={{fontSize:11,color:"var(--text2)",fontWeight:600,marginBottom:6}}>{tool.subtitle}</div>
                    <div style={{fontSize:11,color:"var(--text3)",lineHeight:1.6}}>{tool.desc}</div>
                  </div>
                  {/* Spec rows */}
                  <div style={{borderTop:"1px solid var(--border2)",paddingTop:10,display:"flex",flexDirection:"column",gap:6}}>
                    {tool.specs.map(([k,v])=>(
                      <div key={k} style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:8,fontSize:11}}>
                        <span style={{color:"var(--text3)",whiteSpace:"nowrap",minWidth:90,fontWeight:600}}>{k}</span>
                        <span style={{color:"var(--text)",textAlign:"right",lineHeight:1.4,fontFamily:k==="Command"?"'JetBrains Mono',monospace":"inherit",fontSize:k==="Command"?10:11}}>{v}</span>
                      </div>
                    ))}
                  </div>
                  {/* Tags */}
                  <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
                    {tool.tags.map(t=>(
                      <span key={t} style={{fontSize:10,padding:"3px 9px",borderRadius:20,border:"1px solid var(--border)",color:"var(--text2)",background:"var(--surface2)",fontFamily:t.startsWith("pip")||t.startsWith("github")?"'JetBrains Mono',monospace":"inherit"}}>{t}</span>
                    ))}
                  </div>
                  {/* Install / command */}
                  {(tool.install||tool.cmd)&&(
                    <div style={{background:"var(--surface3)",borderRadius:8,padding:"8px 12px",fontSize:11,color:"var(--green)",fontFamily:"'JetBrains Mono',monospace",wordBreak:"break-all"}}>
                      $ {tool.install||tool.cmd}
                    </div>
                  )}
                  {/* Link */}
                  <a href={tool.link} target="_blank" rel="noopener noreferrer" style={{fontSize:10,color:"var(--accent2)",textDecoration:"none",display:"flex",alignItems:"center",gap:4}}>
                    ↗ {tool.link.replace("https://","")}
                  </a>
                </div>
              ))}
            </div>

            {/* Quick start guide */}
            <div style={{background:"rgba(110,80,255,0.06)",border:"1px solid rgba(110,80,255,0.2)",borderRadius:12,padding:"16px 18px"}}>
              <div style={{fontWeight:700,fontSize:12,color:"var(--accent2)",marginBottom:10}}>⚡ Recommended Workflow</div>
              <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(200px,1fr))",gap:10}}>
                {[
                  ["1","Start vLLM","python -m vllm.entrypoints.openai.api_server --model <model>"],
                  ["2","Quick baseline","python benchmark_serving.py --num-prompts 100 --request-rate 5"],
                  ["3","Full load test","locust -f locustfile.py --headless -u 50 -r 5 --run-time 5m"],
                  ["4","Monitor GPU","nvidia-smi dmon -s u (in a separate terminal)"],
                ].map(([n,title,cmd])=>(
                  <div key={n} style={{background:"rgba(255,255,255,0.03)",borderRadius:9,padding:"10px 12px"}}>
                    <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:6}}>
                      <span style={{width:20,height:20,borderRadius:"50%",background:"var(--accent)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:10,fontWeight:800,color:"#fff",flexShrink:0}}>{n}</span>
                      <span style={{fontSize:11,fontWeight:700,color:"var(--text)"}}>{title}</span>
                    </div>
                    <div style={{fontSize:10,color:"var(--green)",fontFamily:"'JetBrains Mono',monospace",background:"var(--surface3)",padding:"5px 8px",borderRadius:6,wordBreak:"break-all",lineHeight:1.4}}>{cmd}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── SOURCES TAB ── */}
        {tab==="sources"&&(
          <div className="fade-up">
            <div style={{fontWeight:700,fontSize:20,color:"var(--text)",marginBottom:4}}>Sources & Methodology</div>
            <div style={{fontSize:12,color:"var(--text2)",marginBottom:16}}>All data sources — hardware specifications, ML model benchmarks, and pricing — in one place.</div>

            {/* Price disclaimer */}
            <div style={{background:"rgba(255,184,48,0.08)",border:"1px solid rgba(255,184,48,0.2)",borderRadius:12,padding:"12px 16px",marginBottom:20}}>
              <div style={{fontWeight:700,fontSize:12,color:"var(--amber)",marginBottom:4}}>⚠ Price Disclaimer</div>
              <div style={{fontSize:11,color:"var(--text2)",lineHeight:1.7}}>
                USD prices are MSRP / indicative as of June 2026. INR is live from{" "}
                <a href="https://frankfurter.dev" target="_blank" rel="noopener noreferrer" style={{color:"var(--accent2)"}}>Frankfurter API</a>
                {" "}(current: <strong style={{color:"var(--green)"}}>₹{rateInfo.rate.toFixed(2)}/USD</strong>{rateInfo.date?` as of ${rateInfo.date}`:""}).
                India retail adds ~50–60% (20–40% import duty + 18% GST + importer margin). Data center GPUs are sold via enterprise channels only — always verify before purchase.
              </div>
            </div>

            {/* Hardware Specification Sources */}
            <div style={{fontWeight:700,fontSize:15,color:"var(--text)",marginBottom:10,display:"flex",alignItems:"center",gap:8}}>
              <span style={{fontSize:18}}>🖥</span> Hardware Specification Sources
            </div>
            <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(240px,1fr))",gap:8,marginBottom:24}}>
              {Object.entries(SOURCES).filter(([,s])=>!["llm_leaderboard","gguf_quant","huggingface"].includes(Object.keys(SOURCES).find(k=>SOURCES[k]===s))).map(([k,s])=>(
                <div key={k} style={{background:"var(--surface)",border:"1px solid var(--border)",borderRadius:10,padding:"11px 13px",borderLeft:`3px solid ${k.includes("nvidia")?"var(--nvidia)":k.includes("amd")?"var(--amd)":k.includes("intel")?"var(--intel)":k.includes("apple")?"var(--apple)":"var(--accent)"}`}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:4}}>
                    <span style={{fontWeight:700,fontSize:12,color:"var(--text)"}}>{s.name}</span>
                    <Badge>{s.badge}</Badge>
                  </div>
                  <a href={s.url} target="_blank" rel="noopener noreferrer" style={{fontSize:10,color:"var(--accent2)",wordBreak:"break-all"}}>{s.url}</a>
                </div>
              ))}
            </div>

            {/* ML Model & Benchmark Sources */}
            <div style={{fontWeight:700,fontSize:15,color:"var(--text)",marginBottom:10,display:"flex",alignItems:"center",gap:8}}>
              <span style={{fontSize:18}}>🤖</span> ML Model & Benchmark Sources
            </div>
            <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(240px,1fr))",gap:8,marginBottom:24}}>
              {[
                {name:"Hugging Face",url:"https://huggingface.co/models",badge:"Models Hub",desc:"All model weights, GGUF files, and community benchmarks."},
                {name:"Open LLM Leaderboard",url:"https://huggingface.co/spaces/open-llm-leaderboard/open_llm_leaderboard",badge:"Benchmark",desc:"MMLU, HellaSwag, ARC, Winogrande scores for open models."},
                {name:"llama.cpp",url:"https://github.com/ggerganov/llama.cpp",badge:"Open Source",desc:"Tokens/sec, perplexity, KV cache formula, GGUF quantization specs."},
                {name:"Ollama",url:"https://ollama.com",badge:"Runtime",desc:"Community inference benchmarks used as supplementary data."},
                {name:"LMSys Chatbot Arena",url:"https://chat.lmsys.org",badge:"Benchmark",desc:"Human preference rankings and Elo scores."},
                {name:"DeepSeek",url:"https://github.com/deepseek-ai",badge:"Model",desc:"DeepSeek-R1 architecture details and benchmark results."},
                {name:"Meta AI",url:"https://ai.meta.com/llama/",badge:"Model",desc:"Llama 3.x model cards, architecture specs, and licenses."},
                {name:"Microsoft Research",url:"https://huggingface.co/microsoft",badge:"Model",desc:"Phi-4 and Phi-4 Mini model cards and benchmarks."},
                {name:"Google DeepMind",url:"https://huggingface.co/google",badge:"Model",desc:"Gemma 3 model cards and benchmark results."},
                {name:"Mistral AI",url:"https://huggingface.co/mistralai",badge:"Model",desc:"Mistral 7B, Nemo 12B, and Codestral model cards."},
              ].map(s=>(
                <div key={s.name} style={{background:"var(--surface)",border:"1px solid var(--border)",borderRadius:10,padding:"11px 13px",borderLeft:"3px solid var(--accent)"}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:4}}>
                    <span style={{fontWeight:700,fontSize:12,color:"var(--text)"}}>{s.name}</span>
                    <Badge>{s.badge}</Badge>
                  </div>
                  <div style={{fontSize:10,color:"var(--text3)",marginBottom:4,lineHeight:1.5}}>{s.desc}</div>
                  <a href={s.url} target="_blank" rel="noopener noreferrer" style={{fontSize:10,color:"var(--accent2)",wordBreak:"break-all"}}>{s.url}</a>
                </div>
              ))}
            </div>

            {/* Benchmark Methodology */}
            <div style={{background:"var(--surface)",border:"1px solid var(--border)",borderRadius:14,padding:"18px 20px"}}>
              <div style={{fontWeight:700,fontSize:14,color:"var(--text)",marginBottom:12}}>📐 Benchmark Methodology</div>
              <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(220px,1fr))",gap:8}}>
                {[
                  ["MMLU","57 academic subject categories (law, medicine, STEM). Source: Open LLM Leaderboard (HuggingFace). Higher = better."],
                  ["HellaSwag","Commonsense NLI — complete a scenario correctly. Source: Open LLM Leaderboard. Higher = better."],
                  ["ARC","Grade-school science reasoning (AI2 Reasoning Challenge). Higher = better."],
                  ["GSM8K","8,500 grade-school math word problems. Source: OpenAI. Higher = better."],
                  ["HumanEval","164 Python coding tasks with unit tests. Source: OpenAI. Higher = better."],
                  ["Tokens/sec","Community benchmarks: llama.cpp, Ollama. Measured at default batch=1 unless noted. Hardware, driver & quantization affect results."],
                  ["Perplexity (PPL)","Measured on wikitext-2 dataset. Lower = better. Source: llama.cpp quant benchmarks."],
                  ["KV Cache formula","2 × Layers × KV-heads × HeadDim × ContextLen × BatchSize × BytesPerElem. Source: llama.cpp attention implementation."],
                  ["VRAM Estimate","(params × bits-per-weight / 8) GB for weights + KV cache approximation. Actual may vary ±5%."],
                  ["INR Conversion","Live rate from Frankfurter API (frankfurter.dev). Add ~50–60% for India retail (import duty + GST + margin)."],
                  ["GPU Bandwidth","Manufacturer datasheets via TechPowerUp GPU DB. Memory bandwidth is a key bottleneck for LLM inference."],
                  ["TFLOPS","Manufacturer peak specs (FP16/FP8/INT8). Real-world inference throughput is bandwidth-bound, not compute-bound for most LLMs."],
                ].map(([k,v])=>(
                  <div key={k} style={{background:"rgba(255,255,255,0.025)",borderRadius:8,padding:"9px 11px",border:"1px solid var(--border2)"}}>
                    <div style={{fontWeight:700,fontSize:11,color:"var(--accent2)",marginBottom:3}}>{k}</div>
                    <div style={{fontSize:10,color:"var(--text2)",lineHeight:1.55}}>{v}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── GUIDE TAB ── */}
        {tab==="guide"&&(
          <div className="fade-up">
            <div style={{fontWeight:700,fontSize:20,color:"var(--text)",marginBottom:4}}>📖 How to Use LocalAIDeploy</div>
            <div style={{fontSize:12,color:"var(--text2)",marginBottom:24}}>A step-by-step guide for newcomers — from first visit to running your first AI model locally.</div>

            {/* Steps */}
            <div style={{display:"grid",gap:14,marginBottom:36}}>
              {[
                {n:1,icon:"🖥",title:"Browse the Hardware Explorer",color:"var(--accent2)",steps:[
                  "Open the Hardware tab (it's the first one, selected by default).",
                  "Each card shows one GPU, NPU, or AI accelerator. The colored left stripe tells you the brand at a glance — green = NVIDIA, red = AMD, blue = Intel, gray = Apple.",
                  "Use the Brand chips (NVIDIA / AMD / Intel / Apple) and Segment chips (Consumer / Workstation / Data Center / Edge) to filter.",
                  "Drag the Max Price slider to set your budget. Drag Min VRAM to filter out cards with too little memory.",
                  "Use the search box to find a specific GPU by name (e.g. '4090', 'M4', 'MI300').",
                  "Token-per-second badges on each card (e.g. '8B: 148 t/s') show real inference speed benchmarks.",
                ]},
                {n:2,icon:"🛠",title:"Build Your Hardware Setup",color:"var(--green)",steps:[
                  "Click any hardware card to add it to your Build — a green glow and a 'Build' tab badge counter appear.",
                  "Click again to remove it from your Build.",
                  "Use the QTY +/− buttons on a card to add multiple units (e.g., 2× RTX 4090 for 48 GB combined).",
                  "The hero header updates live showing your total Build VRAM.",
                  "Your build persists while you browse — switch between tabs freely.",
                ]},
                {n:3,icon:"📊",title:"Check Compatible AI Models",color:"var(--amber)",steps:[
                  "Switch to the Build tab. The right-side panel lists every AI model in the database.",
                  "Green models run on your current VRAM — it shows the best quantization format that fits.",
                  "Red models need more VRAM — it shows how much extra is required.",
                  "The Build Summary at the top shows total VRAM, power draw, compute (FP16), and estimated monthly power cost.",
                ]},
                {n:4,icon:"⚖",title:"Compare Hardware Side-by-Side",color:"#5599ff",steps:[
                  "On any hardware card, click the '+ Comp' button (bottom right of the card).",
                  "Add 2 or more cards to the comparison list (the Compare tab shows a badge count).",
                  "Switch to the Compare tab to see a full spec table — the best value in each row is highlighted with ★.",
                  "To remove an item from comparison, click the × next to its name, or use 'Clear All'.",
                ]},
                {n:5,icon:"🤖",title:"Explore AI Models in Depth",color:"var(--accent2)",steps:[
                  "Switch to the Models tab. Filter by category: LLM, Reasoning, Code, or Vision.",
                  "Each card shows benchmark scores (MMLU, GSM8K, HumanEval, etc.). Click '▼ details' to expand.",
                  "Expanded view shows every quantization format (Q8_0, Q4_K_M, IQ2_XXS...) with VRAM requirement, quality %, speed, and perplexity.",
                  "Green rows fit your current Build VRAM; red rows need more.",
                  "Click 'Select for KV Calc' to wire that model into the Tools tab calculators.",
                  "Use 'Compare A' and 'Compare B' buttons on two different models to see a side-by-side benchmark comparison.",
                ]},
                {n:6,icon:"🧮",title:"Use the AI Deployment Calculators",color:"var(--green)",steps:[
                  "Go to the Tools tab — three calculators help you size hardware for production workloads.",
                  "VRAM Calculator: enter model parameters, quantization format, and context length to estimate total VRAM needed.",
                  "KV Cache Calculator: select a model (from the Models tab) to see exactly how much VRAM the attention cache needs at various context lengths and batch sizes.",
                  "Power Cost Calculator: shows daily, monthly, and annual electricity costs based on your Build's total TDP.",
                  "If you've selected hardware in the Build tab, the calculators show whether your build fits the chosen model+context combination.",
                ]},
                {n:7,icon:"📚",title:"Verify Sources & Methodology",color:"var(--amber)",steps:[
                  "Every hardware card has source links (↗ Official, ↗ India, etc.) — click them to go directly to vendor pages for current pricing.",
                  "The Sources tab lists all data sources: hardware vendor sites, HuggingFace model pages, llama.cpp benchmarks, and benchmark methodology.",
                  "INR prices on all cards update automatically from the live Frankfurter API exchange rate shown in the hero header.",
                  "All prices are MSRP/indicative — India retail adds ~50–60% (import duty + GST + margin).",
                ]},
              ].map(({n,icon,title,color,steps})=>(
                <div key={n} style={{background:"var(--surface)",border:"1px solid var(--border)",borderLeft:`4px solid ${color}`,borderRadius:12,padding:"16px 20px"}}>
                  <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:12}}>
                    <div style={{width:30,height:30,borderRadius:8,background:color+"22",border:`1px solid ${color}44`,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                      <span style={{fontSize:16}}>{icon}</span>
                    </div>
                    <div>
                      <div style={{fontSize:9,color:color,fontWeight:700,textTransform:"uppercase",letterSpacing:.8,marginBottom:1}}>Step {n}</div>
                      <div style={{fontWeight:700,fontSize:14,color:"var(--text)"}}>{title}</div>
                    </div>
                  </div>
                  <ol style={{paddingLeft:18,margin:0,display:"grid",gap:5}}>
                    {steps.map((s,i)=>(
                      <li key={i} style={{fontSize:12,color:"var(--text2)",lineHeight:1.7}}>{s}</li>
                    ))}
                  </ol>
                </div>
              ))}
            </div>

            {/* FAQs */}
            <div style={{fontWeight:700,fontSize:18,color:"var(--text)",marginBottom:4}}>❓ Frequently Asked Questions</div>
            <div style={{fontSize:12,color:"var(--text2)",marginBottom:16}}>Technical concepts explained simply.</div>
            <div style={{display:"grid",gap:0}}>
              {[
                {q:"What is VRAM and why does it matter for AI?",
                 a:<>VRAM (Video RAM) is the memory on your GPU. To run an AI model locally, <strong>the entire model must fit in VRAM</strong>. A 7B parameter model at Q4_K_M quantization needs ~5.5 GB; a 70B model needs ~46 GB. If the model doesn't fit, it spills to system RAM and becomes 10–50× slower.</>},
                {q:"What do Q4_K_M, Q8_0, IQ2_XXS mean?",
                 a:<>These are <strong>quantization formats</strong> — ways to compress AI model weights so they take less VRAM:<br/>• <strong>Q8_0</strong>: 8-bit, near-lossless (99% quality), ~2× smaller than FP16<br/>• <strong>Q4_K_M</strong>: 4.5-bit, excellent quality/size balance (93%), most popular choice<br/>• <strong>Q3_K_M</strong>: 3.35-bit, smaller but quality drops to ~82%<br/>• <strong>IQ2_XXS</strong>: 2.3-bit, very compact but quality ~70%, for extreme VRAM constraints<br/>Higher = better quality but needs more VRAM and is slower.</>},
                {q:"What is FP16 / FP8 / INT8 / FP4?",
                 a:<>These are <strong>number precision formats</strong> for GPU calculations:<br/>• <strong>FP16</strong>: 16-bit float — standard inference; all modern GPUs support it<br/>• <strong>FP8</strong>: 8-bit float — 2× more ops/sec; requires Hopper (H100) or newer<br/>• <strong>INT8</strong>: 8-bit integer — 2× more ops/sec; supported on Ampere and newer<br/>• <strong>FP4</strong>: 4-bit float — 4× more ops/sec; only Blackwell (B200, RTX 5090) GPUs<br/>Higher precision numbers (FP16) on the spec cards means more raw throughput for inference.</>},
                {q:"What is KV Cache and why does it eat VRAM?",
                 a:<>The <strong>KV Cache</strong> (Key-Value Cache) stores intermediate attention computations for every token in your context window — so the model doesn't recompute them on each new token. For a Llama 3 70B model: at 4K context it uses ~3 GB; at 32K context it uses ~25 GB; at 128K context it uses ~100 GB. For multi-user servers, each concurrent user needs their own KV cache. Use the KV Cache Calculator in the Tools tab to estimate your needs.</>},
                {q:"Why does memory bandwidth matter more than TFLOPS for LLMs?",
                 a:<>When generating text token-by-token, the GPU reads the entire model weights from VRAM for each token. With a 7B Q4 model, that's ~4 GB of data per token. A GPU that reads memory at 1,000 GB/s will generate tokens 2× faster than one at 500 GB/s — even if the slower GPU has more raw TFLOPS. This is why Apple M4 Ultra (819 GB/s unified bandwidth) often beats discrete GPUs with higher TFLOPS in practical inference.</>},
                {q:"Consumer vs. Workstation vs. Data Center GPUs — what's the difference?",
                 a:<><strong>Consumer</strong> (RTX 40/50 series): No ECC memory, PCIe, great price/performance. Fine for home AI use.<br/><strong>Workstation</strong> (RTX Ada, RTX PRO Blackwell): ECC memory (error correction), higher reliability, NVLink support, no display output. For professional use.<br/><strong>Data Center</strong> (H100, A100, MI300X): SXM or PCIe server form factor, NVLink, enterprise support, massive VRAM (80–192 GB). Sold through NVIDIA/AMD enterprise channels — not available on Amazon.</>},
                {q:"Can I run Llama 3 70B on a single consumer GPU?",
                 a:<>At Q4_K_M quantization, Llama 3 70B needs ~46 GB VRAM. Single GPUs that fit it: NVIDIA H100/H200, AMD MI300X, Apple M2/M4 Ultra (192 GB unified), RTX PRO 6000 Blackwell (96 GB). A single RTX 4090 (24 GB) cannot hold it, but <strong>two RTX 3090s connected via NVLink</strong> give 48 GB combined and can run it. Use the Build tab to select 2× RTX 3090 and see which models fit.</>},
                {q:"What is NVLink?",
                 a:<>NVLink is NVIDIA's high-speed GPU interconnect. Two NVLink-capable GPUs (e.g., 2× RTX 3090) combine their VRAM into a single larger pool visible to AI frameworks. 2× RTX 3090 = 48 GB combined at 600 GB/s NVLink bandwidth. Look for the <strong>NVLink badge</strong> on hardware cards. Note: GeForce RTX 40/50 series removed NVLink support; only RTX 30 series consumer GPUs had it.</>},
                {q:"Why are India GPU prices so much higher than USD?",
                 a:<>India GPU prices add: <strong>20–40% import duty</strong> (varies by category) + <strong>18% GST</strong> + importer/distributor margin (~10–15%). Together this is typically 50–60% on top of USD MSRP. The INR price shown on this site is a rough estimate (USD MSRP × live rate) — actual India street price will be higher. Data center GPUs (H100, MI300X) are not available for retail purchase — contact NVIDIA Enterprise or Redington India.</>},
                {q:"What does tokens/sec (t/s) mean in practice?",
                 a:<>Tokens/sec is how fast the model generates text. A rough feel:<br/>• <strong>10–20 t/s</strong>: Slow, like a human typing fast<br/>• <strong>30–60 t/s</strong>: Comfortable conversational speed<br/>• <strong>100+ t/s</strong>: Fast — useful for batch processing or real-time apps<br/>The benchmarks shown (e.g., "8B: 148 t/s" for RTX 4090) are from llama.cpp at default settings. Speed varies with quantization, context length, and batch size.</>},
                {q:"What is the exchange rate source and how often is it updated?",
                 a:<>The USD→INR rate is fetched live from <strong>Frankfurter API</strong> (frankfurter.dev) — an open-source, self-hostable exchange rate service backed by the European Central Bank data. It updates once per page load. If the fetch fails (offline or API down), the site falls back to a hardcoded estimate and shows an '⚠ EST' badge. The live rate and its date are shown in the hero stats and footer.</>},
              ].map(({q,a},i)=>(
                <FAQItem key={i} q={q} a={a}/>
              ))}
            </div>

            {/* ── Glossary of Terms ── */}
            <div style={{fontWeight:700,fontSize:18,color:"var(--text)",marginBottom:4,marginTop:36}}>📝 Glossary of Terms</div>
            <div style={{fontSize:12,color:"var(--text2)",marginBottom:20}}>Every technical abbreviation and term used on this site — explained in plain English.</div>
            {[
              {cat:"Hardware / GPU",color:"var(--accent2)",terms:[
                {t:"VRAM",f:"Video RAM",d:"The dedicated memory on your GPU. AI models must fit entirely in VRAM to run at full speed — if they spill to system RAM, generation slows 10–50×. Measured in GB."},
                {t:"TDP",f:"Thermal Design Power",d:"The maximum heat output (in Watts) the GPU produces under full load. Determines your cooling and PSU requirements. Higher TDP = more power draw."},
                {t:"BW",f:"Memory Bandwidth",d:"How fast data moves between the GPU processor and VRAM — measured in GB/s or TB/s. The single most important spec for LLM token-generation speed."},
                {t:"FP16",f:"Half-Precision Float (16-bit)",d:"The standard floating-point format for AI inference. All modern GPUs support it. Shown in TFLOPS — higher is faster."},
                {t:"FP8",f:"8-bit Float",d:"Half the bit-width of FP16 → 2× the compute throughput. Requires Hopper (H100) or newer Blackwell architecture."},
                {t:"INT8",f:"8-bit Integer",d:"Integer arithmetic at 2× FP16 speed. Supported on Ampere (A100) and newer. Used for quantized model inference."},
                {t:"FP4",f:"4-bit Float",d:"4× the throughput of FP16. Exclusive to Blackwell GPUs (B200, RTX 5090, RTX PRO 6000 BW). Enables very large models at high speed."},
                {t:"TFLOPS",f:"Tera Floating-Point Ops/sec",d:"One trillion floating-point operations per second. Measures raw GPU compute capacity for AI training and inference."},
                {t:"TOPS",f:"Tera Operations Per Second",d:"Same as TFLOPS but for integer operations (INT8, INT4). Used to express throughput for quantized inference."},
                {t:"HBM",f:"High Bandwidth Memory",d:"Stacked memory used in data center GPUs (H100, MI300X). Far faster than GDDR — H200 reaches 4.8 TB/s vs ~1 TB/s for GDDR7."},
                {t:"GDDR6/7",f:"Graphics Double Data Rate",d:"Standard GPU memory for consumer and workstation cards. GDDR7 is ~50% faster than GDDR6. RTX 5090 uses GDDR7 at 1.79 TB/s."},
                {t:"ECC",f:"Error Correcting Code Memory",d:"Memory that detects and corrects bit-flip errors. Standard on workstation and data center GPUs. Critical for 24/7 inference servers."},
                {t:"NVLink",f:"NVIDIA NVLink",d:"NVIDIA's high-speed GPU-to-GPU interconnect. Two NVLink GPUs pool their VRAM (2× RTX 3090 = 48 GB). Removed from RTX 40/50 series consumer cards."},
                {t:"PCIe",f:"Peripheral Component Interconnect Express",d:"The slot that connects your GPU to the motherboard. PCIe 5.0 x16 = ~128 GB/s bidirectional. Bottlenecks multi-GPU setups compared to NVLink."},
                {t:"SXM",f:"Server Module Form Factor",d:"A high-power GPU form factor for server boards (not a PCIe slot). H100 SXM supports 700 W TDP and full NVLink bandwidth."},
                {t:"CUDA",f:"Compute Unified Device Architecture",d:"NVIDIA's parallel computing platform. Foundation of PyTorch, llama.cpp, vLLM, and virtually all AI frameworks. Not supported on AMD/Intel GPUs."},
                {t:"ROCm",f:"Radeon Open Compute",d:"AMD's GPU compute platform — the AMD equivalent of CUDA. Required for running AI frameworks on Radeon/Instinct GPUs."},
              ]},
              {cat:"AI / ML Concepts",color:"var(--green)",terms:[
                {t:"LLM",f:"Large Language Model",d:"A neural network trained on vast text data to understand and generate human language. Examples: Llama, Gemma, Mistral, DeepSeek, Qwen."},
                {t:"Inference",f:"AI Inference",d:"Running a trained model to generate outputs (text, images, embeddings). The primary use case for local AI — far lighter than training."},
                {t:"Training",f:"Model Training / Fine-tuning",d:"Teaching a model on data. Full training requires clusters of H100s; fine-tuning (LoRA/QLoRA) can run on a single consumer GPU."},
                {t:"Quantization",f:"Weight Quantization",d:"Compressing model weights from FP16 to lower precision (Q4, Q8) to reduce VRAM. A Q4_K_M 7B model needs 5.5 GB vs 14 GB for FP16 — ~93% quality retained."},
                {t:"KV Cache",f:"Key-Value Attention Cache",d:"Cached attention computations that avoid re-processing prior tokens each step. Grows with context length — at 128K context a 70B model needs ~100 GB KV cache alone."},
                {t:"Context Length",f:"Context Window / Token Limit",d:"The maximum tokens the model processes at once. Longer context = more KV cache VRAM. Llama 3.1 supports 128K tokens; older models cap at 4K."},
                {t:"Tokens",f:"Tokenized Text Units",d:"The chunks text is split into before entering the model. One token ≈ 0.75 English words. A 4K context window ≈ 3,000 words."},
                {t:"t/s",f:"Tokens per Second",d:"Model generation speed. 10–20 t/s = fast human typing; 30–60 t/s = comfortable chat; 100+ t/s = useful for batch/API workloads."},
                {t:"Perplexity",f:"Perplexity (PPL)",d:"A quality metric — lower is better. A Q4_K_M model has slightly higher perplexity (lower quality) than the original FP16. Shown in quantization tables."},
                {t:"RAG",f:"Retrieval-Augmented Generation",d:"Architecture where the model queries a vector database for relevant documents before responding. Reduces hallucinations and keeps knowledge current."},
                {t:"MMLU",f:"Massive Multitask Language Understanding",d:"Benchmark testing knowledge across 57 subjects (math, history, law, medicine…). Higher % = more knowledgeable model."},
                {t:"GSM8K",f:"Grade School Math 8K",d:"8,500 math word problems that test multi-step reasoning. 90%+ score indicates strong mathematical ability."},
                {t:"HumanEval",f:"HumanEval Code Benchmark",d:"164 programming problems measuring code-generation ability. Higher % = better at writing correct, runnable code."},
                {t:"Attention",f:"Attention Mechanism",d:"The core operation in transformer models. Computes relationships between all tokens. O(n²) cost is why longer context increases KV cache exponentially."},
              ]},
              {cat:"Software & Runtimes",color:"var(--amber)",terms:[
                {t:"llama.cpp",f:"llama.cpp (C++ inference engine)",d:"A C++ runtime by Georgi Gerganov. Runs GGUF quantized models on CPU and GPU. The most popular local LLM backend — used by Ollama, LM Studio, and others."},
                {t:"Ollama",f:"Ollama",d:"A user-friendly wrapper around llama.cpp. Run models with one command: `ollama run llama3`. Best for beginners — handles model download and serving."},
                {t:"vLLM",f:"vLLM",d:"A high-throughput Python inference server using PagedAttention. Dramatically increases concurrent user capacity. Requires NVIDIA CUDA GPU."},
                {t:"GGUF",f:"GPT-Generated Unified Format",d:"The file format for llama.cpp quantized models (replaced GGML). Filename encodes quantization: `Meta-Llama-3-70B.Q4_K_M.gguf`."},
                {t:"HuggingFace",f:"Hugging Face Hub",d:"The main repository for open-source AI models — the 'GitHub of AI.' This site fetches live model stats (downloads, likes) from the HuggingFace API."},
                {t:"PyTorch",f:"PyTorch",d:"The dominant Python framework for AI training and inference. Most models are released as PyTorch checkpoints before being converted to GGUF."},
                {t:"lm-eval",f:"lm-evaluation-harness",d:"EleutherAI's standard evaluation framework. Used to produce MMLU, GSM8K, and HumanEval scores shown on model cards."},
              ]},
              {cat:"Quantization Formats",color:"#5599ff",terms:[
                {t:"FP16",f:"16-bit Float — Full Precision",d:"No quality loss, largest VRAM footprint. Use only if you have ample VRAM or are fine-tuning."},
                {t:"Q8_0",f:"8-bit Quantization",d:"~99% quality vs FP16. ~2× smaller. Best quality/size ratio — use if VRAM allows."},
                {t:"Q6_K",f:"6-bit K-Quant",d:"~97% quality. Slightly smaller than Q8 with barely noticeable quality drop."},
                {t:"Q5_K_M",f:"5-bit K-Quant Medium",d:"~96% quality. Good choice when Q8 barely doesn't fit."},
                {t:"Q4_K_M",f:"4.5-bit K-Quant Medium",d:"~93% quality. The most popular format — excellent quality/VRAM balance. Recommended default."},
                {t:"Q3_K_M",f:"3.35-bit K-Quant Medium",d:"~82% quality. Noticeable degradation. Useful for fitting larger models on limited VRAM."},
                {t:"Q2_K",f:"2.6-bit K-Quant",d:"~76% quality. Significant degradation. Last resort when nothing else fits."},
                {t:"IQ2_XXS",f:"2.1-bit iMatrix Extra-Extra-Small",d:"~70% quality. Uses iMatrix importance scoring to preserve critical weights. Extreme compression."},
                {t:"IQ1_S",f:"1.6-bit iMatrix Small",d:"~65% quality. Most aggressive compression available. Quality is noticeably degraded — only for very constrained VRAM."},
              ]},
            ].map(({cat,color,terms})=>(
              <div key={cat} style={{marginBottom:28}}>
                <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:10}}>
                  <div style={{width:8,height:8,borderRadius:"50%",background:color,flexShrink:0}}/>
                  <span style={{fontWeight:700,fontSize:14,color}}>{cat}</span>
                </div>
                <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(290px,1fr))",gap:8}}>
                  {terms.map(({t,f,d})=>(
                    <div key={t} style={{background:"var(--surface)",border:"1px solid var(--border)",borderLeft:`3px solid ${color}`,borderRadius:8,padding:"10px 12px"}}>
                      <div style={{display:"flex",alignItems:"baseline",gap:6,marginBottom:4,flexWrap:"wrap"}}>
                        <span style={{fontWeight:800,fontSize:13,color:"var(--text)",fontFamily:"'JetBrains Mono',monospace"}}>{t}</span>
                        <span style={{fontSize:9,color,fontWeight:600,textTransform:"uppercase",letterSpacing:.4}}>{f}</span>
                      </div>
                      <div style={{fontSize:11,color:"var(--text2)",lineHeight:1.65}}>{d}</div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

      </div>

      {/* ── FOOTER ── */}
      <footer style={{borderTop:"1px solid var(--border)",marginTop:40,padding:"16px 24px",display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:8,background:"var(--bg2)"}}>
        <div style={{display:"flex",alignItems:"center",gap:7}}>
          <div style={{width:24,height:24,background:"linear-gradient(135deg,var(--accent),#3366cc)",borderRadius:7,display:"flex",alignItems:"center",justifyContent:"center"}}><span style={{color:"#fff",fontSize:12}}>⚡</span></div>
          <span style={{fontWeight:800,fontSize:13}}>LocalAI<span style={{color:"var(--accent)"}}>Deploy</span> <span style={{color:"var(--text3)",fontWeight:400,fontSize:10}}>v3.0</span></span>
        </div>
        <div style={{fontSize:10,color:"var(--text3)",fontFamily:"'JetBrains Mono', monospace"}}>
          {ALL_HW.length} devices · {MODELS.length} models · {MODELS.reduce((a,m)=>a+m.quants.length,0)} quants
          {" · "}
          <span style={{color:rateInfo.error?"var(--amber)":"var(--green)"}}>
            ₹{rateInfo.rate.toFixed(2)}/$
            {rateInfo.date?` (${rateInfo.date})`:""}{rateInfo.error?" ⚠ est.":""}
          </span>
        </div>
        <div style={{fontSize:10,color:"var(--text3)"}}>Indicative data · Verify before purchase</div>
      </footer>

      <ScrollTop/>

      <AddModelModal open={addModelOpen} onClose={()=>setAddModelOpen(false)} onAdd={addCustomModel}
        existing={[...MODELS,...customModels].map(m=>m._hfId||m.hfUrl?.replace("https://huggingface.co/","")).filter(Boolean)}/>
      <AddHwModal open={addHwOpen} onClose={()=>setAddHwOpen(false)} onAdd={addCustomHardware}/>
    </>
  );
}
