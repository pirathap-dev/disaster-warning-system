# Disaster Warning & Emergency Coordination System

A university full-stack web application designed for a group implementation project.

## 1. Project Overview

This project is a centralized platform for disaster warning and emergency coordination. The application is divided into a robust backend architecture and a responsive frontend interface. 

The project has been architected to support parallel development by four developers, with isolated domains that share a common foundation (authentication, UI components, error handling).

The four main modules are:
1. **Module 1**: Submit & Verify Disaster Ground Report
2. **Module 2**: Assess Hazard & Issue Public Warning
3. **Module 3**: Coordinate Evacuation & Rescue Team
4. **Module 4**: Coordinate Shelter & Relief Supply Distribution

## 2. Technology Stack

### Frontend
- React 18
- Vite
- TypeScript
- Tailwind CSS
- React Router DOM
- Vitest & React Testing Library (Testing)

### Backend
- Node.js
- Express
- TypeScript
- MongoDB & Mongoose
- Jest & Supertest (Testing)

## 3. Folder Structure

```
/
├── client/                 # Frontend React Application
│   ├── src/
│   │   ├── components/     # Shared UI components (Buttons, Cards, etc.)
│   │   ├── layouts/        # Application layout shells
│   │   ├── pages/          # Feature specific pages
│   │   ├── lib/            # Utilities (e.g. tailwind class merger)
│   │   ├── types/          # Frontend domain types
│   │   └── tests/          # Unit tests
├── server/                 # Backend Node.js Application
│   ├── src/
│   │   ├── config/         # Database and env configuration
│   │   ├── controllers/    # Route handlers
│   │   ├── middleware/     # Error handling & Validation
│   │   ├── models/         # Mongoose schemas
│   │   ├── routes/         # Express routers
│   │   ├── types/          # Shared domain types
│   │   └── tests/          # API & Unit tests
├── package.json            # Root configuration for concurrent execution
└── README.md
```

## 4. Local Setup

### Prerequisites
- Node.js (v18+ recommended)
- MongoDB (Running locally on default port `27017` or a cloud URI)

### Installation
From the root directory, run:
```bash
npm install
cd client && npm install
cd ../server && npm install
```

## 5. Environment Variables

Create `.env` files in both the `client` and `server` directories based on the provided examples.

**`server/.env`:**
```env
PORT=5000
NODE_ENV=development
MONGO_URI=mongodb://localhost:27017/disaster_management_dev
```

**`client/.env`:**
```env
VITE_API_URL=http://localhost:5000/api
```

## 6. Database Setup

Ensure MongoDB is running locally. The server is configured to connect to `mongodb://localhost:27017/disaster_management_dev` by default. Seed data scripts will be added later for easy onboarding.

## 7. Running the Application

To run both the frontend and backend concurrently from the root directory:
```bash
npm run dev
```

- **Frontend** runs on `http://localhost:5173`
- **Backend** runs on `http://localhost:5000`

## 8. Running Tests

To run tests for both client and server:
```bash
npm run test
```

To run coverage for both:
```bash
npm run test:coverage
```

## 9. Running Lint

To verify code quality:
```bash
npm run lint
```

## 10. How Developers Should Create Feature Branches

Use a clear naming convention for feature branches to avoid conflicts:
- `feature/module-1/ground-reports`
- `feature/module-2/hazard-warnings`
- `feature/module-3/rescue-teams`
- `feature/module-4/shelter-management`

Ensure branches are tested and pass CI checks before creating Pull Requests to the `main` or `develop` branch.

## 11. How New Modules Should Integrate

- **UI Components:** Do not reinvent basic inputs or buttons. Use the shared components in `client/src/components/ui`.
- **Database Models:** Keep Mongoose models inside `server/src/models`. Reference the shared `User` schema where necessary.
- **Routing:** Add new feature routes to `server/src/app.ts` using the provided placeholder comments. Add frontend routes to `client/src/App.tsx`.
- **Types:** Centralize shared interfaces in `server/src/types` and `client/src/types` to ensure consistent data contracts across the application.
