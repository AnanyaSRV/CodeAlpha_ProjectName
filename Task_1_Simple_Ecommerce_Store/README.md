# MarketHub - Full-Stack E-Commerce Platform



MarketHub is a full-stack e-commerce platform designed to support customers, vendors, administrators, and delivery partners through a unified shopping and order-management experience.



The application includes product discovery, authentication, cart management, checkout, payment integration, vendor operations, administrative controls, and delivery tracking.



## Features



### Customer

- Browse the product catalogue and view individual product details.

- Register and log in securely.

- Add products to the shopping cart and update quantities.

- Maintain cart data using browser local storage.

- Complete checkout using Razorpay test payments.

- View order history and order details.

- Track delivery progress through an order-status timeline.



### Vendor

- Access a dedicated vendor dashboard.

- Create and manage products.

- View product stock information.

- Manage incoming orders and fulfilment status.



### Administrator

- Access an administrative dashboard.

- View platform overview information.

- Manage users, products, and orders.

- Review vendor applications.

- Manage delivery partner assignments.



### Delivery Partner

- Access a dedicated delivery dashboard.

- View assigned deliveries.

- Update delivery progress through supported status transitions.

- Update orders from shipped to out for delivery and delivered.



## Technology Stack



| Layer | Technologies |

|---|---|

| Frontend | Next.js 16, React 19, TypeScript |

| Styling | Tailwind CSS 4 |

| Backend | NestJS 12, Node.js |

| Database | PostgreSQL |

| ORM | Prisma 7 |

| Authentication | JWT, bcrypt |

| Payments | Razorpay |

| API | REST |



## Project Structure



```text

Task\_1\_Simple\_Ecommerce\_Store/

â”œâ”€â”€ frontend/

â”‚   â”œâ”€â”€ public/

â”‚   â”œâ”€â”€ src/

â”‚   â”œâ”€â”€ package.json

â”‚   â””â”€â”€ .env.example

â”‚

â”œâ”€â”€ backend/

â”‚   â”œâ”€â”€ prisma/

â”‚   â”œâ”€â”€ src/

â”‚   â”œâ”€â”€ prisma.config.ts

â”‚   â”œâ”€â”€ package.json

â”‚   â””â”€â”€ .env.example

â”‚

â””â”€â”€ README.md


