// api/index.ts
import app from "../server/app"; // import your Express app
import connectDB from "../server/utils/db";

connectDB();

// No app.listen() here — Vercel handles it
export default app;
