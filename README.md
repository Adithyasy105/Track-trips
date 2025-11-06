# Splitwise - Group Trip Expense Splitter

A modern, full-featured expense splitting application for group trips, built with React, Node.js, Express, and Supabase.

## Features

### Backend
- ✅ JWT Authentication
- ✅ User registration and login
- ✅ Group creation with optional password protection
- ✅ Multiple trips per group
- ✅ Expense tracking with participants
- ✅ Settlement calculations (who owes whom)
- ✅ Places visited with photo uploads
- ✅ Analytics and charts
- ✅ Input validation with Zod
- ✅ Error handling middleware

### Frontend
- ✅ Modern, responsive UI with Tailwind CSS
- ✅ Dark/Light theme toggle
- ✅ Dashboard with groups and trips
- ✅ Trip detail page with tabs:
  - Expenses (list and add)
  - Members
  - Places visited
  - Analytics (charts)
  - Settlements
- ✅ Smooth animations with Framer Motion
- ✅ Toast notifications

## Setup Instructions

### Backend Setup

1. Navigate to backend directory:
```bash
cd backend
```

2. Install dependencies:
```bash
npm install
```

3. Create a `.env` file in the backend directory:
```env
PORT=5000
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
JWT_SECRET=your_jwt_secret_key
```

4. Run the database schema:
   - Go to your Supabase dashboard
   - Navigate to SQL Editor
   - Run the SQL from `supabase/schema.sql`

5. Create a storage bucket in Supabase:
   - Go to Storage in Supabase dashboard
   - Create a bucket named `places-photos`
   - Make it public if you want photos to be accessible

6. Start the backend server:
```bash
npm run dev
```

### Frontend Setup

1. Navigate to frontend directory:
```bash
cd frontend
```

2. Install dependencies:
```bash
npm install
```

3. Create a `.env` file in the frontend directory:
```env
REACT_APP_API_URL=http://localhost:5000/api
```

4. Start the frontend development server:
```bash
npm start
```

## API Endpoints

### Authentication
- `POST /api/users/register` - Register new user
- `POST /api/users/login` - Login user
- `GET /api/users/me` - Get current user (protected)

### Groups
- `POST /api/groups/create` - Create group (protected)
- `POST /api/groups/join` - Join group (protected)
- `GET /api/groups/my-groups` - Get user's groups (protected)
- `GET /api/groups/:group_id/members` - Get group members (protected)

### Trips
- `POST /api/trips` - Create trip (protected)
- `GET /api/trips/group/:group_id` - Get trips for group (protected)
- `GET /api/trips/:id` - Get trip by ID (protected)
- `PUT /api/trips/:id` - Update trip (protected)
- `DELETE /api/trips/:id` - Delete trip (protected)

### Expenses
- `POST /api/expenses` - Add expense (protected)
- `GET /api/expenses/trip/:trip_id` - Get trip expenses (protected)
- `DELETE /api/expenses/:expense_id` - Delete expense (protected)

### Settlements
- `GET /api/settlements/trips/:trip_id` - Get trip settlements (protected)

### Places
- `POST /api/places` - Add place (protected, multipart/form-data)
- `GET /api/places/trip/:trip_id` - Get trip places (protected)
- `PUT /api/places/:place_id` - Update place (protected)
- `DELETE /api/places/:place_id` - Delete place (protected)

### Analytics
- `GET /api/analytics/trips/:trip_id` - Get trip analytics (protected)

## Project Structure

```
Splitwise/
├── backend/
│   ├── src/
│   │   ├── controllers/
│   │   ├── middleware/
│   │   ├── routes/
│   │   ├── services/
│   │   └── utils/
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   ├── context/
│   │   ├── pages/
│   │   ├── services/
│   │   └── App.js
│   └── package.json
└── supabase/
    └── schema.sql
```

## Technologies Used

### Backend
- Node.js
- Express.js
- Supabase (PostgreSQL)
- JWT for authentication
- Zod for validation
- Multer for file uploads

### Frontend
- React
- React Router
- Tailwind CSS
- Axios
- Recharts
- Framer Motion
- React Hot Toast
- Lucide React (icons)

## 🚀 Deployment

**Ready to deploy?** Follow these guides in order:

1. **👉 [PRE_DEPLOYMENT_SETUP.md](./PRE_DEPLOYMENT_SETUP.md)** - **Start here!** 
   - Install all dependencies
   - Set up environment files
   - Verify Git configuration
   - Test local builds

2. **👉 [DEPLOYMENT.md](./DEPLOYMENT.md)** - Complete deployment guide:
   - **Backend**: Render (Node.js/Express)
   - **Frontend**: Vercel (React)
   - Supabase database setup
   - Environment variables configuration
   - Troubleshooting tips
   - Security checklist

3. **👉 [DEPLOYMENT_CHECKLIST.md](./DEPLOYMENT_CHECKLIST.md)** - Quick checklist to track progress

4. **👉 [DEPLOYMENT_SUMMARY.md](./DEPLOYMENT_SUMMARY.md)** - Quick reference guide

5. **👉 [KEEP_SERVER_AWAKE.md](./KEEP_SERVER_AWAKE.md)** - Keep Render server active 24/7 (free solutions)

## Notes

- All protected routes require a valid JWT token in the Authorization header
- The frontend automatically handles token storage and refresh
- Make sure to set up your Supabase project and configure the storage bucket for photo uploads
- Update the API URL in frontend `.env` if your backend runs on a different port
