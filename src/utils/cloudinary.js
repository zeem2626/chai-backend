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
    const response = await cloudinary.uploader.upload(localFilePath, {
      resourceType: "auto",
    });
    // Uploaded Successfully
    fs.unlinkSync(localFilePath);
    return response;
  } catch (error) {
    // Remove File If Upload Failed
    fs.unlinkSync(localFilePath);
    throw error;
  }
};

const deleteFromCloudinary = async (...deleteFiles) => {
  try {
    const response = await cloudinary.api.delete_resources(deleteFiles, {
      type: "upload",
      resource_type: "image",
    });
    return response;
  } catch (error) {
    console.log(error);
  }
};
const cloudinaryImageNameFromUrl = (url) => {
  if (!url) {
    return null;
  }
  let start = url.length - 1;
  let end = start;

  while (start > 0) {
    if (url[start] == ".") end = start - 1;
    if (url[start] == "/") {
      start++;
      break;
    }
    start--;
  }
  // Return image name
  return url.slice(start, end + 1);
};

export { uploadToCloudinary, deleteFromCloudinary, cloudinaryImageNameFromUrl };
