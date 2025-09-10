import { Request, Response, NextFunction } from "express";
import { catchAsyncErrors } from "../middleware/catchAsyncErrors";
import ErrorHandler from "../utils/ErrorHandler";
import { v2 as cloudinary } from "cloudinary";
import { createCourse } from "../services/course.service";
import CourseModel from "../models/course.model";
import redis from "../utils/redis"; 


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
});


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