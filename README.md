<div align="center">

# FixFlow

### Campus support, made simpler

**A campus complaint workflow for students, staff, and administrators.**

![React](https://img.shields.io/badge/React-19-61DAFB?style=for-the-badge&logo=react&logoColor=black)
![Vite](https://img.shields.io/badge/Vite-646CFF?style=for-the-badge&logo=vite&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-4-06B6D4?style=for-the-badge&logo=tailwindcss&logoColor=white)
![Node.js](https://img.shields.io/badge/Node.js-339933?style=for-the-badge&logo=nodedotjs&logoColor=white)
![Express](https://img.shields.io/badge/Express-5-000000?style=for-the-badge&logo=express&logoColor=white)
![MongoDB](https://img.shields.io/badge/MongoDB-47A248?style=for-the-badge&logo=mongodb&logoColor=white)

[Features](#features) · [Stack](#technology-stack) · [Setup](#local-development) · [Structure](#project-structure)

</div>

---

## About

FixFlow is a role-based campus support application. Students submit maintenance complaints with photo evidence, administrators route each complaint to the right department and staff member, and staff record progress and resolution evidence.

## Features

- **Campus account registration:** verifies an institution-issued ID, verifies email with an OTP, and records acceptance of the terms before creating an account.
- **Role-based access:** separate student, staff, and administrator dashboards with protected routes.
- **Student complaint tracking:** submit complaints with required photo proof, view current and resolved complaints, search and paginate results, and download a complaint report as a PDF.
- **Administrator workflow:** review unassigned complaints, assign and reassign staff by department, and search, filter, and paginate complaint queues.
- **Staff workflow:** view current and previously resolved assigned complaints, update status with notes, and submit a resolution note and photo proof when resolving a complaint.
- **Complaint conversations and notifications:** students and assigned staff can exchange messages; dashboard notifications track assignment, status, and message updates.
- **Device push notifications:** users can opt in to receive privacy-conscious browser notifications while FixFlow is closed, with a PWA install option for supported devices.
- **Account security:** password hashing, JWT-based authentication, password recovery, sign-out across sessions, and rate limits for login and OTP endpoints.
- **Offline experience:** a production service worker caches frontend resources and provides the Campus Dash runner game. Complaint data and account actions still require the backend to be online.

## Project structure

FixFlow/
├── Backend/
│   ├── server.js
│   ├── test/                 # Backend regression tests
│   └── src/
│       ├── config/           # MongoDB and environment configuration
│       ├── controllers/      # Authentication and complaint workflows
│       ├── data/             # Institution-provided account directories
│       ├── middlewares/      # Authentication, validation, upload, and rate limits
│       ├── models/           # Mongoose models
│       ├── routes/           # Auth, student, staff, and admin APIs
│       ├── services/         # Email and image storage
│       └── utils/            # Shared server helpers
├── Frontend/
│   ├── public/               # Static assets and service worker
│   └── src/
│       ├── components/       # Shared auth, layout, and complaint UI
│       ├── context/          # Authentication state
│       ├── features/         # Role-specific and offline experiences
│       ├── layouts/          # Application shell
│       ├── pages/            # Route-level pages
│       ├── services/         # API client
│       └── utils/            # Complaint formatting and PDF generation
└── README.md

## Technology stack

| Frontend | Backend | Storage and services |
| --- | --- | --- |
| React 19, React Router 7 | Node.js, Express 5 | MongoDB, Mongoose |
| Vite 8, Tailwind CSS 4 | JSON API | ImageKit for complaint images |
| html2pdf.js, lucide-react | Nodemailer, web-push | MongoDB, ImageKit, Gmail OAuth2 |

## Local development

### Prerequisites

- Node.js 20.19+ or 22.12+ and npm
- A MongoDB database, local or hosted
- Gmail OAuth2 credentials for registration, verification, and password recovery emails
- An ImageKit private key for complaint and resolution photo uploads
- VAPID keys for opt-in device push notifications (see below)

### Configure the backend

Copy `Backend/.env.example` to `Backend/.env` and replace the placeholders with your own values. The backend validates required configuration before starting; it will report missing variable names without printing secret values. Push notifications are optional, but both VAPID keys must be configured together.

For local development, the backend defaults to `127.0.0.1:3000` and trusts no reverse proxies (`TRUST_PROXY_HOPS=0`). If the API is placed behind a reverse proxy, set `TRUST_PROXY_HOPS` to the exact number of trusted proxy hops so rate limits use the real client IP. Never commit `Backend/.env` or put production secrets in frontend variables.

### Run locally

In separate terminals:

```bash
cd Backend
npm install
npm run dev
```

```bash
cd Frontend
npm install
npm run dev
```

Vite serves the frontend and proxies `/api` requests to the backend at `http://127.0.0.1:3000`.

## Deployment

FixFlow's frontend uses same-origin `/api` requests and HTTP-only cookies. Deploy it behind one HTTPS origin: serve the frontend build as static files, route `/api` to the Node backend, and configure the static host to return `index.html` for SPA routes such as `/login` and `/student/dashboard`.

1. Use Node.js 20.19+ or 22.12+.
2. Configure the backend environment variables from `Backend/.env.example` in your hosting provider's secret/configuration settings. Use `NODE_ENV=production`, `HOST=0.0.0.0`, the `PORT` assigned by the platform, and set `TRUST_PROXY_HOPS` to the actual proxy hop count (commonly `1` behind one trusted proxy).
3. Ensure the backend can reach MongoDB, Gmail OAuth2, and ImageKit. Configure both VAPID keys only if push notifications should be enabled.
4. Build the frontend with `cd Frontend && npm ci && npm run build`, then publish `Frontend/dist` as the static site.
5. Install and start the API with `cd Backend && npm ci && npm start`.
6. Configure the platform's readiness check to request `GET /api/health`. It returns HTTP 200 only after MongoDB and the campus-directory migration are ready; otherwise it returns HTTP 503.
7. Confirm HTTPS is active before testing login, since production authentication cookies are marked `Secure`.

Do not expose the backend directly to browsers on a separate origin unless you deliberately add and test an explicit CORS and cookie policy. The current frontend expects same-origin API routing.

### Push notification setup

Generate a VAPID key pair from the `Backend` folder:

```bash
node -e "const { publicKey, privateKey } = require('web-push').generateVAPIDKeys(); console.log('VAPID_PUBLIC_KEY=' + publicKey); console.log('VAPID_PRIVATE_KEY=' + privateKey);"
```

Add both generated values and a real support contact to `Backend/.env`:

```env
VAPID_PUBLIC_KEY=your_public_key
VAPID_PRIVATE_KEY=your_private_key
VAPID_SUBJECT=mailto:admin@your-college.edu
```

Restart the backend. Device push requires HTTPS in deployment (localhost is allowed for development), a supported browser, and the user's permission. On iPhone or iPad, install FixFlow from the browser's Share menu using **Add to Home Screen**, open the installed app, then enable device notifications from the bell menu. Push notifications use generic lock-screen text and open the user's dashboard when tapped.



## 📄 License

Distributed under the MIT License. See `LICENSE` for details.

---

<div align="center">

**Built with ❤️ for a better campus experience.**

</div>
