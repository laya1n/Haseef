# 💊 Haseef – Intelligent Agentic AI for Healthcare Oversight

**Haseef** is an **agentic and analytical AI system** that acts as an intelligent supervisory assistant within the healthcare ecosystem.  
It proactively analyzes medical, pharmaceutical, and insurance data to detect inconsistencies, violations, and errors **before they occur** — transforming oversight from reactive control into *proactive awareness.*

---

##  Project Vision

**Haseef** connects **diagnosis, drug dispensing, and insurance approvals** to reveal illogical patterns such as:
- Unjustified medication prescriptions  
- Repeated or suspicious insurance claims  
- Misalignments between treatment and coverage  

The system generates **real-time alerts and analytical insights** to assist regulatory bodies and healthcare administrators in making faster, evidence-based decisions.

> In essence, *Haseef is the intelligent inspector that protects the quality of healthcare.*

---

##  Features

- **Medical Records Dashboard**
  - View and filter patient data by doctor, diagnosis, and date.
  - Supports Excel file ingestion and visualization.
- **Insurance Records**
  - Analyze claim data and detect potential misuse.
- **Drug Records**
  - Display available drugs, substitutions, and inventory shortages.
- **AI Analysis (Agentic Intelligence)**
  - Analyzes relationships between diagnosis, drug use, and insurance activity.
- **Interactive Search & Filters**
  - Instant filtering by doctor or date (e.g., “Last Week”).
- **Statistics Visualization**
  - Charts showing the number of records per doctor and more.

---

## 🧩 Tech Stack

### Frontend
- **React + TypeScript + Vite**
- **Tailwind CSS + Lucide Icons**
- **React Router**

### Backend
- **FastAPI (Python)**
- **Pandas + OpenPyXL** for Excel file processing
- **PostgreSQL (NeonDB)** for authentication
- **Uvicorn** as the ASGI server
- **Render** for cloud deployment

---

## Setup & Run Locally

### 1. Clone the repository
```bash
git clone https://github.com/laya1n/Haseef.git
cd Haseef
pip install -r requirements.txt
npm run dev

# React + TypeScript + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Babel](https://babeljs.io/) (or [oxc](https://oxc.rs) when used in [rolldown-vite](https://vite.dev/guide/rolldown)) for Fast Refresh
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/) for Fast Refresh

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend updating the configuration to enable type-aware lint rules:

```js
export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...

      // Remove tseslint.configs.recommended and replace with this
      tseslint.configs.recommendedTypeChecked,
      // Alternatively, use this for stricter rules
      tseslint.configs.strictTypeChecked,
      // Optionally, add this for stylistic rules
      tseslint.configs.stylisticTypeChecked,

      // Other configs...
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```

You can also install [eslint-plugin-react-x](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-x) and [eslint-plugin-react-dom](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-dom) for React-specific lint rules:

```js
// eslint.config.js
import reactX from 'eslint-plugin-react-x'
import reactDom from 'eslint-plugin-react-dom'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...
      // Enable lint rules for React
      reactX.configs['recommended-typescript'],
      // Enable lint rules for React DOM
      reactDom.configs.recommended,
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```
