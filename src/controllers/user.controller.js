import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import {
  uploadToCloudinary,
  deleteFromCloudinary,
} from "../utils/cloudinary.js";
import { User } from "../models/user.model.js";

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

export { registerUser, loginUser, logoutUser, refreshAccessToken, checkFunc };
