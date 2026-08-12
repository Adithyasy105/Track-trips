# 📚 TripSync (Splitwise) - Master Technical Documentation

> **Comprehensive Engineering & Architectural Reference Guide**  
> *Everything you need to understand, maintain, deploy, and scale the TripSync platform.*

---

## 📋 Table of Contents

1. [Executive Summary & Product Vision](#-executive-summary--product-vision)
2. [Full Technology Stack](#-full-technology-stack)
3. [System Architecture & Data Flow](#-system-architecture--data-flow)
4. [Database Schema & ER Diagrams](#-database-schema--er-diagrams)
5. [Core Algorithms & Business Logic](#-core-algorithms--business-logic)
   - [1. Greedy Debt Simplification Algorithm](#1-greedy-debt-simplification-algorithm)
   - [2. Trip Member Isolation & Safety Guarantee](#2-trip-member-isolation--safety-guarantee)
   - [3. Payment Sync & Settlement State Machine](#3-payment-sync--settlement-state-machine)
   - [4. Category & User Spending Analytics](#4-category--user-spending-analytics)
   - [5. Authentication & Group Security Hashes](#5-authentication--group-security-hashes)
6. [Complete REST API Specification](#-complete-rest-api-specification)
   - [System & Health Check](#system--health-check)
   - [User Authentication & Accounts](#user-authentication--accounts)
   - [Group Management](#group-management)
   - [Trip Management](#trip-management)
   - [Expense Management](#expense-management)
   - [Settlements & Balances](#settlements--balances)
   - [Payments & Transfers](#payments--transfers)
   - [Places Visited / Itinerary](#places-visited--itinerary)
   - [Analytics & Reports](#analytics--reports)
7. [Frontend Architecture & Component Hierarchy](#-frontend-architecture--component-hierarchy)
8. [Environment Configurations & Deployment](#-environment-configurations--deployment)
9. [Security, Performance & Best Practices](#-security-performance--best-practices)

---

## 🌟 Executive Summary & Product Vision

**TripSync** (built as `Splitwise`) is an end-to-end full-stack web application engineered for managing group trip expenses, tracking shared itineraries, calculating optimal debt settlements, and generating visual financial analytics.

### Key Capabilities
- **Multi-Group & Multi-Trip Hierarchy**: Organize users into shared groups (with optional passcode access) and isolate financial tracking to specific trips.
- **Trip-Level Member Isolation**: Restrict expense splits, payment balances, and settlements strictly to members who participated in a specific trip.
- **Dynamic Debt Simplification**: Automatically minimize transaction graph volume across N participants using an optimal greedy matching algorithm.
- **Payment Lifecycle & Verification**: Automated creation of pending payment tasks where only the recipient can confirm completion.
- **Places & Memory Journaling**: Bookmark locations visited during a trip complete with metadata and photo upload to cloud storage.
- **Financial Analytics**: Interactive visual charts detailing spending by participant and expense category.

---

## 🛠️ Full Technology Stack

### Backend Stack
- **Runtime**: Node.js (`v18+` / `v20+`) configured with native **ES Modules** (`"type": "module"`).
- **Framework**: [Express.js](https://expressjs.com/) (v4.18.2) for lightweight HTTP routing.
- **Database Backend**: PostgreSQL managed via [Supabase](https://supabase.com/).
- **Database Client**: `@supabase/supabase-js` (v2.39.0) using the Service Role Key for server-side elevated access.
- **Authentication**: `jsonwebtoken` (v9.0.2) for stateless JWT Bearer token generation and verification.
- **Password Hashing**: Native `crypto` (PBKDF2 with 10,000 iterations & unique random salt) / `bcryptjs`.
- **Validation Engine**: [Zod](https://zod.dev/) (v3.22.4) for runtime request parameter, body, and schema validation.
- **File & Media Handling**: `multer` (v1.4.5-lts.1) utilizing memory storage buffers for photo processing.
- **Email Service**: `nodemailer` (v6.9.7) for reset password verification codes.
- **CORS & Middleware**: `cors` (v2.8.5), `dotenv` (v16.3.1).

### Frontend Stack
- **Framework**: [React](https://reactjs.org/) (v18.2.0) bootstrapped with Create React App.
- **Routing**: `react-router-dom` (v6.20.1) supporting client-side routing, query parameter parsing, and protected route wrappers.
- **Styling**: [Tailwind CSS](https://tailwindcss.com/) (v3.3.6) with `postcss` (v8.4.32) & `autoprefixer` (v10.4.16).
- **Icons & UI Utilities**: `lucide-react` (v0.294.0), `@heroicons/react` (v2.1.1), `clsx`, `tailwind-merge`.
- **Data Visualization**: [Recharts](https://recharts.org/) (v2.10.3) for Responsive Pie, Bar, and Cell rendering.
- **Animations**: `framer-motion` (v10.16.16) for seamless transitions and modal interactions.
- **HTTP Client**: `axios` (v1.6.2) with centralized request interceptors attaching authorization headers.
- **Notifications**: `react-hot-toast` (v2.4.1).

---

## 🏗️ System Architecture & Data Flow

```
                                  +-----------------------+
                                  |     Vercel Edge       |
                                  | (React SPA Frontend)  |
                                  +-----------+-----------+
                                              |
                                      HTTPS / REST API
                                              |
                                              v
                                  +-----------------------+
                                  |    Render Web App     |
                                  | (Express Node Server) |
                                  +-----------+-----------+
                                              |
                                +-------------+-------------+
                                |                           |
                                v                           v
                     +--------------------+       +--------------------+
                     |  Supabase Postgres |       | Supabase Storage   |
                     | (Relational DB)    |       | ("places-photos")  |
                     +--------------------+       +--------------------+
```

### Request Flow Overview
1. **Authentication**: User submits credentials to `/api/users/login`. Backend returns a signed JWT containing `{ username, email }` valid for 7 days.
2. **State Storage**: Frontend `AuthContext` stores the JWT token in `localStorage` and injects it into all outbound requests via Axios interceptors.
3. **Trip Context Operations**: When a user selects a trip, the app fetches trip details, member lists, expenses, settlements, payments, and places.
4. **Calculations**: All debt calculation, member filtering, and settlement optimizations are processed on-demand in backend controllers to guarantee data consistency.

---

## 🗄️ Database Schema & ER Diagrams

The database schema is defined in `supabase/schema.sql` and designed for PostgreSQL.

```
                      +-------------------+
                      |       users       |
                      +-------------------+
                      | PK username       |
                      |    email          |
                      |    full_name      |
                      |    password_hash  |
                      |    created_at     |
                      +---------+---------+
                                |
        +-----------------------+-----------------------+
        | 1                                             | 1
        v M                                             v M
+-------+-----------+                           +-------+-----------+
|   group_members   |                           |      groups       |
+-------------------+                           +-------------------+
| PK group_id (FK)  |                           | PK id (UUID)      |
| PK username (FK)  |                           |    name           |
|    joined_at      |                           |    password_hash  |
+---------+---------+                           | FK created_by     |
          ^                                     |    created_at     |
          |                                     +---------+---------+
          |                                               |
          +-------------------------+---------------------+ 1
                                    |                       
                                    v M                     
                            +-------+-----------+           
                            |       trips       |           
                            +-------------------+           
                            | PK id (UUID)      |           
                            | FK group_id       |           
                            |    name, location |           
                            |    start/end_date |           
                            | FK created_by     |           
                            +---------+---------+           
                                      |                     
        +-----------------------------+-----------------------------+
        | 1                           | 1                           | 1
        v M                           v M                           v M
+-------+-----------+         +-------+-----------+         +-------+-----------+
|   trip_members    |         |     expenses      |         |  places_visited   |
+-------------------+         +-------------------+         +-------------------+
| PK trip_id (FK)   |         | PK id (UUID)      |         | PK id (UUID)      |
| PK username (FK)  |         | FK trip_id        |         | FK trip_id        |
|    added_at       |         | FK payer_username |         | FK created_by     |
+-------------------+         |    amount, desc   |         |    name, photo_url|
                              |    category       |         |    location       |
                              |    participants[] |         |    visited_time   |
                              +-------------------+         +-------------------+
                                      |
                                      | 1
                                      v M
                              +-------+-----------+
                              |     payments      |
                              +-------------------+
                              | PK id (UUID)      |
                              | FK trip_id        |
                              | FK from_username  |
                              | FK to_username    |
                              |    amount, status |
                              |    created_at     |
                              |    completed_at   |
                              +-------------------+
```

### Table Definitions & Specifications

#### 1. `users`
- `username` (`VARCHAR(50)`, **PRIMARY KEY**)
- `email` (`VARCHAR(255)`, **UNIQUE**, **NOT NULL**)
- `full_name` (`VARCHAR(255)`)
- `password_hash` (`VARCHAR(255)`)
- `created_at` (`TIMESTAMP`, Default `NOW()`)

#### 2. `groups`
- `id` (`UUID`, **PRIMARY KEY**, Default `gen_random_uuid()`)
- `name` (`VARCHAR(255)`, **NOT NULL**)
- `password_hash` (`VARCHAR(255)`, Nullable — optional group passcode protection)
- `created_by` (`VARCHAR(50)`, Foreign Key -> `users(username)` ON DELETE CASCADE)
- `created_at` (`TIMESTAMP`, Default `NOW()`)

#### 3. `group_members`
- `group_id` (`UUID`, Foreign Key -> `groups(id)` ON DELETE CASCADE)
- `username` (`VARCHAR(50)`, Foreign Key -> `users(username)` ON DELETE CASCADE)
- `joined_at` (`TIMESTAMP`, Default `NOW()`)
- **Composite Primary Key**: `(group_id, username)`

#### 4. `trips`
- `id` (`UUID`, **PRIMARY KEY**, Default `gen_random_uuid()`)
- `group_id` (`UUID`, Foreign Key -> `groups(id)` ON DELETE CASCADE, **NOT NULL**)
- `name` (`VARCHAR(255)`, **NOT NULL**)
- `location` (`VARCHAR(255)`)
- `start_date` (`DATE`)
- `end_date` (`DATE`)
- `description` (`TEXT`)
- `created_by` (`VARCHAR(50)`, Foreign Key -> `users(username)` ON DELETE SET NULL)
- `created_at` (`TIMESTAMP`, Default `NOW()`)
- `updated_at` (`TIMESTAMP`, Default `NOW()`)

#### 5. `trip_members`
- `trip_id` (`UUID`, Foreign Key -> `trips(id)` ON DELETE CASCADE)
- `username` (`VARCHAR(50)`, Foreign Key -> `users(username)` ON DELETE CASCADE)
- `added_at` (`TIMESTAMP`, Default `NOW()`)
- **Composite Primary Key**: `(trip_id, username)`

#### 6. `expenses`
- `id` (`UUID`, **PRIMARY KEY**, Default `gen_random_uuid()`)
- `trip_id` (`UUID`, Foreign Key -> `trips(id)` ON DELETE CASCADE, **NOT NULL**)
- `payer_username` (`VARCHAR(50)`, Foreign Key -> `users(username)` ON DELETE CASCADE, **NOT NULL**)
- `amount` (`DECIMAL(10, 2)`, **NOT NULL**, `CHECK (amount > 0)`)
- `description` (`TEXT`)
- `category` (`VARCHAR(50)`)
- `participants` (`TEXT[]`, **NOT NULL** — PostgreSQL array storing usernames involved in the expense)
- `timestamp` (`TIMESTAMP`, Default `NOW()`)

#### 7. `places_visited`
- `id` (`UUID`, **PRIMARY KEY**, Default `gen_random_uuid()`)
- `trip_id` (`UUID`, Foreign Key -> `trips(id)` ON DELETE CASCADE, **NOT NULL**)
- `created_by` (`VARCHAR(50)`, Foreign Key -> `users(username)` ON DELETE SET NULL)
- `name` (`VARCHAR(255)`, **NOT NULL**)
- `description` (`TEXT`)
- `photo_url` (`TEXT`)
- `location` (`VARCHAR(255)`)
- `visited_time` (`TIMESTAMP`, Default `NOW()`)

#### 8. `payments`
- `id` (`UUID`, **PRIMARY KEY**, Default `gen_random_uuid()`)
- `trip_id` (`UUID`, Foreign Key -> `trips(id)` ON DELETE CASCADE, **NOT NULL**)
- `from_username` (`VARCHAR(50)`, Foreign Key -> `users(username)` ON DELETE CASCADE, **NOT NULL**)
- `to_username` (`VARCHAR(50)`, Foreign Key -> `users(username)` ON DELETE CASCADE, **NOT NULL**)
- `amount` (`DECIMAL(10, 2)`, **NOT NULL**, `CHECK (amount > 0)`)
- `status` (`VARCHAR(20)`, Default `'pending'`) — values: `'pending'`, `'completed'`
- `created_by` (`VARCHAR(50)`, Foreign Key -> `users(username)` ON DELETE SET NULL)
- `created_at` (`TIMESTAMP`, Default `NOW()`)
- `completed_at` (`TIMESTAMP`, Nullable)

---

## 🧮 Core Algorithms & Business Logic

### 1. Greedy Debt Simplification Algorithm
Located in `settlementController.js` and `paymentsController.js`.

The goal of this algorithm is to minimize total financial transactions needed to settle all debts for a trip.

#### Mathematical Steps:
1. **Initialize Member Balances**:
   Construct a hash table for all valid trip members:
   $$\text{balance}[u] = \{\text{paid}: 0, \text{owes}: 0, \text{net}: 0\}$$

2. **Compute Total Paid and Owed per Expense**:
   For each valid expense $E$ with total amount $A$, payer $P$, and participants list $S = [u_1, u_2, \dots, u_k]$:
   $$\text{share} = \frac{A}{k}$$
   $$\text{balance}[P].\text{paid} \leftarrow \text{balance}[P].\text{paid} + A$$
   $$\forall u \in S: \quad \text{balance}[u].\text{owes} \leftarrow \text{balance}[u].\text{owes} + \text{share}$$

3. **Compute Initial Net Balance**:
   $$\text{net}[u] = \text{balance}[u].\text{paid} - \text{balance}[u].\text{owes}$$

4. **Factor Completed Payments**:
   For each payment marked as `status = 'completed'` with amount $M$ from $D$ (debtor) to $C$ (creditor):
   $$\text{net}[D] \leftarrow \text{net}[D] + M$$
   $$\text{net}[C] \leftarrow \text{net}[C] - M$$

5. **Partition and Sort Creditors & Debtors**:
   - Creditors: $C = \{ u \mid \text{net}[u] > +0.01 \}$ sorted descending by $\text{net}[u]$.
   - Debtors: $D = \{ u \mid \text{net}[u] < -0.01 \}$ sorted descending by $|\text{net}[u]|$.

6. **Greedy Matching Loop**:
   Using two pointers ($i$ for creditors, $j$ for debtors):
   $$\text{settleAmount} = \min(C[i].\text{amount}, D[j].\text{amount})$$
   Record transaction: $D[j].\text{username} \longrightarrow C[i].\text{username} : \text{settleAmount}$
   $$C[i].\text{amount} \leftarrow C[i].\text{amount} - \text{settleAmount}$$
   $$D[j].\text{amount} \leftarrow D[j].\text{amount} - \text{settleAmount}$$
   Advance $i$ when $C[i].\text{amount} < 0.01$; advance $j$ when $D[j].\text{amount} < 0.01$.

---

### 2. Trip Member Isolation & Safety Guarantee
To prevent group members who did *not* join a specific trip from affecting trip totals:
- The system fetches `trip_members` for `trip_id`.
- Construct a set $M_{\text{trip}} = \{ \text{username} \mid \text{username} \in \text{trip\_members} \}$.
- Filter expenses: Any expense where `payer_username` $\notin M_{\text{trip}}$ or any participant $p \notin M_{\text{trip}}$ is excluded from calculations.
- Filter response payload: Strict sanitization removes any user keys not in $M_{\text{trip}}$.

---

### 3. Payment Sync & Settlement State Machine
1. When `/api/payments/trip/:trip_id` is queried, `syncPendingPaymentsForTrip()` executes automatically.
2. The server runs the Greedy Debt Simplification Algorithm on current expenses minus completed payments.
3. All existing `pending` payments for that trip are deleted and recalculated to reflect latest expenses.
4. Existing `completed` payments are retained unless a `hard` reset is explicitly invoked (`POST /api/payments/trip/:trip_id/reset` with `{ "mode": "hard" }`).
5. Only the receiver (`to_username`) has permission to transition a payment from `pending` to `completed` via `PATCH /api/payments/:id/complete`.

---

### 4. Category & User Spending Analytics
1. Aggregates valid trip expenses by payer:
   $$\text{TotalSpent}[u] = \sum E.\text{amount} \quad \forall E \text{ where } E.\text{payer} = u$$
2. Aggregates expenses by category (e.g., *Food, Transport, Accommodation, Entertainment, Uncategorized*):
   $$\text{CategorySpent}[c] = \sum E.\text{amount} \quad \forall E \text{ where } E.\text{category} = c$$
3. Calculates metric summaries: Total Spent, Total Expense Count, and Average Expense Cost ($\frac{\text{TotalSpent}}{\text{ExpenseCount}}$).

---

### 5. Authentication & Group Security Hashes
- **Passwords**: Hashed with salt prior to DB persistence.
- **Group Access Control**: Groups can be created with an optional passcode. When a non-member attempts to join via passcode, `comparePassword()` verifies the provided code against `groups.password_hash`.
- **Invite Tokens**: `generateInvite` signs a JWT containing `{ group_id, exp }` valid for 48 hours. Users can join seamlessly using `/join?token=...`.

---

## 📡 Complete REST API Specification

### Base URL
- Production: `https://track-trips.onrender.com/api`
- Development: `http://localhost:5000/api`

---

### System & Health Check

#### `GET /`
- **Description**: Lightweight health check string endpoint.
- **Auth**: None
- **Response (200 OK)**: `"✅ TripSync backend running"`

#### `GET /health`
- **Description**: JSON health status for monitoring services.
- **Auth**: None
- **Response (200 OK)**:
```json
{
  "status": "ok",
  "timestamp": "2026-07-23T13:00:00.000Z",
  "service": "TripSync Backend"
}
```

---

### User Authentication & Accounts

#### `POST /api/users/register`
- **Description**: Creates a new user account.
- **Auth**: None
- **Validation Schema**: Zod `register`
- **Request Body**:
```json
{
  "username": "johndoe",
  "email": "john@example.com",
  "password": "securepassword123",
  "full_name": "John Doe"
}
```
- **Response (201 Created)**:
```json
{
  "message": "User registered successfully",
  "user": {
    "username": "johndoe",
    "email": "john@example.com",
    "full_name": "John Doe"
  },
  "token": "<JWT_TOKEN>"
}
```

#### `POST /api/users/login`
- **Description**: Authenticates user and returns JWT token.
- **Auth**: None
- **Request Body**:
```json
{
  "username": "johndoe",
  "password": "securepassword123"
}
```
- **Response (200 OK)**:
```json
{
  "message": "Login successful",
  "token": "<JWT_TOKEN>",
  "user": {
    "username": "johndoe",
    "email": "john@example.com",
    "full_name": "John Doe"
  }
}
```

#### `GET /api/users/me`
- **Description**: Fetches current user profile from token.
- **Auth**: Required (`Bearer <JWT>`)
- **Response (200 OK)**:
```json
{
  "username": "johndoe",
  "email": "john@example.com",
  "full_name": "John Doe",
  "created_at": "2026-01-01T00:00:00.000Z"
}
```

#### `GET /api/users`
- **Description**: List all registered users (for user search/invite).
- **Auth**: Required

#### `POST /api/users/forgot-password`
- **Description**: Generates password reset token & sends email.

#### `POST /api/users/reset-password`
- **Description**: Resets user password using reset token.

---

### Group Management

#### `POST /api/groups/create`
- **Auth**: Required
- **Request Body**:
```json
{
  "name": "Summer Vacation 2026",
  "password": "optionalGroupPasscode"
}
```
- **Response (201 Created)**: Returns created group details and automatically adds creator as first member.

#### `POST /api/groups/join`
- **Auth**: Required
- **Request Body**:
```json
{
  "group_id": "uuid-here",
  "password": "passcodeIfRequired"
}
```

#### `GET /api/groups/my-groups`
- **Auth**: Required
- **Response (200 OK)**: Returns array of groups the current user belongs to, including `has_password: true/false`.

#### `GET /api/groups/:group_id/members`
- **Auth**: Required
- **Response (200 OK)**: Returns list of members in group.

#### `POST /api/groups/:group_id/invite`
- **Auth**: Required
- **Response (200 OK)**: Generates signed 48h invite token URL for quick group joining.

#### `DELETE /api/groups/:group_id/members`
- **Auth**: Required
- **Request Body**: `{ "username": "usertoremove" }`

#### `DELETE /api/groups/:group_id`
- **Auth**: Required (Group Creator Only)

---

### Trip Management

#### `POST /api/trips`
- **Auth**: Required
- **Request Body**:
```json
{
  "group_id": "uuid-group-id",
  "name": "Paris & Rome Trip",
  "location": "Europe",
  "start_date": "2026-06-01",
  "end_date": "2026-06-15",
  "description": "Euro trip with friends"
}
```

#### `GET /api/trips/group/:group_id`
- **Auth**: Required
- **Response (200 OK)**: List of all trips associated with group.

#### `GET /api/trips/:id`
- **Auth**: Required
- **Response (200 OK)**: Single trip details.

#### `GET /api/trips/:id/members`
- **Auth**: Required
- **Response (200 OK)**: List of users joined to this specific trip.

#### `POST /api/trips/:id/members`
- **Auth**: Required
- **Request Body**: `{ "username": "friend1" }`

#### `DELETE /api/trips/:id/members`
- **Auth**: Required
- **Request Body**: `{ "username": "friend1" }`

---

### Expense Management

#### `POST /api/expenses`
- **Auth**: Required
- **Request Body**:
```json
{
  "trip_id": "uuid-trip-id",
  "amount": 150.50,
  "description": "Group Dinner at Bistro",
  "category": "Food",
  "participants": ["johndoe", "alice", "bob"]
}
```

#### `GET /api/expenses/trip/:trip_id`
- **Auth**: Required
- **Response (200 OK)**: Array of expenses for trip sorted by timestamp.

#### `DELETE /api/expenses/:expense_id`
- **Auth**: Required

---

### Settlements & Balances

#### `GET /api/settlements/trips/:trip_id`
- **Auth**: Required
- **Response (200 OK)**:
```json
{
  "balances": {
    "johndoe": { "paid": 150.50, "owes": 50.16, "net": 100.34 },
    "alice": { "paid": 0.00, "owes": 50.17, "net": -50.17 },
    "bob": { "paid": 0.00, "owes": 50.17, "net": -50.17 }
  },
  "settlements": [
    { "from": "alice", "to": "johndoe", "amount": 50.17 },
    { "from": "bob", "to": "johndoe", "amount": 50.17 }
  ],
  "summary": {
    "total_expenses": 150.50,
    "total_expenses_count": 1
  }
}
```

---

### Payments & Transfers

#### `GET /api/payments/trip/:trip_id`
- **Auth**: Required
- **Description**: Triggers automatic settlement sync and returns list of payment records (`pending` and `completed`).

#### `POST /api/payments`
- **Auth**: Required
- **Request Body**: `{ "trip_id": "...", "from_username": "alice", "to_username": "johndoe", "amount": 50.17 }`

#### `PATCH /api/payments/:id/complete`
- **Auth**: Required (Only receiver `to_username` can execute)
- **Response (200 OK)**: Marks payment status as `completed` with timestamp.

#### `POST /api/payments/trip/:trip_id/reset`
- **Auth**: Required
- **Request Body**: `{ "mode": "soft" }` or `{ "mode": "hard" }`

---

### Places Visited / Itinerary

#### `POST /api/places`
- **Auth**: Required
- **Content-Type**: `multipart/form-data`
- **Form Fields**: `trip_id`, `name`, `description`, `location`, `photo` (File buffer up to 5MB).
- **Behavior**: Uploads image to Supabase Storage bucket `places-photos` and saves entry.

#### `GET /api/places/trip/:trip_id`
- **Auth**: Required

---

### Analytics & Reports

#### `GET /api/analytics/trips/:trip_id`
- **Auth**: Required
- **Response (200 OK)**:
```json
{
  "summary": {
    "total_expenses": 450.00,
    "total_expenses_count": 3,
    "average_expense": 150.00
  },
  "spending_per_user": {
    "johndoe": 300.00,
    "alice": 150.00
  },
  "spending_by_category": {
    "Food": 200.00,
    "Transport": 250.00
  },
  "chart_data": {
    "users": [
      { "name": "johndoe", "value": 300.00 },
      { "name": "alice", "value": 150.00 }
    ],
    "categories": [
      { "name": "Food", "value": 200.00 },
      { "name": "Transport", "value": 250.00 }
    ]
  }
}
```

---

## 💻 Frontend Architecture & Component Hierarchy

```
frontend/src/
├── App.js                  # Main Router setup with Protected Routes & Layout
├── index.js                # React Root Renderer
├── index.css               # Tailwind CSS directives & global animations
├── context/
│   ├── AuthContext.js      # Global User Auth state, login/logout, token storage
│   └── ThemeContext.js     # Dark/Light mode theme provider
├── services/
│   └── api.js              # Axios instance with auth interceptor & helper methods
├── pages/
│   ├── Landing.js          # Marketing landing page
│   ├── Login.js            # Login form
│   ├── Register.js         # Registration form
│   ├── ResetPassword.js    # Password reset handler
│   ├── Dashboard.js        # Groups list, trip summaries, quick group creation
│   ├── GroupDetail.js      # Single Group view: trips list, password update, member manage
│   ├── TripDetail.js       # Main Trip Hub with tabbed UI
│   └── InviteJoin.js       # Automatic token-based group join page
└── components/
    ├── Layout.js           # Navigation header, sidebar, dark mode toggle
    ├── ProtectedRoute.js   # Authorization guard
    ├── CreateGroupModal.js # Modal for creating groups with passcodes
    ├── CreateTripModal.js  # Modal for adding trips to groups
    ├── JoinGroupModal.js   # Modal for joining existing group by ID & passcode
    └── trips/
        ├── AddExpenseModal.js # Form to post expense with participant checklist
        ├── AddPlaceModal.js   # Form with photo upload for visited places
        ├── AnalyticsTab.js    # Recharts charts for users & categories
        ├── ExpensesTab.js     # List of expenses with delete actions
        ├── MembersTab.js      # Add/remove trip participants
        ├── PaymentsTab.js     # List payments & mark completed button
        ├── PlacesTab.js       # Gallery cards of places visited
        ├── SettlementsTab.js  # Optimized debt graph cards (who owes whom)
        └── SpendingTab.js     # Individual spending summaries
```

---

## ⚙️ Environment Configurations & Deployment

### Environment Variables Matrix

| Variable Name | Environment | Purpose | Example / Required Format |
|---|---|---|---|
| `PORT` | Backend | Port express server listens on | `5000` or `10000` |
| `SUPABASE_URL` | Backend | URL of Supabase Project | `https://xxxx.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | Backend | Supabase Admin Service Key | `eyJhbGciOi...` (Secret) |
| `JWT_SECRET` | Backend | Secret used to sign JWTs | Min 32 random characters |
| `NODE_ENV` | Backend | Environment flag | `production` or `development` |
| `REACT_APP_API_URL` | Frontend | Base URL of backend REST API | `https://track-trips.onrender.com/api` |

---

### Deployment Architecture
- **Backend Deployment**: Render (`Node.js` environment, root dir `Splitwise/backend`, build `npm install`, start `npm start`).
- **Frontend Deployment**: Vercel (`Create React App` preset, root dir `Splitwise/frontend`, build `npm run build`, output `build`).
- **Database & Storage**: Supabase Postgres database with storage bucket `places-photos` set to public access.

---

## 🔒 Security, Performance & Best Practices

1. **Service Role Key Security**: `SUPABASE_SERVICE_ROLE_KEY` is kept exclusively on the backend server and never exposed to the React bundle.
2. **Database Indexing**: SQL schema includes indexed foreign keys on `group_members(group_id)`, `trips(group_id)`, `expenses(trip_id)`, `expenses(payer_username)`, `places_visited(trip_id)`, and `trip_members(trip_id, username)` to guarantee high query throughput.
3. **Array Data Integrity**: Expenses store participant lists as PostgreSQL `TEXT[]` native arrays, matching array queries directly.
4. **Memory Management**: Multer handles image uploads in-memory without temporary disk reads/writes, direct streaming to Supabase Storage bucket.
5. **Form & Data Validation**: Zod middleware sanitizes incoming requests before hitting controller business logic, preventing malformed payload crashes.

---
*Documentation generated for TripSync Codebase. Last updated: July 2026.*
