import mongoose, { Document, Model, Schema } from "mongoose";
import { IUser } from "./user.model";

// ----------------- Interfaces -----------------
interface IComment extends Document {
  user: IUser;
  question: string;
  questionReplies?: IComment[];
}

interface IReview extends Document {
  user: IUser;
  rating: number;
  comment: string;
  commentReplies: IComment[];
}

interface ILink extends Document {
  title: string;
  url: string;
}

interface ICourseData extends Document {
  title: string;
  description: string;
  videoUrl: string;
  videoThumbnail?: { public_id?: string; url?: string };
  videoSection: string;
  videoLength: number;
  videoPlayer: string;
  links: ILink[];
  suggestions: string;
  questions: IComment[];
}

interface IThumbnail {
  public_id?: string;
  url?: string;
}

export interface ICourse extends Document {
  name: string;
  description: string;
  price: number;
  estimatedPrice?: number;
  thumbnail?: IThumbnail;
  tags: string;
  level: string;
  demoUrl: string;
  benefits: { title: string }[];
  prerequisites: { title: string }[];
  reviews: IReview[];
  courseData: ICourseData[];
  ratings?: number;
  purchased: number;
}

// ----------------- Schemas -----------------
const reviewSchema = new Schema<IReview>(
  {
    user: { type: Object, required: true },
    rating: { type: Number, default: 0 },
    comment: { type: String, required: true },
    commentReplies: [{ type: Object }],
  },
  { timestamps: true }
);

const linkSchema = new Schema<ILink>({
  title: { type: String, required: true },
  url: { type: String, required: true },
});

const commentSchema = new Schema<IComment>(
  {
    user: { type: Object, required: true },
    question: { type: String, required: true },
    questionReplies: [{ type: Object }],
  },
  { timestamps: true }
);

const courseDataSchema = new Schema<ICourseData>({
  videoUrl: { type: String, required: true },
  title: { type: String, required: true },
  videoSection: { type: String, required: true },
  description: { type: String, required: true },
  videoLength: { type: Number, required: true },
  videoPlayer: { type: String, required: true },
  videoThumbnail: {
    public_id: { type: String },
    url: { type: String },
  },
  links: [linkSchema],
  suggestions: { type: String },
  questions: [commentSchema],
});

const courseSchema = new Schema<ICourse>(
  {
    name: { type: String, required: true },
    description: { type: String, required: true },
    price: { type: Number, required: true },
    estimatedPrice: { type: Number },
    thumbnail: {
      public_id: { type: String },
      url: { type: String },
    },
    tags: { type: String, required: true },
    level: { type: String, required: true },
    demoUrl: { type: String, required: true },
    benefits: [{ title: String }],
    prerequisites: [{ title: String }],
    reviews: [reviewSchema],
    courseData: [courseDataSchema],
    ratings: { type: Number, default: 0 },
    purchased: { type: Number, default: 0 },
  },
  { timestamps: true }
);

// ----------------- Model -----------------
const CourseModel: Model<ICourse> = mongoose.model("Course", courseSchema);
export default CourseModel;
