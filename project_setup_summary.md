# Disaster Warning & Emergency Coordination System - Foundation Architecture

The project foundation has been successfully built according to the specified requirements. The environment is prepared with a modern Monorepo-like structure with isolated Client and Server workspaces, fully configured for immediate development by the four feature developers.

## Final Folder Structure

```
/
├── client/                     # Frontend Application
│   ├── public/
│   ├── src/
│   │   ├── components/         # Shared Reusable UI Components
│   │   │   └── ui/             # Button, Card, Input, Select, Modal, Table, Badge, Toast, Loading, Empty/Error states
│   │   ├── layouts/            # Application layout shells (Sidebar, Header)
│   │   ├── pages/              # Module placeholder pages
│   │   ├── lib/                # Shared utilities (Tailwind merges)
│   │   ├── tests/              # Frontend testing setup and test cases
│   │   ├── App.tsx             # React Router setup
│   │   └── main.tsx            # Application Entry Point
│   ├── package.json            # Client dependencies and scripts
│   ├── vite.config.ts          # Vite configuration
│   └── tailwind.config.js      # Tailwind UI design tokens
├── server/                     # Backend API Server
│   ├── src/
│   │   ├── config/             # DB & environment configuration
│   │   ├── controllers/        # Request handlers (e.g., health.ts)
│   │   ├── middleware/         # Centralized error handling
│   │   ├── models/             # Mongoose schemas (e.g., User.ts)
│   │   ├── routes/             # Express API routes
│   │   ├── types/              # Centralized domain TypeScript interfaces
│   │   ├── tests/              # Backend integration tests
│   │   ├── app.ts              # Express App setup (cors, helmet, routes)
│   │   └── index.ts            # Server entry point
│   ├── package.json            # Server dependencies and scripts
│   └── jest.config.js          # Backend Jest configuration
├── package.json                # Root package for concurrent module execution
└── README.md                   # Onboarding documentation
```

## Technologies Used

**Frontend (Client):**
- React 18, Vite
- TypeScript
- Tailwind CSS
- React Router DOM
- Lucide React (Icons)
- Vitest & JSdom (Testing)

**Backend (Server):**
- Node.js & Express
- TypeScript
- MongoDB & Mongoose
- Cors, Helmet, Morgan (Middleware)
- Jest & Supertest (Testing)
- Concurrent execution (Dev tool)

## Essential Commands

These commands can be run from the **root directory** of the project:

- **Run Application**: `npm run dev` (Starts frontend and backend concurrently in dev mode)
- **Start Application**: `npm start` (Starts both applications normally)
- **Production Build**: `npm run build` (Builds both client and server)
- **Run All Tests**: `npm run test` (Runs both client and server tests)
- **Run Test Coverage**: `npm run test:coverage` (Generates coverage reports)
- **Run Linting**: `npm run lint`

## Environment Variables Required

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

## How Developers Should Extend the Project

The platform is designed to minimize merge conflicts and encourage code reuse:

1. **Shared Domain Entities**: Before creating a model in `server/src/models`, ensure its TypeScript interface is defined in `server/src/types/index.ts`. All 4 developers must refer to these common types.
2. **Reusable UI Components**: All primitive components (Buttons, Inputs, Modals, Toasts) are isolated in `client/src/components/ui/`. Developers should **not** write raw HTML/Tailwind for common buttons. They should import and use the standard `<Button />`, `<Card />`, etc.
3. **Module Isolation**: Each module has its own dedicated page folder under `client/src/pages/`. Developers should do their work in their respective namespaces.
4. **Error Handling**: Do not write `try/catch` with raw `res.status(500)` in backend controllers. Ensure to pass errors to the `next(error)` function which is picked up by the global error middleware in `server/src/middleware/error.ts`.
5. **Database Connections**: The connection script is located at `server/src/config/db.ts`. Do not establish separate DB connections in your module; import models normally using Mongoose's unified connection.

## List of Files Created/Modified

- **Root**: `package.json`, `.gitignore`, `README.md`
- **Client Root**: `package.json`, `vite.config.ts`, `tailwind.config.js`, `postcss.config.js`, `tsconfig.json`, `tsconfig.node.json`, `index.html`, `.gitignore`, `.env.example`
- **Client Code**: `src/index.css`, `src/main.tsx`, `src/App.tsx`, `src/lib/utils.ts`
- **Client Layouts**: `src/layouts/AppLayout.tsx`, `Sidebar.tsx`, `Header.tsx`
- **Client Pages**: `src/pages/Dashboard.tsx`, `GroundReports.tsx`, `Warnings.tsx`, `RescueCoordination.tsx`, `ShelterRelief.tsx`
- **Client Components**: `src/components/ui/Button.tsx`, `Input.tsx`, `Select.tsx`, `Modal.tsx`, `Card.tsx`, `Table.tsx`, `Badge.tsx`, `Loading.tsx`, `ErrorState.tsx`, `EmptyState.tsx`, `Toast.tsx`
- **Client Tests**: `src/tests/setup.ts`, `src/tests/utils.test.ts`
- **Server Root**: `package.json`, `tsconfig.json`, `jest.config.js`, `.gitignore`, `.env.example`
- **Server Code**: `src/index.ts`, `src/app.ts`, `src/config/db.ts`, `src/types/index.ts`, `src/models/User.ts`, `src/middleware/error.ts`, `src/routes/health.ts`, `src/controllers/health.ts`
- **Server Tests**: `src/tests/health.test.ts`
