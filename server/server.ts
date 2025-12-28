import  app  from "./app";
import dotenv from "dotenv";
import connectDB from "./utils/db";
import { v2 as cloudinary } from "cloudinary";
import { VercelRequest, VercelResponse } from "@vercel/node";



dotenv.config();

cloudinary.config({
  cloud_name: process.env.CLOUD_NAME,
  api_key: process.env.CLOUD_API_KEY,
  api_secret: process.env.CLOUD_API_SECRET,
});

const PORT = process.env.PORT || 5000;

export default function handler(req: VercelRequest, res: VercelResponse) {
  app(req, res);
}

connectDB();
