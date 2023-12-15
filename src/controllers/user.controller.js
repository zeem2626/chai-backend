import { asyncHandler } from "../utils/asyncHandler.js";

const registerUser = asyncHandler(async (req, res) => {
  //Register
  res.status(200).json({ message: "User Created" });
});

const loginUser = asyncHandler(async (req, res) => {
  //Login
  res.status(200).json({ message: "User Logged In" });
});

export { registerUser, loginUser };
