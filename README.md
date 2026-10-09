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
npm install --prefix client
npm install --prefix server
```

## 5. Environment Variables

Create `.env` files in both the `client` and `server` directories based on the provided examples.

**`server/.env`:**
```env
PORT=5000
NODE_ENV=development
MONGO_URI=mongodb://localhost:27017/disaster_management_dev
ENABLE_TEST_ACCESS=true
```

**`client/.env`:**
```env
VITE_API_URL=http://localhost:5000/api
VITE_ENABLE_TEST_ACCESS=true
```

The shelter and relief module can also use the defaults above if these files are
not created. `createdBy` is entered on the allocation form because this project
does not yet have authentication middleware or a signed-in user context.

## 6. Database Setup

Ensure MongoDB is running locally. The server is configured to connect to `mongodb://localhost:27017/disaster_management_dev` by default.

To load idempotent demonstration shelters and inventory records for the Shelter
& Relief screen, run this from the project root after MongoDB is running:
```bash
npm --prefix server run seed
```
The general shelter and inventory seed records are inserted when missing. When
`ENABLE_TEST_ACCESS=true` in `development` or `demo` mode, the same command also
creates/refreshes the test-only accounts and linked sample workflow records.

## Demo Test Access

With both test-access flags enabled and the server running in `development` or
`demo` mode, open `http://localhost:5173/test-access`. Choose a role to create a
normal signed-in session, or use the floating **TEST MODE** role selector to
switch accounts. Test accounts have no usable password; the existing real login
and its credential checks are unchanged.

Test usernames:
- Citizen: `citizen.test@dwecs.local`
- Volunteer: `volunteer.test@dwecs.local`
- DMC Duty Officer: `dmcofficer.test@dwecs.local`
- District Officer: `districtofficer.test@dwecs.local`
- Rescue Team: `rescueteam.test@dwecs.local`
- Shelter Coordinator: `sheltercoordinator.test@dwecs.local`
- Resource Organization: `resourceorg.test@dwecs.local`

The seed links the rescue account to its team and the shelter coordinator
account to its shelter. Test identities use an unusable password hash, and the
normal backend role/ownership checks still apply.

To turn test access off, set `ENABLE_TEST_ACCESS=false` or remove it from
`server/.env`, and set `VITE_ENABLE_TEST_ACCESS=false` or remove it from
`client/.env`; restart/rebuild the respective processes. The test-login endpoint
returns `404` unless the server flag is `true` and `NODE_ENV` is exactly
`development` or `demo`. Demo tokens are rejected after the flag is turned off.
Production-mode frontend builds do not expose the page even if the Vite flag is
accidentally set.

Before final release, keep both flags off and remove the `TestAccess` page and
route, `TestModeBar`, `/api/auth/test-login`, `AuthService.testLogin`, the
test-access config/claim handling, and the `seedTestAccessData` fixture block
and tests. Keep the ordinary login, registration, and authorization code.

## 7. Running the Application

To run both the frontend and backend concurrently from the root directory:
```bash
npm run dev
```

- **Frontend** runs on `http://localhost:5173`
- **Backend** runs on `http://localhost:5000`
- **Shelter API:**
  - `GET /api/shelters` and `GET /api/shelters/:id` return capacity, occupancy percentage, available capacity, and derived capacity status.
  - `GET /api/relief-resources` returns current resource stock.
  - `POST /api/relief-allocations` accepts `shelterId`, `resourceId`, `requestedQuantity`, `createdBy`, and optional `notes`. A successful allocation starts as `ALLOCATED` and atomically reserves inventory.
  - `GET /api/relief-allocations` supports optional `shelterId`, `resourceId`, and `status` filters; `GET /api/relief-allocations/:id` returns allocation details.
  - `PATCH /api/relief-allocations/:id/status` advances valid non-receipt transitions; `PATCH /api/relief-allocations/:id/receipt` confirms the delivered quantity.
- **Allocation lifecycle:** `REQUESTED → ALLOCATED → DISPATCHED → RECEIVED → COMPLETED`; a `REQUESTED` allocation may instead be cancelled. Receipt confirmation records the delivered amount and performs the `DISPATCHED → RECEIVED` transition.
- **Coordinator workspace:** use the Shelter Coordinator tab on the Shelter & Relief screen to view deliveries and confirm receipts

The application uses a shared login session and role-aware routes. Backend
authorization remains authoritative; the demo test-access feature does not
grant privileges beyond the selected seeded account's role.

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
