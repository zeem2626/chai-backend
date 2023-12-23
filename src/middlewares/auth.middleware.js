import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import jwt from "jsonwebtoken";
import { User } from "../models/user.model.js";

const verifyJWT = asyncHandler(async (req, _, next) => {
  try {
    const accessToken =
      req.cookies?.accessToken ||
      req.header("Authorization")?.replace("Bearer ", "");
    if (!accessToken) {
      throw new ApiError(
        409,
        "Unauthorized request!! User not available"
      );
    }

    const decode = jwt.verify(accessToken, process.env.ACCESS_TOKEN_SECRET);

    const user = await User.findById(decode._id);

    if (!user) {
      throw new ApiError(409, "Invalid Token");
    }

    req.user = user;
  } catch (error) {
    throw new ApiError(409, error?.message || "Invalid Access Token!!");
  }

  next();
});

export { verifyJWT };
