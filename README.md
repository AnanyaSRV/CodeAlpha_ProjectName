
# CodeAlpha Internship Projects

A collection of projects developed as part of the **CodeAlpha Internship Program**.

This repository contains the following tasks:

1. Simple E-Commerce Store
2. Social Media Platform
3. Collaborative Project Management Platform — TaskFlow
---


# CodeAlpha Internship Projects

A collection of full-stack applications developed as part of my CodeAlpha Internship Program. This repository showcases projects involving web development, backend engineering, databases, authentication, and interactive application features.

## Projects

1. **Simple E-Commerce Store — MarketHub**
2. **Social Media Platform — Folio**
3. **Collaborative Project Management Platform — TaskFlow**

---

# Task 1: Simple E-Commerce Store

## Project: MarketHub

MarketHub is a full-stack e-commerce platform designed to provide an online shopping experience with product browsing, shopping cart functionality, user accounts, vendor features, order management, and payment integration.

### Technology Stack

- **Frontend:** Next.js 16, React 19, TypeScript, Tailwind CSS 4
- **Backend:** NestJS 12, TypeScript
- **Database:** PostgreSQL
- **ORM:** Prisma ORM 7
- **Authentication:** JWT and bcrypt
- **Payment Integration:** Razorpay

### Features

- Product catalogue and product browsing
- User authentication
- Shopping cart functionality
- Vendor-related functionality
- Order management
- Payment integration

### Project Structure

```text
Task_1_Simple_Ecommerce_Store/
├── frontend/
├── backend/
└── README.md
```

For setup instructions and further details, refer to the Task 1 README.

---

# Task 2: Social Media Platform

## Project: Folio

Folio is a mini social media platform where users can create profiles, share posts, interact with other users, and build connections.

### Technology Stack

- **Frontend:** HTML5, CSS3, JavaScript
- **Backend:** Node.js and Express.js 5
- **Database:** SQLite
- **Database Library:** better-sqlite3
- **Authentication:** express-session and bcryptjs
- **Image Uploads:** Multer

### Features

#### User Authentication
- User registration and login
- Password hashing
- Session-based authentication
- Logout functionality

#### User Profiles
- Individual user profiles
- Profile editing
- Profile pictures and bios
- Followers and following lists

#### Posts and Interactions
- Create text and image posts
- Like and unlike posts
- Comment on posts
- Delete your own posts

#### Social Features
- Follow and unfollow users
- Discover and search for users
- For You, Following, and Latest feeds

#### Additional Features
- Save and remove bookmarked posts
- Dedicated Saved Posts page
- Notifications for likes, comments, and new followers
- Mark individual notifications as read
- Mark all notifications as read

### Project Structure

```text
Task_2_Social_Media_Platform/
├── database/
│   └── database.js
├── routes/
│   ├── auth.js
│   ├── posts.js
│   ├── users.js
│   └── social.js
├── public/
│   ├── css/
│   ├── js/
│   ├── uploads/
│   ├── index.html
│   ├── login.html
│   ├── register.html
│   ├── profile.html
│   ├── discover.html
│   ├── saved.html
│   └── notifications.html
├── server.js
├── package.json
└── README.md
```

### Running the Project

Navigate to the Task 2 directory:

```bash
cd Task_2_Social_Media_Platform
```

Install dependencies:

```bash
npm install
```

Start the development server:

```bash
npm run dev
```

Open the application at:

```text
http://localhost:3000
```

---

# Task 3: Collaborative Project Management Platform

## Project: TaskFlow

TaskFlow is a full-stack collaborative project management application inspired by tools such as Trello and Asana. It helps teams organize projects, manage tasks, coordinate workloads, track progress, and collaborate through project boards and task-level communication.

### Technology Stack

- **Frontend:** Next.js, React, TypeScript, Tailwind CSS
- **Backend:** Node.js, Express.js, TypeScript
- **Database:** PostgreSQL
- **ORM:** Prisma
- **Authentication:** JWT-based authentication
- **Real-time Communication:** Socket.IO
- **AI Integration:** Gemini-powered project assistance

### Features

#### Authentication & Project Management
- User registration and login
- Project creation and management
- Collaborative project workspaces
- Project team and member management

#### Task Management
- Create and assign tasks
- Task status management
- Priority levels
- Task comments and activity
- Task dependencies
- Timeline-based task tracking

#### Team Collaboration
- Project team management
- Task assignment
- Task-related communication
- Real-time notifications

#### Workload Intelligence
- Workload insights
- Team task distribution
- Task prioritization
- Project progress visibility

#### AI-Powered Features
- AI-assisted task breakdown
- Project-aware AI assistant
- Contextual project and task assistance
- AI-generated recommendations and insights

#### Dashboard
- Project and task overview
- Task statistics and visualizations
- Smart Insights
- Focus Next task prioritization

### Project Structure

```text
Task_2_TaskFlow/
├── frontend/
│   ├── src/
│   │   ├── app/
│   │   ├── components/
│   │   └── lib/
│   ├── public/
│   ├── package.json
│   └── ...
│
├── backend/
│   ├── prisma/
│   │   ├── migrations/
│   │   └── schema.prisma
│   ├── src/
│   │   ├── config/
│   │   ├── middleware/
│   │   ├── routes/
│   │   ├── services/
│   │   ├── types/
│   │   └── utils/
│   ├── package.json
│   └── ...
│
└── .gitignore
```

### Running the Project

TaskFlow contains separate frontend and backend applications.

Install the backend dependencies:

```bash
cd Task_2_TaskFlow/backend
npm install
```

Install the frontend dependencies:

```bash
cd ../frontend
npm install
```

Configure the required environment variables for the backend and frontend before running the application. Refer to each application's configuration and package scripts for the available development commands.

---

# Repository Structure

```text
CodeAlpha_ProjectName/
│
├── Task_1_Simple_Ecommerce_Store/
│   ├── frontend/
│   ├── backend/
│   └── README.md
│
├── Task_2_Social_Media_Platform/
│   ├── database/
│   ├── routes/
│   ├── public/
│   ├── server.js
│   ├── package.json
│   └── README.md
│
├── Task_2_TaskFlow/
│   ├── frontend/
│   ├── backend/
│   └── .gitignore
│
├── .gitignore
└── README.md
```

---

## Internship

**Program:** CodeAlpha Internship

**Repository:** CodeAlpha Internship Projects

Each project is maintained in its own directory with its respective source code and documentation.

---
