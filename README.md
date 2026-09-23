# MENX - Mobile-First Men's Fashion & Shop Management System

MENX is a production-ready, secure, mobile-first men's fashion e-commerce and retail shop management platform. It bridges physical retail operations and online shopping with a centralized real-time inventory system and a 100% Cash-on-Delivery (COD) checkout workflow.

---

## 👔 Business Overview

- **Product Lines**: 
  - Men's Apparel (Shirts, T-Shirts, Trousers, Jeans, Ethnic & Formal Wear)
  - Men's Accessories (Belts, Wallets, Watches, Sunglasses, Ties, Cufflinks)
  - Footwear & Casual Slippers
  - Curated Full Outfit Combinations (Bundle styling suggestions)
- **Omnichannel Model**: Physical Retail Store + Online Storefront sharing unified central inventory.
- **Payment Method**: **Cash on Delivery (COD) Only** for customers.
- **Primary Customer Experience**: **Mobile-First** (optimized for smartphones, responsive across tablets and desktops).

---

## 🚀 Core Features Planned

| Module | Features & Capabilities |
| :--- | :--- |
| **Customer Storefront** | Mobile-first UI, Product Discovery, Filtering & Sorting, Rich Media, Wishlist, Reviews & Ratings, Outfit Bundles, Related Recommendations |
| **Checkout & Orders** | Streamlined COD-only Checkout, Multi-Address Book, Order Tracking, Status Alerts (SMS/WhatsApp/Email notifications ready) |
| **Returns & Exchanges** | Customer return/exchange requests with reason validation and status tracking |
| **Discounts & Coupons** | Promo codes, minimum order criteria, bundle-specific discounts |
| **Admin & Shop Panel** | Secure Role-Based Access (Superadmin, Store Manager, Staff), Product/Variant CRUD, Barcode generation & scanning |
| **Inventory & Suppliers** | Central real-time stock sync (Retail POS + Online), Low-stock alerts, Supplier purchase orders and receiving logs |
| **Physical Shop / POS Foundation** | In-store billing support, quick barcode lookup, synchronized inventory deduction |
| **Analytics & Auditing** | Sales trends, COD fulfillment rates, return analytics, tamper-proof admin audit logs |

---

## 🛠️ Technology Stack

- **Frontend**: [React.js](https://react.dev/) + [Vite](https://vitejs.dev/) + [Tailwind CSS](https://tailwindcss.com/)
- **Backend API**: [Node.js](https://nodejs.org/) + [Express.js](https://expressjs.com/)
- **Database**: [Supabase PostgreSQL](https://supabase.com/) with Row Level Security (RLS)
- **Authentication**: Supabase Auth (JWT-based session management, RBAC)
- **Object Storage**: Supabase Storage (Secure image/asset storage buckets with size & MIME validation)
- **Deployment Target**:
  - Frontend: [Vercel](https://vercel.com/)
  - Backend: [Render](https://render.com/)

---

## 🔒 Security Highlights

- **Zero Client Credential Leakage**: Supabase `service_role` secret is strictly kept on the backend API server.
- **Database Row Level Security (RLS)**: Enforced directly at the PostgreSQL layer.
- **Server-Side Validation**: Strict request payload schema validation using schemas for every endpoint.
- **Role-Based Authorization**: Protected customer vs staff vs manager vs superadmin routes.
- **Rate Limiting & Protection**: API rate limiting, CORS configuration, helmet headers, and file upload validation.
- **Audit Logging**: Immutable tracking of sensitive admin changes (inventory adjustments, order modifications, pricing).

---

## 📂 Repository Structure

```
MenX/
├── .gitignore                   # Root gitignore for all environments
├── .env.example                 # Root environment variable documentation
├── README.md                    # Project overview and documentation
├── docs/                        # Detailed architectural & planning documentation
│   ├── architecture.md          # System architecture, data flow, & separation of concerns
│   ├── security.md              # Security policies, RLS, auth, and validation guidelines
│   └── development-plan.md      # Phased development roadmap
├── frontend/                    # Customer storefront & Admin SPA (React + Vite + Tailwind)
│   ├── .env.example             # Client-safe environment template
│   ├── package.json             # Frontend dependencies and scripts
│   ├── vite.config.js           # Vite configuration
│   ├── tailwind.config.js       # Tailwind CSS design system config
│   ├── postcss.config.js        # PostCSS setup
│   └── src/                     # Modular component-based frontend source
└── backend/                     # Secure REST API server (Node.js + Express)
    ├── .env.example             # Backend secret & configuration template
    ├── package.json             # Backend dependencies and scripts
    └── src/                     # API architecture (routes, controllers, middlewares, services)
```

---

## 📖 Documentation Index

- [Architecture & Design Document](docs/architecture.md)
- [Security Policy & Guidelines](docs/security.md)
- [Phased Development Plan](docs/development-plan.md)

---

## 🚦 Getting Started

### Prerequisites
- Node.js (v18.x or v20.x LTS)
- npm or pnpm or yarn
- Supabase account & project

### Quick Setup

1. **Clone the repository**:
   ```bash
   git clone <repo-url>
   cd MenX
   ```

2. **Backend Setup**:
   ```bash
   cd backend
   cp .env.example .env
   npm install
   npm run dev
   ```

3. **Frontend Setup**:
   ```bash
   cd ../frontend
   cp .env.example .env
   npm install
   npm run dev
   ```
