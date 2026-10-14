# Coffee Civil — 4D Construction Phasing & Site Logistics Simulator

A standalone 4D civil engineering simulation and heavy site logistics command center web application built with **React**, **Three.js**, **TypeScript**, and **Tailwind CSS**.

![Coffee Civil 4D Simulator](https://img.shields.io/badge/Platform-Vite%20%2B%20React%20%2B%20Three.js-0284c7)
![TypeScript](https://img.shields.io/badge/TypeScript-5.7-3178c6)
![Tailwind](https://img.shields.io/badge/TailwindCSS-3.4-38bdf8)
![Status](https://img.shields.io/badge/QA%2FQC-Verified-10b981)

---

## 🏗️ Project Architecture & Scope
- **Corridor Corridor Scope**: 2.5 km Elevated Viaduct & Bridge (STA 12+450 to STA 14+950) spanning 25 piers and 24 superstructures.
- **Deep River Span**: 16m high clearance over Cisadane River with water geometry and ripples.
- **On-site Concrete Batching Plant**: 3 cement silos, batching mixing tower, aggregate hoppers, and control cabin.
- **Heavy Crawler Cranes**: 4 mobile crawler cranes (Kobelco CKE2500, Liebherr LR 1300, Sany SCC2600A, Tadano GR-1000XL) with 360° sweep radius rings and live collision overlap warnings.
- **Transit Mixer Fleet**: Real-time animated concrete mixers (TM-01 to TM-06) hauling along site haul roads to active pump trucks.
- **Component Inspector**: Raycast click inspection for compressive strength ($f'_c$), slump, w/c ratio, rebar tonnage, formwork area, and QA/QC RFI sign-offs with confetti celebrations.
- **Weather Stress-Test**: Precipitation slider ($0\text{–}80\text{ mm/h}$) that halts concrete pouring when $> 20\text{ mm/h}$, calculates schedule delays, and simulates 3D rain particles with atmospheric fog and sky darkening.

---

## 🚀 Quick Start

### 1. Install Dependencies
```bash
npm install
```

### 2. Development Mode
```bash
npm run dev
```

### 3. Production Build
```bash
npm run build
```

---

## 📦 Deployment
Configured for single-page application (SPA) hosting on **Vercel** with `vercel.json` rewrites.
