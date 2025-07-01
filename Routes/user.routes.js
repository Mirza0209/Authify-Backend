import { Router } from "express";
import {
  deleteAccount,
  deleteUser,
  forgotPassword,
  resetPassword,
  getAllUsers,
  getSingleUser,
  updatePassword,
  updateProfile,
  updateUser,
  userDetails,
  userLogin,
  userLogout,
  userRegistration,
  verifyOTP,
} from "../Controllers/user.controller.js";
import {
  isAuthenticatedUser,
  isAuthorizedRoles,
} from "../Middlewares/auth.middleware.js";

const router = Router();

// for registration
router.route("/register").post(userRegistration);
//verify otp
router.route("/opt-verification").post(verifyOTP);
// for login
router.route("/login").post(userLogin);
// for logout
router.route("/logout").get(userLogout);
// for user details
router.route("/me").get(isAuthenticatedUser, userDetails);
// for update user profile
router.route("/me/profile/update").put(isAuthenticatedUser, updateProfile);
// for update user password
router.route("/me/password/update").put(isAuthenticatedUser, updatePassword);
// for forgot password
router.route("/user/password/forgot").post(forgotPassword);
// for reset password
router.route("/user/password/reset/:token").post(resetPassword);
// for delete account
router.route("/me/delete/account").delete(isAuthenticatedUser, deleteAccount);
// for getting all users --->Admin
router
  .route("/admin/users")
  .get(isAuthenticatedUser, isAuthorizedRoles("admin"), getAllUsers);
// for getting single users --->Admin
router
  .route("/admin/user/:id")
  .get(isAuthenticatedUser, isAuthorizedRoles("admin"), getSingleUser)
  .put(isAuthenticatedUser, isAuthorizedRoles("admin"), updateUser)
  .delete(isAuthenticatedUser, isAuthorizedRoles("admin"), deleteUser);
export default router;
