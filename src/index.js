import mongoose from "mongoose";
import connectDB from "./db/index.js";
import express from "express";
// import "./check.js"
import app from "./app.js";

// const app = express();

// connectDB()
// .then(()=>{
//   app.on("error", (error)=>{
//     console.log("Error!!", error);
//     throw error;
//   })
//   app.listen(process.env.PORT || 5000, ()=>{
//     console.log(`Server Running at : ${process.env.PORT || 5000}`);
//   })
// })
// .catch((error)=>{
//   console.log("MongoDB Connection Error!!!", error);
// });


// export default app;