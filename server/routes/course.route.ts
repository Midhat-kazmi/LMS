import express from "express";
import { uploadCourse, editCourse } from "../controllers/course.controller";
import { isAuthenticated } from "../middleware/auth";
import multer from "multer";

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

export default router;
