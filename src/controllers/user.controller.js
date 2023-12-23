import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import {
  uploadToCloudinary,
  deleteFromCloudinary,
  cloudinaryImageNameFromUrl,
} from "../utils/cloudinary.js";
import { User } from "../models/user.model.js";

import jwt from "jsonwebtoken";

const generateAccessTokenRefreshToken = async (user) => {
  try {
    const accessToken = user.generateAccessToken();
    const refreshToken = user.generateRefreshToken();

    // save refreshToken in user's database
    user.refreshToken = refreshToken;
    await user.save();
    return { accessToken, refreshToken };
  } catch (error) {
    throw new ApiError(
      400,
      "Error generating access token and refresh token, User not available"
    );
  }
};

const registerUser = asyncHandler(async (req, res) => {
  const { username, fullName, email, password } = req.body;

  // // Validate username, fullName, email, password
  let invalid = [username, fullName, email, password].some(
    (elem) => !elem || elem.trim() === ""
  );
  if (invalid) {
    throw new ApiError(409, "Give Correct Details");
  }

  // If user exist
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
  // res.send("Login");

  // Login username or email
  const { username, email, password } = req.body;

  // check username/email and password availability
  if (!(username || email) || !password) {
    throw new ApiError(409, "Username/Email And Password are required");
  }
  if (
    (username?.trim() === "" && email?.trim() === "") ||
    password.trim() === ""
  ) {
    throw new ApiError(409, "Username/Email And Password are required");
  }

  // find user in DB
  const user = await User.findOne({ $or: [{ username }, { email }] });

  // if user not exist
  if (!user) {
    throw new ApiError(409, "User does not exist");
  }

  // check password
  const isPasswordCorrect = await user.isPasswordCorrect(password);

  // if password is wrong
  if (!isPasswordCorrect) {
    throw new ApiError(409, "Wrong Password");
  }

  // generate access token and refresh token
  const { accessToken, refreshToken } =
    await generateAccessTokenRefreshToken(user);

  // options for cookie
  const options = { httpOnly: true, secure: true, maxAge: 900000 };

  // again retrieving user details for sending to client
  const userDetails = await User.findById(user._id).select(
    "-password -refreshToken"
  );

  res
    .status(200)
    .cookie("accessToken", accessToken, options)
    .cookie("refreshToken", refreshToken, options)
    .json(
      new ApiResponse(
        200,
        { accessToken, refreshToken, user: userDetails },
        "User Logged In Successfully"
      )
    );
});

const logoutUser = asyncHandler(async (req, res) => {
  const user = req.user;

  user.refreshToken = null;
  await user.save();

  const options = { httpOnly: true, secure: true };

  res
    .status(200)
    .clearCookie("accessToken")
    .clearCookie("refreshToken")
    .json(new ApiResponse(200, {}, "User Logged Out"));
});

const refreshAccessToken = asyncHandler(async (req, res) => {
  // Incoming Refresh Token
  const incomingRefreshToken =
    req.cookies?.refreshToken ||
    req.header("Authorization")?.replace("Bearer ", "") ||
    req.body.refreshToken;

  // If incoming Refresh Token not available
  if (!incomingRefreshToken) {
    throw new ApiError(
      409,
      "Unauthorized access !! Refresh Token not available"
    );
  }

  // decode payload from refresh token
  let decode;
  try {
    decode = jwt.verify(incomingRefreshToken, process.env.REFRESH_TOKEN_SECRET);
  } catch (error) {
    throw new ApiError(401, error?.message || "Invalid Refresh Token");
  }

  // find user in DB using payload
  const user = await User.findById(decode._id);

  // if user not found
  if (!user) {
    throw new ApiError(401, "Invalid Refresh Token");
  }

  // if incoming token and Db's token are not matched
  if (incomingRefreshToken !== user.refreshToken) {
    throw new ApiError(401, "Invalid Refresh Token");
  }

  // User is valid generate new tokens
  const { accessToken, refreshToken } =
    await generateAccessTokenRefreshToken(user);

  // if tokens not generated
  if (!accessToken || !refreshToken) {
    throw new ApiError(500, "Something went wrong while generating tokens");
  }

  // options for cookie
  const options = {
    httpOnly: true,
    secure: true,
    maxAge: 900000,
  };

  // Retrieve updated user to send to client
  const updatedUser = await User.findById(user._id).select(
    "-password -refreshToken"
  );

  // save generated tokens to cookie
  res
    .status(200)
    .cookie("accessToken", accessToken, options)
    .cookie("refreshToken", refreshToken, options)
    .json(
      new ApiResponse(
        200,
        {
          accessToken,
          refreshToken,
          user: updatedUser,
        },
        "Access token is Refreshed"
      )
    );
});

