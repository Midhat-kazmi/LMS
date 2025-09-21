import express from "express";
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
} from "../controllers/course.controller";
import { isAuthenticated, isAdmin } from "../middleware/auth";
import multer from "multer";
import { refreshAccessToken } from "../controllers/user.controller";

const router = express.Router();

// Multer storage in memory
const storage = multer.memoryStorage();
const upload = multer({ storage });

router.post(
  "/create-course",
  isAuthenticated,
  upload.single("thumbnail"),
  uploadCourse
);

router.put("/edit-course/:id", upload.single("thumbnail"), editCourse);
router.get("/single-course/:id", getSingleCourse);
router.get("/admin/all", isAuthenticated, isAdmin("admin"), getAllCoursesAdmin);

router.get(
  "/get-courses",
  isAuthenticated,
  isAdmin("admin"),
  getAllCoursesAdmin
);
router.get(
  "/get-course-content/:id",
  refreshAccessToken,
  isAuthenticated,
  getCourseByUser
);

router.put(
  "/add-question",
  refreshAccessToken,
  isAuthenticated,
  addQuestionToCourse
);

router.put("/add-answer", 
  refreshAccessToken,
   isAuthenticated,
   addAnswer);

router.put("/add-review/:id", refreshAccessToken, isAuthenticated, addReview);

router.put(
  "/add-reply",
  refreshAccessToken,
  isAuthenticated,
  isAdmin("admin"),
  addReplyToReview
);

export default router;
