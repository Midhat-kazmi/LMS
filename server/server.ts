import app from "./app";
import dotenv from "dotenv";
import connectDB from "./utils/db";
import { v2 as cloudinary } from "cloudinary";
import type { VercelRequest, VercelResponse } from "@vercel/node";

dotenv.config();

/* Cloudinary config */
cloudinary.config({
  cloud_name: process.env.CLOUD_NAME,
  api_key: process.env.CLOUD_API_KEY,
  api_secret: process.env.CLOUD_API_SECRET,
});

/* Connect DB once */
connectDB();

/* Local development server */
if (process.env.NODE_ENV !== "production") {
  const PORT = process.env.PORT || 5000;

  app.listen(PORT, () => {
    console.log(`🚀 Server running locally on port ${PORT}`);
  });
}

/* Vercel serverless handler */
export default function handler(req: VercelRequest, res: VercelResponse) {
  app(req, res);
}