const changePassword = asyncHandler(async (req, res) => {
  const { oldPassword, newPassword } = req.body;

  // check old password and new password availability
  if (
    !oldPassword ||
    !newPassword ||
    oldPassword.trim() == "" ||
    newPassword.trim() == ""
  ) {
    throw new ApiError(400, "Password required");
  }
  if (oldPassword == newPassword) {
    throw new ApiError(400, "New password and old password are same");
  }

  // Get user using "verifyJWT" middleware
  const user = await User.findById(req.user._id);

  // if user not available
  if (!user) {
    throw new ApiError(400, "Unauthorized access, user not available");
  }

  // Check old password validation
  const isPasswordCorrect = await user.isPasswordCorrect(oldPassword);

  // If invalid old password
  if (!isPasswordCorrect) {
    throw new ApiError(400, "Invalid old password");
  }

  // Save new password
  user.password = newPassword;
  await user.save({ validateBeforeSave: false });

  res
    .status(200)
    .json(new ApiResponse(200, {}, "Password Changed Successfully"));
});

const getCurrentUser = asyncHandler(async (req, res) => {
  const user = req.user;

  if (!user) {
    throw new ApiError(400, "Unauthorized access");
  }

  res.status(200).json(new ApiResponse(200, { user }, "User Data Accessed"));
});

const updateUserDetails = asyncHandler(async (req, res) => {
  const { fullName, email } = req.body;

  // Check username and email availability
  if (!fullName || !email || fullName.trim() == "" || email.trim() == "") {
    throw new ApiError(400, "All fields are required");
  }

  // Find user and update fields in Db
  const user = await User.findByIdAndUpdate(
    req.user._id,
    { fullName, email },
    { new: true }
  ).select("-password -refreshToken");

  res
    .status(200)
    .json(
      new ApiResponse(200, { user }, "Account details updated successfully")
    );
});

const updateUserAvatar = asyncHandler(async (req, res) => {
  const avatarLocalPath = req.file?.path;
  const { _id, avatar } = req.user;

  // If avatar file not uploaded
  if (!avatarLocalPath) {
    throw new ApiError(400, "Avatar required");
  }

  // Upload avatar to cloudinary
  const uploadedAvatar = await uploadToCloudinary(avatarLocalPath);

  // If upload on cloudinary failed
  if (!uploadedAvatar?.url) {
    throw new ApiError(500, "Error while uploading avatar");
  }

  // Retrieve old avatar name on cloudinary from url
  const imageName = cloudinaryImageNameFromUrl(avatar);
  // Delete old avatar from cloudinary
  const deletedAvatar = await deleteFromCloudinary(imageName || "");

  // _______________________________________________________
  // if(!deletedAvatar){
  //   throw new ApiError(500, "Error deleting old avatar");
  // }
  // _______________________________________________________

  // Update user in Db
  const user = await User.findByIdAndUpdate(
    _id,
    { avatar: uploadedAvatar.url },
    { new: true }
  ).select("-password -refreshToken");

  res
    .status(200)
    .json(new ApiResponse(200, { user }, "Avatar Updated Successfully"));
});

const updateUserCoverImage = asyncHandler(async (req, res) => {
  const coverImageLocalPath = req.file?.path;
  const { _id, coverImage } = req.user;

  // If cover image file not uploaded
  if (!coverImageLocalPath) {
    throw new ApiError(400, "Cover Image required");
  }

  // Upload cover image to cloudinary
  const uploadedCoverImage = await uploadToCloudinary(coverImageLocalPath);

  // If upload on cloudinary failed
  if (!uploadedCoverImage?.url) {
    throw new ApiError(500, "Error while uploading cover image");
  }

  // Retrieve old cover image name on cloudinary from url
  const imageName = cloudinaryImageNameFromUrl(coverImage);
  // Delete old cover image from cloudinary
  const deletedAvatar = await deleteFromCloudinary(imageName || "");
  // _______________________________________________________
  // if(!deletedAvatar){
  //   throw new ApiError(500, "Error deleting old avatar");
  // }
  // _______________________________________________________

  // Update user in Db
  const user = await User.findByIdAndUpdate(
    _id,
    { coverImage: uploadedCoverImage.url },
    { new: true }
  ).select("-password -refreshToken");

  res
    .status(200)
    .json(new ApiResponse(200, { user }, "Cover image Updated Successfully"));
});

const removeUserCoverImage = asyncHandler(async (req, res) => {
  const { _id, coverImage } = req.user;
  const imageName = cloudinaryImageNameFromUrl(coverImage);
  if (!imageName) {
    throw new ApiError(400, "Cover Image not available");
  }
  const deletedImage = deleteFromCloudinary(imageName);

  if (!deletedImage) {
    throw new ApiError(400, "Error removing cover image from cloudinary");
  }

  const user = await User.findByIdAndUpdate(
    _id,
    { coverImage: null },
    { new: true }
  ).select("-password -refreshToken");

  res
    .status(200)
    .json(new ApiResponse(200, { user }, "Cover Image removed successfully"));
});

export {
  registerUser,
  loginUser,
  logoutUser,
  refreshAccessToken,
  changePassword,
  getCurrentUser,
  updateUserDetails,
  updateUserAvatar,
  removeUserCoverImage,
  updateUserCoverImage,
};
