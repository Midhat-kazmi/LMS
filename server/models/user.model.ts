import mongoose, { Document, Model, Schema } from "mongoose";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

const emailRegexPattern: RegExp = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export interface IUser extends Document {
  _id: string;
  name: string;
  email: string;
  password: string;
  avatar: {
    public_id: string;
    url: string;
  };
  role: string;
  isVerified: boolean;
  courses: mongoose.Types.ObjectId[]; // <-- FIXED
  comparePassword: (password: string) => Promise<boolean>;
  SignAccessToken: () => string;
  SignRefreshToken: () => string;
}

const userSchema: Schema<IUser> = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: {
      type: String,
      required: true,
      unique: true,
      validate: {
        validator: (value: string) => emailRegexPattern.test(value),
        message: "Please enter a valid email",
      },
    },
    password: { type: String, minlength: 6, select: false },
    avatar: { public_id: String, url: String },
    role: { type: String, default: "user" },
    isVerified: { type: Boolean, default: false },
    courses: [{ type: mongoose.Schema.Types.ObjectId, ref: "Course", default: [] }],
  },
  { timestamps: true }
);

// Hash password before saving
userSchema.pre<IUser>("save", async function (next) {
  if (!this.isModified("password")) return next();
  this.password = await bcrypt.hash(this.password, 10);
  next();
});

// JWT access token
userSchema.methods.SignAccessToken = function (): string {
  return jwt.sign({ id: this._id }, process.env.ACCESS_TOKEN || "", { expiresIn: "5m" });
};

// JWT refresh token
userSchema.methods.SignRefreshToken = function (): string {
  return jwt.sign({ id: this._id }, process.env.REFRESH_TOKEN || "", { expiresIn: "7d" });
};

// Compare password
userSchema.methods.comparePassword = async function (enteredPassword: string): Promise<boolean> {
  return await bcrypt.compare(enteredPassword, this.password);
};

const userModel: Model<IUser> = mongoose.model("User", userSchema);
export default userModel;
