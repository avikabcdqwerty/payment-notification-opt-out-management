# Payment Notification Opt-Out Management

A scalable, secure feature enabling users to manage opt-out settings for payment-related push notifications, providing granular control over which payment alerts they receive from the platform.

---

## Table of Contents

- [Features](#features)
- [Architecture Overview](#architecture-overview)
- [Tech Stack](#tech-stack)
- [Setup & Development](#setup--development)
- [Environment Variables](#environment-variables)
- [API Documentation](#api-documentation)
- [Testing](#testing)
- [Security & Compliance](#security--compliance)
- [Deployment & CI/CD](#deployment--cicd)
- [Contributing](#contributing)
- [License](#license)

---

## Features

- **Granular Notification Control:** Users can view and toggle opt-out for each payment-related push notification type (e.g., payment success, payment failure, refund processed).
- **Secure & Audited:** All preference changes are securely persisted and immutably logged for compliance.
- **Real-Time Enforcement:** Notification delivery logic respects user opt-out preferences at payment event time.
- **Self-Service UI:** Modern React frontend for managing preferences.
- **Scalable & Reliable:** Designed for millions of users, with transactional integrity and robust error handling.
- **Strict Access Control:** Only authenticated users can view or modify their own preferences.

---

## Architecture Overview

- **Frontend:** React (TypeScript) SPA for user interaction.
- **Backend:** Node.js (Express, TypeScript) REST API.
- **Database:** PostgreSQL (TypeORM models).
- **Event Processing:** Payment event processor checks preferences before sending notifications.
- **Authentication:** JWT-based, enforced on all API endpoints.
- **Audit Logging:** All changes are logged with user ID, timestamp, and notification type; logs are immutable and tamper-evident.
- **Containerization:** Docker Compose for local development.
- **Testing:** Jest for unit/integration tests.

```
[React Frontend] <--> [Express API] <--> [PostgreSQL]
                                 |
                        [Payment Event Processor]
```

---

## Tech Stack

- **Frontend:** React 18+, TypeScript, Axios, React Router
- **Backend:** Node.js 18+, Express 4+, TypeScript, TypeORM
- **Database:** PostgreSQL 13+
- **Testing:** Jest, Supertest
- **DevOps:** Docker, Docker Compose, GitHub Actions (CI/CD)
- **Linting/Formatting:** ESLint, Prettier

---

## Setup & Development

### Prerequisites

- [Docker](https://www.docker.com/get-started)
- [Node.js 18+](https://nodejs.org/) (for local dev outside Docker)
- [Yarn](https://yarnpkg.com/) or [npm](https://www.npmjs.com/)

### Quick Start (Recommended)

1. **Clone the repository:**
   ```bash
   git clone https://github.com/your-org/payment-notification-optout.git
   cd payment-notification-optout
   ```

2. **Copy environment files:**
   ```bash
   cp backend/.env.example backend/.env
   cp frontend/.env.example frontend/.env
   ```

3. **Start all services:**
   ```bash
   docker-compose up --build
   ```

4. **Access the app:**
   - Frontend: [http://localhost:3000](http://localhost:3000)
   - Backend API: [http://localhost:4000/api](http://localhost:4000/api)
   - PostgreSQL: `localhost:5432` (user: `postgres`, password: `postgres`)

### Manual Local Development

- **Frontend:**
  ```bash
  cd frontend
  npm install
  npm start
  ```

- **Backend:**
  ```bash
  cd backend
  npm install
  npm run start:dev
  ```

- **Database:** Use Docker or install PostgreSQL locally.

---

## Environment Variables

### Backend (`backend/.env`)

```
PORT=4000
DB_HOST=postgres
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=postgres
DB_NAME=payment_notifications
JWT_SECRET=changeme
CLIENT_ORIGIN=http://localhost:3000
TYPEORM_SYNC=true
TYPEORM_LOGGING=true
```

### Frontend (`frontend/.env`)

```
REACT_APP_API_BASE_URL=http://localhost:4000/api
```

---

## API Documentation

### Authentication

- All endpoints require a valid JWT in the `Authorization: Bearer <token>` header or `jwt_token` cookie.

### Endpoints

#### `GET /api/notification-preferences`

- **Description:** Get all payment notification types and the current user's opt-out preferences.
- **Auth:** Required
- **Response:**
  ```json
  {
    "notificationTypes": [
      { "id": "payment_success", "name": "Payment Success", "description": "..." },
      ...
    ],
    "userPreferences": [
      { "notificationTypeId": "payment_success", "optedOut": false },
      ...
    ]
  }
  ```

#### `POST /api/notification-preferences`

- **Description:** Update the current user's opt-out preferences.
- **Auth:** Required
- **Body:**
  ```json
  {
    "preferences": [
      { "notificationTypeId": "payment_success", "optedOut": true },
      ...
    ]
  }
  ```
- **Response:**
  ```json
  {
    "success": true,
    "userPreferences": [
      { "notificationTypeId": "payment_success", "optedOut": true },
      ...
    ]
  }
  ```

- **Errors:** Returns clear error messages and never applies partial updates.

---

## Testing

- **Run all tests:**
  ```bash
  cd backend
  npm test
  ```

- **Test coverage:** Unit and integration tests cover API endpoints, business logic, and error handling.

---

## Security & Compliance

- **Authentication:** JWT-based, enforced on all endpoints.
- **Authorization:** Users can only access/modify their own preferences.
- **Audit Logging:** All changes are logged with user ID, timestamp, and notification type. Logs are immutable and tamper-evident.
- **Transactional Integrity:** All preference updates are atomic.
- **Data Privacy:** Preferences are only visible/editable by the authenticated user.
- **GDPR:** Data subject rights can be supported via user/account management endpoints.

---

## Deployment & CI/CD

- **Docker Compose:** For local development.
- **Production:** Use environment-specific `.env` files and set `TYPEORM_SYNC=false` (use migrations).
- **CI/CD:** Integrate with GitHub Actions or similar for automated testing and deployment.

---

## Contributing

1. Fork the repo and create your feature branch (`git checkout -b feature/your-feature`)
2. Commit your changes with clear messages
3. Push to the branch (`git push origin feature/your-feature`)
4. Open a Pull Request

---

## License

[MIT](LICENSE)

---

## Maintainers

- [Your Name](mailto:your.email@example.com)
- [Your Team/Org]

---