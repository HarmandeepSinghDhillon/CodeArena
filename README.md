<div align="center">

<br/>

```
 ██████╗ ██████╗ ██████╗ ███████╗     █████╗ ██████╗ ███████╗███╗   ██╗ █████╗ 
██╔════╝██╔═══██╗██╔══██╗██╔════╝    ██╔══██╗██╔══██╗██╔════╝████╗  ██║██╔══██╗
██║     ██║   ██║██║  ██║█████╗      ███████║██████╔╝█████╗  ██╔██╗ ██║███████║
██║     ██║   ██║██║  ██║██╔══╝      ██╔══██║██╔══██╗██╔══╝  ██║╚██╗██║██╔══██║
╚██████╗╚██████╔╝██████╔╝███████╗    ██║  ██║██║  ██║███████╗██║ ╚████║██║  ██║
 ╚═════╝ ╚═════╝ ╚═════╝ ╚══════╝    ╚═╝  ╚═╝╚═╝  ╚═╝╚══════╝╚═╝  ╚═══╝╚═╝  ╚═╝
```

### **A full-stack competitive coding platform — write, run, and submit Python solutions right in the browser.**

<br/>

[![Java](https://img.shields.io/badge/Java-17-ED8B00?style=for-the-badge&logo=openjdk&logoColor=white)](https://www.oracle.com/java/)
[![Spring Boot](https://img.shields.io/badge/Spring_Boot-3.2.5-6DB33F?style=for-the-badge&logo=spring-boot&logoColor=white)](https://spring.io/projects/spring-boot)
[![React](https://img.shields.io/badge/React-19-61DAFB?style=for-the-badge&logo=react&logoColor=black)](https://react.dev/)
[![Vite](https://img.shields.io/badge/Vite-8-646CFF?style=for-the-badge&logo=vite&logoColor=white)](https://vitejs.dev/)
[![Docker](https://img.shields.io/badge/Docker-Compose-2496ED?style=for-the-badge&logo=docker&logoColor=white)](https://www.docker.com/)
[![TailwindCSS](https://img.shields.io/badge/Tailwind_CSS-4-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white)](https://tailwindcss.com/)

</div>

---

## ✨ Overview

**CodeArena** is a self-hosted, LeetCode-style coding challenge platform. Users can browse curated programming problems, write Python solutions in an embedded code editor, run their code against live test cases, and track their progress — all without leaving the browser.

An integrated **Admin Portal** gives privileged users full CRUD control over the problem library, including a professional dynamic form for managing test cases, constraints, and examples.

---

## 📸 Screenshots

> _Login Page · User Dashboard · Admin Panel_

| Login | Dashboard | Admin |
|:---:|:---:|:---:|
| Clean, secure JWT-based login | Browse & solve coding problems | Manage the full problem library |

---

## 🚀 Features

### 👤 User Features
- **Secure Authentication** — JWT-based login & sign-up with HttpOnly cookie sessions
- **Problem Dashboard** — Browse all coding challenges with difficulty tags and a live progress tracker
- **Embedded Code Editor** — Full-featured Python editor powered by [CodeMirror](https://codemirror.net/) with syntax highlighting
- **Run Code** — Execute code in a sandboxed Python 3 environment and see output instantly
- **Submit & Evaluate** — Submissions are tested against all hidden test cases; results show ✅ Passed / ❌ Failed per case
- **Progress Tracking** — Solved problems are remembered and shown on the dashboard

### 🛡️ Admin Features
- **Problem CRUD** — Create, read, update, and delete coding problems via a dedicated admin portal
- **Dynamic Form Editor** — Intuitively add/remove test cases, constraints, and examples with a professional UI — no raw JSON required
- **User Management** — (Extensible) view and manage registered users

### ⚙️ Platform Features
- **Containerized** — Fully Dockerized with `docker-compose` for one-command deployment
- **Self-hosted** — Runs entirely on your infrastructure; no third-party code execution services
- **Sandboxed Execution** — Python code runs in a 10-second timeout subprocess with stdout capture and traceback isolation
- **Smart Input Parsing** — Submission engine parses complex test inputs (lists, dicts, nested structures) and calls your `solution()` function automatically

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Docker Compose                           │
│                                                                 │
│   ┌──────────────────────┐     ┌───────────────────────────┐   │
│   │   Frontend (React)   │     │    Backend (Spring Boot)  │   │
│   │   Port :3000         │────▶│    Port :5000             │   │
│   │                      │     │                           │   │
│   │  • Vite + React 19   │     │  • REST API               │   │
│   │  • TailwindCSS 4     │     │  • Spring Security + JWT  │   │
│   │  • CodeMirror Editor │     │  • Spring Data JPA        │   │
│   │  • React Router      │     │  • H2 In-Memory Database  │   │
│   │  • Lucide Icons      │     │  • Python3 Subprocess     │   │
│   │  • Nginx (prod)      │     │  • Code Execution Engine  │   │
│   └──────────────────────┘     └───────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| **Frontend Framework** | React 19 + Vite 8 |
| **Styling** | Tailwind CSS v4 |
| **Routing** | React Router DOM v7 |
| **Code Editor** | CodeMirror 6 (`@uiw/react-codemirror`) |
| **Icons** | Lucide React |
| **Backend Framework** | Spring Boot 3.2.5 |
| **Language** | Java 17 |
| **Security** | Spring Security + JJWT (0.11.5) |
| **Persistence** | Spring Data JPA + H2 Database |
| **Code Execution** | Python 3 subprocess (sandboxed) |
| **Production Web Server** | Nginx (frontend container) |
| **Containerization** | Docker + Docker Compose |

---

## ⚡ Quick Start

### Prerequisites

- [Docker](https://www.docker.com/get-started) & Docker Compose installed
- Git

### 1. Clone the repository

```bash
git clone https://github.com/your-username/CodeArena.git
cd CodeArena
```

### 2. Run with Docker Compose

```bash
docker-compose up --build
```

That's it! The app will be available at:

| Service | URL |
|---|---|
| **Frontend (UI)** | http://localhost:3000 |
| **Backend (API)** | http://localhost:5000 |

### 3. Log in

| Role | Username | Password |
|---|---|---|
| **User** | _(sign up via the UI)_ | — |
| **Admin** | `admin` | _(set on first login)_ |

> The first time you log in with role **Admin** and username `admin`, the account is automatically created with whatever password you provide.

---

## 💻 Local Development

If you prefer to run services separately without Docker:

### Backend (Spring Boot)

```bash
# From the project root
./mvnw spring-boot:run
# Backend will start on http://localhost:5000
```

### Frontend (React + Vite)

```bash
cd frontend
npm install
npm run dev
# Frontend will start on http://localhost:5173
```

> Make sure the backend is running first. The Vite dev server proxies `/api` requests to `http://localhost:5000`.

---

## 📁 Project Structure

```
CodeArena/
├── 📄 docker-compose.yml          # Orchestrates frontend + backend containers
├── 📄 Dockerfile                  # Backend multi-stage build (Maven → JRE + Python3)
├── 📄 pom.xml                     # Maven dependencies
│
├── 📂 src/main/java/com/coderunner/app/
│   ├── 📄 CodeRunnerApplication.java
│   ├── 📂 controllers/
│   │   ├── 📄 ApiController.java   # Auth endpoints (login, signup, logout, check-auth)
│   │   ├── 📄 DataController.java  # Problem & progress CRUD endpoints
│   │   └── 📄 ViewController.java  # SPA fallback routing
│   ├── 📂 models/
│   │   ├── 📄 User.java
│   │   ├── 📄 Problem.java         # Stores problem JSON in a TEXT column
│   │   └── 📄 Progress.java        # Tracks which users solved which problems
│   ├── 📂 repositories/            # Spring Data JPA repositories
│   ├── 📂 services/
│   │   └── 📄 CodeExecutionService.java  # Sandboxed Python execution engine
│   └── 📂 config/                  # Spring Security configuration
│
└── 📂 frontend/
    ├── 📄 Dockerfile               # Nginx-based frontend container
    ├── 📄 nginx.conf               # SPA routing + API proxy config
    ├── 📄 package.json
    └── 📂 src/
        ├── 📄 App.jsx              # Root component + React Router setup
        └── 📂 pages/
            ├── 📄 Login.jsx        # Login page
            ├── 📄 Signup.jsx       # Sign-up page
            ├── 📄 Dashboard.jsx    # User problem dashboard + code editor
            └── 📄 Admin.jsx        # Admin problem management portal
```

---

## 🔌 API Reference

### Authentication

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/signup` | Register a new user |
| `POST` | `/api/login` | Authenticate and receive JWT cookie |
| `POST` | `/api/logout` | Clear the auth cookie |
| `GET` | `/api/check-auth` | Validate current session |

### Code Execution

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/run` | Run arbitrary Python code with optional stdin |
| `POST` | `/api/submit` | Submit a solution and evaluate against test cases |

### Problems & Progress

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/problems` | Fetch all problems |
| `GET` | `/api/problems/{id}` | Fetch a single problem |
| `POST` | `/api/problems` | Create a problem _(Admin only)_ |
| `PUT` | `/api/problems/{id}` | Update a problem _(Admin only)_ |
| `DELETE` | `/api/problems/{id}` | Delete a problem _(Admin only)_ |
| `GET` | `/api/progress` | Get current user's solved problems |
| `POST` | `/api/progress` | Mark a problem as solved |

---

## 🧠 Code Execution Engine

CodeArena runs user-submitted Python code **server-side** via a sandboxed subprocess:

1. **Wraps** the user's code in a Python harness that captures `stdout` and overrides `input()`.
2. **Spawns** a `python3` process with a **10-second timeout**.
3. For **submissions**, it intelligently parses test case inputs (supports `int`, `float`, `str`, `list`, `dict`, `tuple`, nested structures) and calls the user's `solution()` function directly.
4. Compares the actual return value against the expected output and reports `passed: true/false` per test case.

---

## 🤝 Contributing

Contributions are welcome! Here's how to get started:

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Commit your changes: `git commit -m 'Add some amazing feature'`
4. Push to the branch: `git push origin feature/amazing-feature`
5. Open a Pull Request

---

## 📄 License

This project is open source and available under the [MIT License](LICENSE).

---

<div align="center">

Made with ❤️ · Built with Spring Boot & React

</div>
