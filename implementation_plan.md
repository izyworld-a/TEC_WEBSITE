# Transition TEC Weekly Platform to a Full System

We are building a comprehensive, gamified task and attendance tracking system using **React (via Vite)** and **Firebase**.

## Confirmed Features & Rules

### 1. Reward & Point System
Points calculate automatically based on these rules:
- **Evidence:** +1 point for *each* goal that has submitted evidence.
- **Wednesday Meeting:** +1 point for attending (via Secret Code).
- **Sunday Meeting:** +1 point for attending (via Secret Code).
- **Early Bird (Setting):** +1 bonus point for being the *very first* person system-wide to submit their goals for the new week.
- **Early Bird (Completion):** +3 bonus points for being the *very first* person system-wide to complete all their weekly set goals.

### 2. Punishment System
At the end of the week, accounts are evaluated based on total points:
- **Warning:** If a user gets < 5 points, their profile shows a prominent warning/notification of impending suspension.
- **Suspension:** If a user gets < 2 points, their account is automatically suspended (preventing them from setting new goals until an admin intervenes).

### 3. User Profile Management
Users will have a dedicated profile section where they can:
- **Upload a Profile Picture:** Stored securely via Firebase Storage.
- **Update Personal Info:** Update their display name and physical address.

### 4. Admin Approval Workflow (New Signups)
- When a new user creates an account, their status is set to **Pending**.
- They can log in, but they will be locked out of the dashboard with a message: *"Waiting for Admin Approval."*
- An Admin must log into the Admin Dashboard, review the pending user, and manually **Approve** them before their account becomes **Active**.

### 5. Live Public Progress Dashboard (Landing Page)
- **First Page:** When anyone visits the site, the very first page they see is the Live Feed.
- **Design:** Features accountability icons and a blurred background image for a premium feel.
- **Privacy & Display Rules:** To protect privacy, the live feed will **ONLY** show a user's:
  - Profile Picture
  - Display Name
  - Star Rating (calculated based on their total points)
  - Current week's progress bar
- **Top Performer:** The highest-rated user of the week will be prominently featured.

### 6. Design
A premium, highly animated interface with a built-in **Light/Dark Theme Toggle**.

### 7. User Accounts & Authentication
- Integrate Firebase Authentication (Email & Password).

## Technical Implementation

### Database Structure (Firestore)

**Collection: `users`**
- `uid`, `name`, `email`, `totalPoints`, `totalCompletedTasks`, `isAdmin`
- `status`: **"Pending"** | "Active" | "Warning" | "Suspended"
- `profilePicUrl`: URL to their uploaded image
- `address`: User's physical address

**Collection: `weekly_goals`**
- `userId`, `userName`, `profilePicUrl`, `weekId`, `submittedAt`, `updatedAt`, `progress`, `pointsEarned`
- `tasks`: Array (description, status, penalty, proof, evidence URL)
- `isFirstToSet`: Boolean
- `isFirstToComplete`: Boolean

**Collection: `attendance_sessions` (Admin creates these)**
- `sessionId`, `secretCode`, `dayOfWeek`, `isActive`

**Collection: `attendance_records` (Users checking in)**
- `userId`, `sessionId`, `timestamp`

### Component Architecture (React + Vite)
1. **Landing / Live Community Dashboard (`/`)**: Real-time progress bars, blurred background, top performer.
2. **Login/Register (`/login`)**
3. **Pending Approval Page (`/pending`)**: Shown if user status is "Pending".
4. **User Dashboard (`/dashboard`)**: Profile Management (Pic, Name, Address), Goal Form, Progress Bar, Attendance Check-in widget, Suspension Warnings.
5. **Admin Dashboard (`/admin`)**: Approve new users, create attendance sessions, view all data, manage suspensions.

## Verification Plan
1. **Signup Workflow:** Register a new user, verify they cannot access the dashboard, log in as admin, approve the user, and verify the user can now access the dashboard.
2. **Profile Updates:** Test uploading an image, changing name/address, and verify it updates in Firestore and the UI.
3. **Live Feed Privacy:** Ensure that an address entered in the profile does *not* appear on the public live feed.
4. **Points & Suspensions:** Test a user getting <2 points and ensure they are locked out.
