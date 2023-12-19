import express, { urlencoded } from "express";
import { upload } from "./middlewares/multer.middleware.js";

import cors from "cors";
import cookieParser from "cookie-parser";

const app = express();

app.use(
  cors({
    origin: process.env.CORS_ORIGIN,
    credentials: true,
  })
);
app.use(express.json({ limit: "16kb" }));
app.use(express.urlencoded({ extended: true, limit: "16kb" }));
app.use(express.static("public"));
app.use(cookieParser());

//Routes
import userRouter from "./routes/user.routes.js";

app.use("/user", userRouter);


// app.listen(8000 || 5000, () => {
//   console.log(`Server Running at : ${8000 || 5000}`);
// });

export default app;
