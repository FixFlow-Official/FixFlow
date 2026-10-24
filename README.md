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
| html2pdf.js, lucide-react | Nodemailer | Gmail OAuth2 for email delivery |

## Local development

### Prerequisites

- Node.js and npm
- A MongoDB database, local or hosted
- Gmail OAuth2 credentials for registration, verification, and password recovery emails
- An ImageKit private key for complaint and resolution photo uploads



## 📄 License

Distributed under the MIT License. See `LICENSE` for details.

---

<div align="center">

**Built with ❤️ for a better campus experience.**

</div>