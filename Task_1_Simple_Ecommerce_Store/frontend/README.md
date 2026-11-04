# MarketHub Frontend

This directory contains the frontend application for MarketHub, a full-stack e-commerce platform.

## Technology Stack

- Next.js 16
- React 19
- TypeScript
- Tailwind CSS 4

## Features

- Product catalogue and product details
- Customer registration and login
- Shopping cart and checkout
- Payment integration
- Customer account and order history
- Order tracking
- Vendor dashboard
- Administrator dashboard
- Delivery partner dashboard

## Setup

Install dependencies:

npm install

Create `.env.local` using `.env.example`.

Configure the backend API URL:

NEXT_PUBLIC_API_URL="http://localhost:4000"

## Run Development Server

npm run dev

Open http://localhost:3000 in your browser.

## Available Commands

- npm run dev - Start development server
- npm run build - Build production application
- npm run start - Start production server
- npm run lint - Run ESLint

## Backend Connection

The frontend communicates with the MarketHub NestJS backend, which runs by default at http://localhost:4000.