# Backend Directory Architecture

This backend follows standard clean layered architectural separation:
- **`config/`**: Supabase client singleton, environment variable loaders, system constants.
- **`controllers/`**: HTTP request handlers that orchestrate input parsing, service execution, and standard responses.
- **`middlewares/`**: Authentication (Supabase JWT), RBAC role checks, rate limiting, payload validation (Zod), and error interception.
- **`routes/`**: Express route declarations mounted onto `/api/v1`.
- **`services/`**: Pure business logic (order processing, inventory calculation, bundle pricing, return validation).
- **`utils/`**: AppError classes, async wrappers, logger, and formatting helpers.
