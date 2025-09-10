import mongoose from "mongoose";
import dotenv from "dotenv";

dotenv.config();

const dbUrl = process.env.DB_URI;

if (!dbUrl) {
  throw new Error(" DB_URI is missing from .env");
}

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(dbUrl);
    console.log(` MongoDB connected: ${conn.connection.host}`);
  } catch (error) {
    console.error(" Error in DB connection:", error);
    setTimeout(connectDB, 5000); // retry after 5 sec
  }
};

export default connectDB;
