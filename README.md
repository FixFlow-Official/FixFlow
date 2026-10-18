<div align="center">

# 🎓 FixFlow

### A smarter campus support experience

**One secure portal for students, staff, and administrators.**

![React](https://img.shields.io/badge/React-18-61DAFB?style=for-the-badge&logo=react&logoColor=black)
![Vite](https://img.shields.io/badge/Vite-646CFF?style=for-the-badge&logo=vite&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-06B6D4?style=for-the-badge&logo=tailwindcss&logoColor=white)
![Node.js](https://img.shields.io/badge/Node.js-339933?style=for-the-badge&logo=nodedotjs&logoColor=white)
![Express](https://img.shields.io/badge/Express-000000?style=for-the-badge&logo=express&logoColor=white)
![MongoDB](https://img.shields.io/badge/MongoDB-47A248?style=for-the-badge&logo=mongodb&logoColor=white)

[Features](#-what-fixflow-offers) · [Tech Stack](#-built-with) · [Getting Started](#-getting-started) · [Project Layout](#-project-layout) · [Roadmap](#-roadmap)

</div>

---

## 📖 About

**FixFlow** is a role-based college portal that brings account access and campus support tools together in one place. Students, staff, and administrators each get a tailored experience after signing in, backed by verified identities and secure sessions.

> 🚧 **Current focus:** secure authentication and role-based dashboards. More campus services are planned as the project grows.

---

## ✨ What FixFlow offers

| | Feature | Description |
| --- | --- | --- |
| 🎓 | **Role-based access** | Separate experiences for students, staff, and administrators |
| 🪪 | **Campus ID verification** | Sign-ups are checked against institution-provided records |
| ✉️ | **Email verification** | One-time passcodes (OTP) confirm email ownership |
| 🔐 | **Secure authentication** | bcrypt password hashing and JWT-based sessions |
| 🔄 | **Session management** | Includes sign-out from all devices |
| 🔑 | **Password recovery** | Reset passwords through email verification |
| 🔓 | **Google sign-in** | Google OAuth support |
| 📱 | **Responsive interface** | Works smoothly on phones, tablets, and desktops |

---

## 🧰 Built with

| Frontend | Backend | Data & Services |
| --- | --- | --- |
| React | Node.js | MongoDB |
| Vite | Express | Nodemailer |
| React Router | Mongoose | Google OAuth |
| Tailwind CSS | | |

---

## 🗂️ Project layout

```text
FixFlow/
├── Backend/
│   ├── server.js
│   └── src/
│       ├── config/         # Environment & database configuration
│       ├── controllers/    # Request handlers
│       ├── data/           # Institution-provided records
│       ├── middlewares/    # Auth, role checks, error handling
│       ├── models/         # Mongoose schemas
│       ├── routes/         # API route definitions
│       ├── services/       # Email, OTP, and other services
│       └── utils/          # Helpers
├── Frontend/
│   └── src/
│       ├── components/     # Reusable UI components
│       ├── context/        # Auth and app state
│       ├── layouts/        # Role-based layouts
│       ├── pages/          # Route pages
│       └── services/       # API clients
└── README.md
```

---

## 🚀 Getting started

### Prerequisites

- [Node.js](https://nodejs.org/) 18 or newer
- A [MongoDB](https://www.mongodb.com/) database (local or Atlas)
- An SMTP account for Nodemailer
- Google OAuth credentials

### 1. Clone the repository

```bash
git clone https://github.com/<your-username>/FixFlow.git
cd FixFlow
```

### 2. Set up the backend

```bash
cd Backend
npm install
```

Create a `.env` file in `Backend/`:

```env
PORT=5000
MONGODB_URI=your_mongodb_connection_string
JWT_SECRET=your_jwt_secret
CLIENT_URL=http://localhost:5173

# Email (Nodemailer)
EMAIL_USER=your_email@example.com
EMAIL_PASS=your_email_app_password

# Google OAuth
GOOGLE_CLIENT_ID=your_google_client_id
```

Start the server:

```bash
npm run dev
```

### 3. Set up the frontend

```bash
cd ../Frontend
npm install
```

Create a `.env` file in `Frontend/`:

```env
VITE_API_URL=http://localhost:5000
VITE_GOOGLE_CLIENT_ID=your_google_client_id
```

Start the app:

```bash
npm run dev
```

Open **http://localhost:5173** in your browser.

> 💡 Environment variable names above are examples; match them to the ones used in your code.

---

## 🔒 Security

- Passwords are hashed with **bcrypt** and never stored in plain text
- Sessions use **JWT**, with support for signing out of all devices
- Email ownership is confirmed through **one-time passcodes**
- Sign-ups are validated against **institution-provided campus records**
- Never commit `.env` files or secrets to version control

---

## 🗺️ Roadmap

- [x] Role-based authentication
- [x] Campus ID and email verification
- [x] Password recovery
- [x] Session management
- [ ] Role-based dashboards (in progress)
- [ ] Campus support requests
- [ ] Notifications
- [ ] Admin analytics

---

## 🤝 Contributing

Contributions, ideas, and bug reports are welcome.

1. Fork the project
2. Create a feature branch: `git checkout -b feature/your-feature`
3. Commit your changes: `git commit -m "Add your feature"`
4. Push to the branch: `git push origin feature/your-feature`
5. Open a pull request

---

## 📄 License

Distributed under the MIT License. See `LICENSE` for details.

---

<div align="center">

**Built with ❤️ for a better campus experience.**

</div>