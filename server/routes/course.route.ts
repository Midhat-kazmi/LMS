import express from "express";
import multer from "multer";
import {
  uploadCourse,
  editCourse,
  getSingleCourse,
  getAllCoursesAdmin,
  getCourseByUser,
  addQuestionToCourse,
  addAnswer,
  addReview,
  addReplyToReview,
  deleteCourse,
} from "../controllers/course.controller";
import { isAuthenticated, isAdmin } from "../middleware/auth";
import { refreshAccessToken } from "../controllers/user.controller";

const router = express.Router();

// Multer storage in memory
const storage = multer.memoryStorage();
const upload = multer({ storage });

// -------------------- Routes --------------------

// Create Course
router.post(
  "/create-course",
  isAuthenticated,
  upload.single("thumbnail"),
  uploadCourse
);

// Edit Course
router.put("/edit-course/:id", upload.single("thumbnail"), editCourse);

// Get single course
router.get("/single-course/:id", getSingleCourse);

// Admin: Get all courses
router.get("/admin/all", isAuthenticated, isAdmin("admin"), getAllCoursesAdmin);
router.get("/get-courses", isAuthenticated, isAdmin("admin"), getAllCoursesAdmin);

// User: Get course content (with refreshed token)
router.get(
  "/get-course-content/:id",
  refreshAccessToken,
  isAuthenticated,
  getCourseByUser
);

// Add question to course
router.put(
  "/add-question",
  refreshAccessToken,
  isAuthenticated,
  addQuestionToCourse
);

// Add answer to question
router.put(
  "/add-answer",
  refreshAccessToken,
  isAuthenticated,
  addAnswer
);

// Add review to course
router.put(
  "/add-review/:id",
  refreshAccessToken,
  isAuthenticated,
  addReview
);

// Add reply to review (admin only)
router.put(
  "/add-reply",
  refreshAccessToken,
  isAuthenticated,
  isAdmin("admin"),
  addReplyToReview
);

// Delete course (admin only)
router.delete(
  "/delete-course/:id",
  refreshAccessToken,
  isAuthenticated,
  isAdmin("admin"),
  deleteCourse
);

export default router;
