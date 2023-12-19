import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import {
  uploadToCloudinary,
  deleteFromCloudinary,
} from "../utils/cloudinary.js";
import { User } from "../models/user.model.js";

const registerUser = asyncHandler(async (req, res) => {
  const { username, fullName, email, password } = req.body;

  // // Validate username, fullName, email, password
  let invalid = [username, fullName, email, password].some(
    (elem) => !elem || elem.trim() === ""
  );
  if (invalid) {
    throw new ApiError(409, "Give Correct Details");
  }

  // // If user exist
  const userExist = await User.findOne({ $or: [{ username }, { email }] });
  if (userExist) {
    throw new ApiError(409, "User with username or email already exists");
  }

  // // avatar and coverImage locale path
  const avatarLocalPath = req.files?.avatar ? req.files?.avatar[0]?.path : null;
  const coverImageLocalPath = req.files?.coverImage
    ? req.files?.coverImage[0]?.path
    : null;

  // Avatar not available
  if (!avatarLocalPath) {
    throw new ApiError(409, "Avatar is required");
  }
  //upload Avatar on cloudinary
  const avatar = await uploadToCloudinary(avatarLocalPath);

  //upload Cover Image on cloudinary
  const coverImage = coverImageLocalPath
    ? await uploadToCloudinary(coverImageLocalPath)
    : null;

  if (!avatar?.url) {
    throw new ApiError(409, "Avatar is required");
  }

  const newUser = await User.create({
    username,
    email,
    fullName,
    password,
    avatar: avatar.url,
    coverImage: coverImage?.url || "",
  });

  const userCreated = await User.findById(newUser._id).select(
    "-password -refreshToken"
  );

  if (!userCreated) {
    // Delete uploaded images
    const deleteImagesString = `${avatar.public_id}/${
      coverImage?.public_id || ""
    }`;
    const deleteFilesArray = deleteImagesString.split("/");
    const deletedResponse = await deleteFromCloudinary(deleteFilesArray);

    const uploadedImages = !deletedResponse
      ? "And uploaded images not deleted"
      : "";
    
    throw new ApiError(500, `Error Creating User ${uploadedImages}!!`);
  }

  res
    .status(200)
    .json(new ApiResponse(200, userCreated, "User Created Successfully"));
});

const loginUser = asyncHandler(async (req, res) => {
  // Login
  res.status(200).json({ message: "User Logged In" });
});

const checkFunc = asyncHandler(async (req, res) => {
  const { username, email, id } = req.body;

  res.json({Success: true})
});

export { registerUser, loginUser, checkFunc };
