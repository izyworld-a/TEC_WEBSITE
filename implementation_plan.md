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

### 2. Punishment & Wallet System
At the end of the week, accounts are evaluated based on total points and wallet balance:
- **Wallet Requirement:** Users must maintain a minimum wallet balance of ₦1,000 to remain active.
- **Financial Penalty:** If a user earns < 5 points in a week, a ₦1,000 penalty is deducted from their wallet.
- **Warning:** If a user gets < 5 points, their profile shows a prominent warning/notification of impending suspension.
- **Suspension:** If a user gets < 2 points OR their wallet drops below ₦1,000, their account is automatically suspended (preventing them from setting new goals until an admin intervenes).

### 3. Weekly Deadlines & Notifications
- **Goal Setting Deadline:** Users must set their weekly goals before this time.
- **Completion Deadline:** Users must upload proof and update statuses before this time.
- **Notifications:** Active deadlines are displayed in a dropdown via the bell icon in the main navigation.
- **Admin Control:** Admins can set, update, or cancel individual deadlines from the Weekly Settings tab.

### 4. User Profile Management
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

### 6. Design & New Home Page Structure
A premium, highly animated interface with a built-in **Light/Dark Theme Toggle**.
A new dedicated **Home Page** will be the entry point for the application. Its sections will include:
- **Hero Section:** Value proposition and "Get Started" CTA.
- **Stats Bar:** Quick statistics like "30+ Active", "2 Deadlines".
- **Features Grid:** Highlighting the Penalty System, Rewards, and Admin Review.
- **Progress Preview:** A visual sneak-peak of the tracking components.
- **How It Works:** A 4-step guide (Set Goals -> Submit Proof -> Admin Review -> Earn Rewards).
- **CTA Banner & Contact Form:** Final push for signups and a way to reach the team.

### 7. User Accounts & Authentication
- Integrate Firebase Authentication (Email & Password).

> [!IMPORTANT]
> **User Review Required: Terms & Conditions Workflow**
> Please review the proposed method for capturing the user's signature. I plan to add a scrollable box containing the full T&C text directly into the `Register.jsx` form. The user will be required to type their exact "Full Name" into a "Signature" input field and check the agreement box before the "Sign Up" button activates. Does this workflow align with your expectations?

### 8. Terms and Conditions Signing (Registration Workflow)
New users must read and digitally sign the "Execution Circle Membership Agreement" before they can successfully register an account.
- The full T&C text will be displayed in a scrollable, read-only box within the Registration view.
- A "Digital Signature" text field will require the user to type their exact Full Name. add a field with a brush or pen to sign the agreement.
- A checkbox to acknowledge the terms must be checked.
- Only when both conditions are met will the "Sign Up" button become active.

## Proposed UI & Routing Changes
- **Rename/Move `LandingPage.jsx`** to `LiveFeedPage.jsx` and change its route to `/livefeed`.
- **Create `HomePage.jsx`** to match the new design mockup.
- **Update `App.jsx` Routing:**
  - Route `/` maps to `HomePage`.
  - Route `/livefeed` maps to `LiveFeedPage`.
- **Navigation Update:**
  - "Get Started" logic: If logged out, go to `/login`. If logged in, go to `/livefeed`.

## Technical Implementation

### Database Structure (Firestore)

**Collection: `users`**
- `uid`, `name`, `email`, `totalPoints`, `totalCompletedTasks`, `isAdmin`
- `status`: **"Pending"** | "Active" | "Warning" | "Suspended"
- `profilePicUrl`: URL to their uploaded image
- `address`: User's physical address
- `walletBalance`: Current financial balance (must be >= 1000)

**Collection: `weekly_goals`**
- `userId`, `userName`, `profilePicUrl`, `weekId`, `submittedAt`, `updatedAt`, `progress`, `pointsEarned`
- `tasks`: Array (description, status, penalty, proof, evidence URL)
- `isFirstToSet`: Boolean
- `isFirstToComplete`: Boolean

**Collection: `attendance_sessions` (Admin creates these)**
- `sessionId`, `secretCode`, `dayOfWeek`, `isActive`

**Collection: `week_settings`**
- `weekId`: Setup deadline, completion deadline, bonusAwarded flag.

**Collection: `attendance_records` (Users checking in)**
- `userId`, `sessionId`, `timestamp`

### Component Architecture (React + Vite)
1. **Home Page (`/`)**: A new landing page designed to attract new users. Features a hero section, features grid, "how it works" steps, and a contact form. "Get Started" redirects to Login/Signup or LiveFeed if authenticated.
2. **LiveFeed Page (`/livefeed`)**: The former landing page. Real-time community progress bars, top performer, and active stats.
3. **Login/Register (`/login`, `/register`)**
4. **Pending Approval Page (`/pending`)**: Shown if user status is "Pending".
5. **User Dashboard (`/dashboard`)**: Profile Management, Goal Form, Progress Bar, Attendance Check-in widget, Suspension Warnings.
6. **Admin Dashboard (`/admin`)**: Approve new users, create attendance sessions, manage weekly settings and deadlines, run evaluations.

## Verification Plan
1. **Signup Workflow:** Register a new user, verify they cannot access the dashboard, log in as admin, approve the user, and verify the user can now access the dashboard.
2. **Profile Updates:** Test uploading an image, changing name/address, and verify it updates in Firestore and the UI.
3. **Live Feed Privacy:** Ensure that an address entered in the profile does *not* appear on the public live feed.
4. **Points & Suspensions:** Test a user getting <2 points and ensure they are locked out.
