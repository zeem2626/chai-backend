import express from "express";

const app = express();

app.post("/upload", (req, res)=>{
  // console.log(Ok);
  res.send(req.body);
})

app.listen(process.env.PORT || 5000, ()=>{
  console.log(`Server Running at : ${process.env.PORT || 5000}`);
})