import { User } from "../Models/user.model.js";
import { ApiError } from "../Utils/ApiError.js";
import { AsyncHandler } from "../utils/AsyncHandler.js";
import jwt from "jsonwebtoken";

//Check is user logged in or not
const isAuthenticatedUser = AsyncHandler(async (req, res, next) => {
  // fetching accessToken from req.cookies
  const { accessToken } = req.cookies;

  const isAuthenticated = false;

  //if token not found its mean user is not logged in
  if (!accessToken) {
    return next(
      new ApiError(`You need to login to access this resource...!`, 401)
    );
  }

  try {
    const decodedToken = jwt.verify(
      accessToken,
      process.env.ACCESS_TOKEN_SECRET_KEY
    );
    const user = await User.findById(decodedToken._id);
    if (!user) {
      return next(new ApiError("User not found", 404));
    }

    req.user = user;
    next();
  } catch (error) {
    return next(new ApiError("Invalid token", 401)); // Unauthorized if token is invalid
  }
});

//check is user's role admin or not
const isAuthorizedRoles = (roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return next(
        new ApiError(
          `Role : ${req.user.role} cannot access this resource...!`,
          403
        )
      );
    }
    next();
  };
};

export { isAuthenticatedUser, isAuthorizedRoles };
