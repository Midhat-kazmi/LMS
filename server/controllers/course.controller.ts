import { Request, Response, NextFunction } from "express";
import { catchAsyncErrors } from "../middleware/catchAsyncErrors";
import ErrorHandler from "../utils/ErrorHandler";
import { v2 as cloudinary } from "cloudinary";
import { createCourse } from "../services/course.service";
import CourseModel from "../models/course.model";
import redis from "../utils/redis";
import mongoose from "mongoose";
import NotificationModel from "../models/notification.model";

// import {getAllCoursesService}  from "../services/course.service";


export const uploadCourse = catchAsyncErrors(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = req.body;
      const thumbnail = data.thumbnail;

      if (!thumbnail)
        return next(new ErrorHandler("Please provide a thumbnail image", 400));

      console.log("Uploading thumbnail...");

      const myCloud = await cloudinary.uploader.upload(thumbnail, {
        folder: "courses",
      });

      console.log("Cloudinary result:", myCloud);

      data.thumbnail = {
        public_id: myCloud.public_id,
        url: myCloud.secure_url,
      };

      console.log("Saving course...");

      await createCourse(data, res, next);
    } catch (error: any) {
      console.error("UploadCourse Error:", error);
      return next(new ErrorHandler(error.message, 500));
    }
  }
);

export const editCourse = catchAsyncErrors(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = req.body;
      const courseId = req.params.id;

      const course = await CourseModel.findById(courseId);
      if (!course) {
        return next(new ErrorHandler("Course not found", 404));
      }

      const thumbnail = data.thumbnail;

      if (thumbnail) {
        // Case A: Base64 → upload new one
        if (!thumbnail.startsWith("http")) {
          if (course.thumbnail?.public_id) {
            try {
              await cloudinary.uploader.destroy(course.thumbnail.public_id);
            } catch (destroyErr) {
              console.error("Cloudinary destroy error:", destroyErr);
            }
          }

          try {
            const uploaded = await cloudinary.uploader.upload(thumbnail, {
              folder: "courses",
            });
            data.thumbnail = {
              public_id: uploaded.public_id,
              url: uploaded.secure_url,
            };
          } catch (uploadErr: any) {
            console.error("Cloudinary upload error:", uploadErr);
            return next(
              new ErrorHandler(
                uploadErr.message || "Failed to upload new thumbnail",
                500
              )
            );
          }
        }

        // Case B: Existing URL → keep current public_id
        if (thumbnail.startsWith("http")) {
          data.thumbnail = {
            public_id: course.thumbnail?.public_id || "",
            url: course.thumbnail?.url || thumbnail,
          };
        }
      } else {
        // No thumbnail sent → don’t overwrite existing
        delete data.thumbnail;
      }

      const updatedCourse = await CourseModel.findByIdAndUpdate(
        courseId,
        { $set: data },
        { new: true }
      );

      res.status(200).json({
        success: true,
        course: updatedCourse,
      });
    } catch (error: any) {
      console.error("EditCourse Error:", error);
      return next(
        new ErrorHandler(error.message || "Internal Server Error", 500)
      );
    }
  }
);

export const getSingleCourse = catchAsyncErrors(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const courseId = req.params.id;

      if (!courseId) {
        return next(new ErrorHandler("Course ID is required", 400));
      }

      // Only MongoDB (no Redis at all)
      const course = await CourseModel.findById(courseId).select(
        "-courseData.videoUrl -courseData.suggestion -courseData.questions -courseData.links"
      );

      if (!course) {
        return next(new ErrorHandler("Course not found", 404));
      }

      return res.status(200).json({
        success: true,
        source: "db",
        course,
      });
    } catch (error: any) {
      console.error("getSingleCourse error:", error);
      return next(
        new ErrorHandler(error.message || "Internal Server Error", 500)
      );
    }
  }
);

export const getAllCoursesAdmin = catchAsyncErrors(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      getAllCoursesServiceLocal(res);
    } catch (error: any) {
      return next(new ErrorHandler(error.message, 400));
    }
  }
);
export const getCourseByUser = catchAsyncErrors(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userCourseList = req.user?.courses;
      const courseId = req.params.id;

      const courseExist = userCourseList?.find(
        (course: any) => course._id.toString() === courseId.toString()
      );

      if (!courseExist) {
        return next(
          new ErrorHandler("You are not eligible to access this course.", 404)
        );
      }

      const course = await CourseModel.findById(courseId);
      const content = course?.courseData;

      res.status(200).json({
        success: true,
        access_token: res.locals.access_token, // comes from middleware
        content,
      });
    } catch (error: any) {
      return next(new ErrorHandler(error.message, 500));
    }
  }
);

export const getAllCoursesServiceLocal = async (res: Response) => {
  const courses = await CourseModel.find().sort({ createdAt: -1 });
  res.status(200).json({
    success: true,
    courses,
  });
};



//add question in course
interface IAddQuestionData {
  question: string;
  courseId: string;
  contentId: string;
}
export const addQuestionToCourse = catchAsyncErrors(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { question, courseId, contentId }: IAddQuestionData = req.body;

      // Find course
      const course = await CourseModel.findById(courseId);
      if (!course) {
        return next(new ErrorHandler("Course not found.", 404));
      }

      // Validate contentId
      if (!mongoose.Types.ObjectId.isValid(contentId)) {
        return next(new ErrorHandler("Invalid content id.", 400));
      }

      const courseContent = course?.courseData.find((content: any) =>
        content._id.equals(contentId)
      );
      if (!courseContent) {
        return next(new ErrorHandler("Content not found.", 404));
      }

      // Build new question
      const newQuestion: any = {
        user: req.user,
        question,
        questionReplies: [],
      };

      // Push question
      courseContent.questions.push(newQuestion);

      // Create notification
      await NotificationModel.create({
        user: req.user?._id,
        title: "New Question Received",
        message: `You have a new question in ${courseContent?.title}`,
      });

      // Save updated course
      await course.save();

      // Respond with course + new access token
      res.status(200).json({
        success: true,
        access_token: res.locals.access_token, // from refreshAccessToken middleware
        course,
      });
    } catch (error: any) {
      return next(new ErrorHandler(error.message, 500));
    }
  }
);
