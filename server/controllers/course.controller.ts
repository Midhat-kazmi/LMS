import { Request, Response, NextFunction } from "express";
import { catchAsyncErrors } from "../middleware/catchAsyncErrors";
import ErrorHandler from "../utils/ErrorHandler";
import { v2 as cloudinary } from "cloudinary";
import { createCourse } from "../services/course.service";
import CourseModel from "../models/course.model";
import redis from "../utils/redis";
import mongoose from "mongoose";
import NotificationModel from "../models/notification.model";
import sendEmail from "../utils/sendMail";
import ejs from "ejs";
import path from "path";

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

interface IAddAnswerData {
  answer: string;
  courseId: string;
  contentId: string;
  questionId: string;
}
export const addAnswer = catchAsyncErrors(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const {
        answer,
        courseId,
        contentId,
        questionId,
      }: IAddAnswerData = req.body;
      const course = await CourseModel.findById(courseId);
      if (!mongoose.Types.ObjectId.isValid(contentId)) {
        return next(new ErrorHandler("Invalid content id.", 400));
      }
      const courseContent = course?.courseData.find((content: any) =>
        content._id.equals(contentId)
      );
      if (!courseContent) {
        return next(new ErrorHandler("Content not found.", 404));
      }
      const question = courseContent.questions.find((q: any) =>
        q._id.equals(questionId)
      );
      if (!question) {
        return next(new ErrorHandler("Invalid question Id.", 401));
      }
      //create an answer object
      const newAnswer: any = {
        user: req.user,
        answer,
        createdAt:new Date().toISOString(),
        updatedAt:new Date().toISOString(),
      };
      question?.questionReplies?.push(newAnswer);

      await course?.save();
      if (req.user?._id === question.user?._id) {
        //create a notification

        await NotificationModel.create({
        user:req.user?._id,
        title:"New Question Reply Recived",
        message:`You have a new reply in  ${courseContent?.title}`
        })
      } else {
        const data = {
          name: question.user.name,
          title: courseContent.title,
        };
        const html = ejs.renderFile(
          path.join(__dirname, "../mails/questionReply.ejs"),
          data
        );
        try {
          await sendEmail({
            email: question.user.email,
            subject: "Question Reply",
            template: "questionReply.ejs",
            data,
          });
        } catch (error:any) {
          return next(new ErrorHandler(error.message, 500));
        }
      }
      res.status(200).json({
        success: true,
        course: course,
      });
    } catch (error:any) {
      return next(new ErrorHandler(error.message, 500));
    }
  }
);


// add review in the course
interface IAddReviewData {
    courseId: string;
    review: string;
    rating: number;
    userId: string;
}
export const addReview=catchAsyncErrors(async (req: Request, res: Response, next: NextFunction)=>{
try {
   const userCourseList = req.user?.courses;
   const courseId=req.params.id;
   //check if the course id exist in then UserCourseList based on the _id
    const courseExists = userCourseList?.find(
      (course: any) => course?._id?.toString() === courseId
    );

  if(!courseExists){
    return next(new ErrorHandler("You are not eligible for this course", 403));
  }
  const course=await CourseModel.findById(courseId);
  const { review, rating } = req.body as IAddReviewData;
  const ReviewData: any = {
  user: req.user,
  comment: review,
  rating: rating,
  };
  course?.reviews.push(ReviewData);
  let avg=0;
  course?.reviews.forEach((rev:any)=>{
    avg+=rev.rating;
  })
  if(course){
    course.ratings=avg/course.reviews.length;
  }
  await course?.save();
  await redis.set(courseId,JSON.stringify(course),'EX',604800);
    await NotificationModel.create({
        user:req.user?._id,
        title: "New Review Received",
        message: `${req.user?.name} has given a new review for ${course?.name}`,
    })
  res.status(200).json({
        success: true,
        course,
  })
}  catch (error:any) {
  return next(new ErrorHandler(error.message, 500));
}
});



// add reply to video
interface IAddReviewReplyData {
    comment: string;
    courseId: string;
    reviewId: string;
}
export const addReplyToReview=catchAsyncErrors(async (req: Request, res: Response, next: NextFunction)=>{
  try {
    const { comment, courseId, reviewId } = req.body as IAddReviewReplyData;
    const course = await CourseModel.findById(courseId);
    if (!courseId) {
      return next(new ErrorHandler("Course not found.", 404));
    }
    const review = course?.reviews.find(
    (rev: any) => rev._id.toString() === reviewId
    );
    if (!review) {
      return next(new ErrorHandler("Review not found", 400));
    }
    const replyData:any={
      user:req.user,
      comment,
      createdAt:new Date().toISOString(),
      updatedAt:new Date().toISOString(),
    }
    if (!review.commentReplies) {
    review.commentReplies = [];
    }
    review.commentReplies.push(replyData);
    await redis.set(courseId,JSON.stringify(course),'EX',604800);
    course?.save();
    res.status(201).json({
      success:true,
      course
    })
  } catch (error:any) {
    return next(new ErrorHandler(error.message, 500));
    }
})



export const deleteCourse = catchAsyncErrors(
  async (req: Request, res: Response, next: NextFunction) => {
    const { id } = req.params;

    const course = await CourseModel.findById(id);
    if (!course) {
      return next(new ErrorHandler("Course not found", 404));
    }

    // delete thumbnail from cloudinary (optional but recommended)
    if (course.thumbnail?.public_id) {
      await cloudinary.uploader.destroy(course.thumbnail.public_id);
    }

    await course.deleteOne();
    await redis.del(id);

    res.status(200).json({
      success: true,
      message: "Course deleted successfully",
    });
  }
);

