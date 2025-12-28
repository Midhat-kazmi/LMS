import type { VercelRequest, VercelResponse } from "@vercel/node";
import app from "../server/app";
import connectDB from "../server/utils/db";

let isConnected = false;

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  if (!isConnected) {
    await connectDB();
    isConnected = true;
  }

  return app(req, res);
}
