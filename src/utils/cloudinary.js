import { v2 as cloudinary } from "cloudinary";
import fs from "fs";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const uploadToCloudinary = async (localFilePath) => {
  try {
    if (!localFilePath) return new Error("File path not available");
    // Upload File
    const response = await cloudinary.v2.uploader.upload(localFilePath, {
      resourceType: auto,
    });
    // Uploaded Successfully
    return response;
  } catch (error) {
    // Remove File If Upload Failed
    fs.unlinkSync(localFilePath);
  }
};

export {uploadToCloudinary};
