
# CodeAlpha Internship Projects

A collection of projects developed as part of the **CodeAlpha Internship Program**.

This repository contains the following tasks:

1. Simple E-Commerce Store
2. Social Media Platform

---

# Task 1: Simple E-Commerce Store

**Project:** MarketHub

A full-stack e-commerce platform designed to provide an online shopping experience with product browsing, shopping cart functionality, user accounts and order management.

### Technology Stack

- Frontend: Next.js 16, React 19, TypeScript, Tailwind CSS 4
- Backend: NestJS 12, TypeScript
- Database: PostgreSQL
- ORM: Prisma ORM 7
- Authentication: JWT and bcrypt
- Payment Integration: Razorpay

### Project Structure

```text
Task_1_Simple_Ecommerce_Store/
├── frontend/
├── backend/
└── README.md
```

### Features

- Product catalogue and product browsing
- User authentication
- Shopping cart functionality
- Vendor-related functionality
- Order management
- Payment integration

For setup instructions and further details, refer to the Task 1 README.

---

# Task 2: Social Media Platform

**Project:** Folio

Folio is a mini social media platform where users can create profiles, share posts, interact with other users and build connections.

### Technology Stack

- Frontend: HTML5, CSS3, JavaScript
- Backend: Node.js and Express.js 5
- Database: SQLite
- Database Library: better-sqlite3
- Authentication: express-session and bcryptjs
- Image Uploads: Multer

### Features

**User Authentication**
- User registration and login
- Password hashing
- Session-based authentication
- Logout functionality

**User Profiles**
- Individual user profiles
- Profile editing
- Profile pictures and bios
- Followers and following lists

**Posts and Interactions**
- Create text and image posts
- Like and unlike posts
- Comment on posts
- Delete your own posts

**Social Features**
- Follow and unfollow users
- Discover and search for users
- For You, Following and Latest feeds

**Additional Features**
- Save and remove bookmarked posts
- Dedicated Saved Posts page
- Notifications for likes, comments and new followers
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
├── .gitignore
└── README.md
```

---

## Internship

**Program:** CodeAlpha Internship

**Repository:** CodeAlpha Internship Projects

Each task is maintained in its own directory with its respective source code and documentation.
