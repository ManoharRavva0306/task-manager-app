# TaskFlow — Task Management Application

A full-stack task management web application for creating, updating, and tracking tasks.

## ✨ Features

- **User authentication & authorization** — JWT-based register/login with bcrypt password hashing
- **CRUD operations for tasks** — Create, read, update, and delete tasks with title, description, status, priority, and due date
- **Real-time updates via WebSockets** — Task changes are broadcast to all connected sessions for the same user instantly
- **Responsive design** — Works seamlessly on desktop, tablet, and mobile screens
- **Dashboard statistics** — Track total, pending, in-progress, and completed tasks at a glance
- **Search & filter** — Filter tasks by status and priority, search by title or description

## 🛠 Tech Stack

| Layer       | Technology               |
|-------------|--------------------------|
| Frontend    | HTML5, CSS3, Vanilla JS  |
| Backend     | Node.js, Express         |
| Database    | SQLite (better-sqlite3)  |
| Auth        | JWT (jsonwebtoken)       |
| Password    | bcryptjs                 |
| Real-time   | WebSocket (ws)           |

## 📁 Project Structure

```
task-manager-app/
├── client/               # Frontend (static files served by Express)
│   ├── index.html        # SPA entry point
│   ├── styles.css        # Responsive styles
│   └── app.js            # Frontend logic & API integration
├── server/
│   ├── index.js          # Express server + API routes
│   ├── db.js             # SQLite database init & schema
│   ├── auth.js           # JWT middleware
│   ├── ws.js             # WebSocket real-time broadcast
│   └── package.json      # Backend dependencies
└── README.md
```

## 🚀 Getting Started

### Prerequisites

- Node.js 18+ (tested on Node 20)
- npm

### Install & Run

```bash
cd task-manager-app/server
npm install
npm start
```

The app will be available at **http://localhost:3000**.

### Usage

1. Open the app in your browser
2. Sign up for a new account (or sign in if you already have one)
3. Create tasks using the "Add Task" button
4. Edit, delete, or change task status using the icons on each task card
5. Open the app in a second tab/browser — changes sync in real time via WebSocket

## 📡 API Endpoints

| Method | Endpoint            | Description              | Auth |
|--------|---------------------|--------------------------|------|
| POST   | /api/auth/register  | Create a new account     | No   |
| POST   | /api/auth/login     | Authenticate & get JWT   | No   |
| GET    | /api/tasks          | List all tasks           | Yes  |
| POST   | /api/tasks          | Create a task            | Yes  |
| GET    | /api/tasks/:id      | Get a single task        | Yes  |
| PUT    | /api/tasks/:id      | Update a task            | Yes  |
| DELETE | /api/tasks/:id      | Delete a task            | Yes  |
| GET    | /api/tasks/stats    | Dashboard statistics     | Yes  |
| WS     | /ws?token=JWT       | Real-time task updates   | Yes  |

## 🎓 Learning Outcomes

This project demonstrates:

- Full-stack application structure (frontend + API + database)
- RESTful API design with Express
- JWT-based authentication and route protection
- CRUD operations with a relational database (SQLite)
- Real-time communication with WebSockets
- Responsive UI design for web and mobile
- Dynamic data handling and state management
