import { ApiError } from "../Utils/ApiError.js";
import cloudinary from "cloudinary";
import bcrypt from "bcrypt";
import { User } from "../Models/user.model.js";
import { AsyncHandler } from "../Utils/AsyncHandler.js";
import { ApiResponse } from "../Utils/ApiResponse.js";
// Function to check if email is valid using EmailValidation.io
async function isEmailValid(email) {
  // console.log(`Validating email: ${email}`);

  // my api key for emailValidatio.io
  const EMAIL_VALIDATION_API_KEY = process.env.EMAIL_VALIDATION_API_KEY;

  try {
    //making proper url for calling
    let url = `https://api.emailvalidation.io/v1/info?apikey=${EMAIL_VALIDATION_API_KEY}&email=${email}`;

    // response from api calling
    let res = await fetch(url);

    // console.log("Response of api call : ", res);

    //convert response to proper json object
    let result = await res.json();

    // console.log("Result of api call : ", result);

    // console.log(result);

    // console.log("Email validation result:", result.state);

    return result.state;
  } catch (error) {
    // console.error(`Error validating email ${email}:`, error);
    return false; // Return false if there's an error in the request
  }
}
//template for sending verification code
function generateMessageTemplate(verificationCode, name) {
  return `
  <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #ddd; border-radius: 8px; background-color: #f9f9f9;">
    <h2 style="color: #4CAF50; text-align: center;">Verification Code</h2>
    <p style="font-size: 16px; color: #333;">Dear <span>${name}</span></p>
    <p style="font-size: 16px; color: #333;">Your verification code is:</p>
    <div style="text-align: center; margin: 20px 0;">
      <span style="display: inline-block; font-size: 24px; font-weight: bold; color: #4CAF50; padding: 10px 20px; border: 1px solid #4CAF50; border-radius: 5px; background-color: #e8f5e9;">
        ${verificationCode}
      </span>
    </div>
    <p style="font-size: 16px; color: #333;">Please use this code to verify your email address. The code will expire in 10 minutes.</p>
    <p style="font-size: 16px; color: #333;">If you did not request this, please ignore this email.</p>
    <footer style="margin-top: 20px; text-align: center; font-size: 14px; color: #999;">
      <p>Thank you,<br>Your Company Team</p>
      <p style="font-size: 12px; color: #aaa;">This is an automated message. Please do not reply to this email.</p>
    </footer>
  </div>
`;
}

//function to send verification code
async function sendVerificationCode(
  verificationCode,
  email,
  phone,
  res,
  name,
  next
) {
  const data = { phone: phone, email: email };
  // console.log("✅ data", data); // Debugging log
  // console.log("👉 Type of next in sendVerificationCode:", typeof next);
  try {
    //generate message template
    const message = generateMessageTemplate(verificationCode, name);
    //calling sendEmail function to send email
    await sendEmail({
      email,
      subject: "Your Verification Code",
      message,
    });
    // console.log("✅ isUserExit", isUserExist);
    //sending response
    return res
      .status(200)
      .json(new ApiResponse(200, data, `Verification code sent to ${email}`));
  } catch (error) {
    // console.error("❌ Error in sendVerificationCode:", error);
    return next(new ApiError("Server error.Please try later...!"));
  }
}

//user registration
const userRegistration = AsyncHandler(async (req, res, next) => {
  const { name, email, password, avatar, phone } = req.body;
  // console.log(name, password, email, avatar, phone);

  // console.log(req.files);

  //checking data comes or not
  if (
    [name, email, password, avatar, phone].some((field) => field?.trim() === "")
  ) {
    // console.log("❌ Missing required fields!");
    return next(new ApiError(`All fields are required...!`, 400));
  }

  // 3=Now verify phone format by regex
  function verifyPhone(phone) {
    const phoneRegex = /^(\+92|92|0)?3\d{9}$/;
    return phoneRegex.test(phone);
  }

  //checking if phone number is valid  means
  if (!verifyPhone(phone)) {
    // console.log("❌ Invalid phone number.");

    return next(new ApiError("Please enter a valid phone number", 400));
  }

  try {
    //check email is valid or not
    const isEmailValidResponse = await isEmailValid(email);
    // console.log("Email is invalid...!", isEmailValidResponse);

    //if email is not valid
    if (isEmailValidResponse !== "deliverable") {
      return next(new ApiError("Email is not valid...!", 404));
    }

    // console.log("before upload image");

    //upload image to coludinary
    const myCloud = await cloudinary.v2.uploader.upload(req.body.avatar, {
      folder: "avatars",
      width: 150,
      crop: "scale",
    });
    // console.log(myCloud);

    //in this i will check email is valid or not using emailvalidation.io api
    //Checking user already exist or not
    const isUserExist = await User.findOne({ email });
    // console.log(isUserExist);

    //check is verified user exist or not
    if (isUserExist && isUserExist.accountVerified) {
      // console.log("❌ User already exists and is verified.");
      return next(new ApiError("User already exists", 400));
    }

    // If the user exists but isn't verified, increment their registration attempts
    if (isUserExist && !isUserExist.accountVerified) {
      // console.log("❌ User exists but is NOT verified.");

      if (isUserExist.registrationAttempts >= 2) {
        // console.log("❌ Too many registration attempts.");
        return next(
          new ApiError(
            "You have exceeded the maximum number of registration attempts. Please try again after one hour.",
            400
          )
        );
      }

      // Increment registration attempts
      isUserExist.registrationAttempts++;

      //delete already existing image if user reregister(when user not verified)
      await cloudinary.v2.uploader.destroy(isUserExist.avatar.public_id);

      // console.log("✅ Generating verification code...");
      const verificationCode = await isUserExist.generateVerificationCode();
      // console.log(verificationCode);

      await isUserExist.save({ validateBeforeSave: false });
      // console.log(isUserExist.verificationCode);

      // console.log("✅ Sending verification code...");
      sendVerificationCode(verificationCode, email, phone, res, name, next);

      return res
        .status(200)
        .json(
          new ApiResponse(
            200,
            isUserExist,
            "You have attempted to register before. Please check your email for the verification code."
          )
        );
    }

    //user data
    const userData = {
      name,
      email,
      password,
      phone,
      avatar: {
        public_id: myCloud.public_id,
        url: myCloud.secure_url,
      },
    };

    // console.log("✅ Creating new user...");
    //Creating new user
    const user = await User.create(userData);
    // console.log(user);

    //check user created or not
    if (!user) {
      // console.log("❌ Failed to create user.");
      return next(
        new ApiError(`Internal Server Error while creating new user...!`, 500)
      );
    }

    // console.log("✅ Generating verification code for new user...");
    // 7=generate verification code of 5 digits comes from userModel
    const verificationCode = await user.generateVerificationCode();

    await user.save();
    // console.log(user.verificationCode);

    // 8=send verification code via node mailer with html template
    // console.log("✅ Sending verification email...");
    sendVerificationCode(verificationCode, email, phone, res, name , next);
  } catch (error) {
    // console.log("register error", error.message);

    return next(new ApiError(`${error.message}`, 500));
  }
});

//verify otp
export const verifyOTP = AsyncHandler(async (req, res, next) => {
  const { email, otp, phone } = req.body;
  // console.log(otp, email, phone);

  if (!email || !otp || !phone) {
    return next(new ApiError("Please fill all fields", 400));
  }

  // 3=Now verify phone format by regex
  function verifyPhone(phone) {
    const phoneRegex = /^(\+92|92|0)?3\d{9}$/;
    return phoneRegex.test(phone);
  }

  //checking if phone number is valid  means
  if (!verifyPhone(phone)) {
    return next(new ApiError("Please enter a valid phone number", 400));
  }

  try {
    const userAllEntries = await User.find({
      email,
      accountVerified: false,
    }).sort({ createdAt: -1 });

    let user;
    // If there are multiple entries, delete all except the first one and if not then use the first one
    if (userAllEntries.length > 1) {
      user = userAllEntries[0];
      await User.deleteMany({
        _id: { $ne: user._id }, //delete all entries except the first one
        email,
        accountVerified: false,
      });
    } else {
      user = userAllEntries[0];
    }

    // console.log(user);

    //if opt is correct mean otp match with user database otp
    if (user?.verificationCode !== Number(otp)) {
      return next(new ApiError("Invalid OTP", 400));
    }

    //now code for expiry verification code
    const currentTime = new Date();
    // console.log(currentTime);

    const verificationCodeExpire = new Date(
      user.verificationCodeExpiry
    ).getTime(); //get time of expiry verification code mean this block of code will get the time of expiry verification code from the database and convert it into milliseconds and store it in verificationCodeExpire variable

    // console.log(verificationCodeExpire);

    if (currentTime > verificationCodeExpire) {
      return next(new ApiError("OTP Expired.", 400));
    }

    //if user otp is correct then make account verified
    user.accountVerified = true;
    user.verificationCode = undefined;
    user.verificationCodeExpiry = undefined;
    user.registrationAttempts = 0;
    await user.save();
    // console.log(user);

    //creating cookie to send
    const { accessToken } = await createAccessToken(user._id);
    // console.log(accessToken);

    //options for cookie of accessToken
    const options = {
      expireIn: new Date(
        Date.now() + process.env.ACCESS_TOKEN_EXPIRY * 24 * 60 * 60 * 1000
      ),
      httpOnly: true,
      secure: true,
    };
    //send cookie
    return res
      .status(200)
      .cookie("accessToken", accessToken, options)
      .json(
        new ApiResponse(
          200,
          user,
          "User created and verified successfully and direct login to access resources...!"
        )
      );
  } catch (error) {
    return next(new ApiError(error.message, 500));
  }
});

/* Code for generating token */
const createAccessToken = async (userId) => {
  try {
    const user = await User.findById(userId);
    const accessToken = await user.generateAccessToken();
    return { accessToken };
  } catch (error) {
    return next(
      new ApiError(
        "Something went wrong while generating Access token...!",
        500
      )
    );
  }
};

//User login
const userLogin = AsyncHandler(async (req, res, next) => {
  const { email, password } = req.body;

  //   console.log(email, password);

  //if email or password is empty or not given
  if (!email || !password) {
    return next(new ApiError(`Please fill all fields for login...!`, 400));
  }

  //if given email and password then this code will execute
  const user = await User.findOne({
    email,
  }).select("+password");
  // console.log(user);

  if (user && !user.accountVerified) {
    return next(
      new ApiError(
        `You are already registered but not verified.please again fill registeration form...!`,
        401
      )
    );
  }

  //if user not find
  if (!user) {
    return next(new ApiError(`Please register before login...!`, 401));
  }

  //Comparing password which user give
  const isPasswordCorrect = await user.comparePassword(password);
  //   console.log(isPasswordCorrect);

  //if password not correct
  if (!isPasswordCorrect) {
    return next(new ApiError(`Invalid Credentials...!`, 401));
  }

  //options for cookie of accessToken
  const options = {
    expireIn: new Date(
      Date.now() + process.env.ACCESS_TOKEN_EXPIRY * 24 * 60 * 60 * 1000
    ),
    httpOnly: true,
    secure: true,
    path: "/",
  };

  //creating cookie to send
  const { accessToken } = await createAccessToken(user._id);

  return res
    .status(200)
    .cookie("accessToken", accessToken, options)
    .json(new ApiResponse(200, user, "User logged In successfully...!"));
});

//user logout
const userLogout = AsyncHandler(async (req, res, next) => {
  try {
    res.cookie("accessToken", null, {
      httpOnly: true,
      secure: true, // Important for HTTPS
      path: "/",
      expires: new Date(Date.now()),
    });
    // res.clearCookie("accessToken", {
    //   httpOnly: true,
    //   secure: process.env.NODE_ENV === "production",
    //   sameSite: "strict",
    // });

    return res
      .status(200)
      .json(new ApiResponse(200, "User logged out successfully...!"));
  } catch (error) {
    console.log("Logout error", error);
    return next(
      new ApiError("Something went wrong while logging out...!", 500)
    );
  }
});

//getting user details
const userDetails = AsyncHandler(async (req, res, next) => {
  try {
    // fetching _id of user who want to access details from req.user which we set in middleware
    const { _id } = req.user;

    const user = await User.findById(_id);
    // console.log(user);

    return res.status(200).json(new ApiResponse(200, user, "User Details...!"));
  } catch (error) {
    console.log("userDetails error", error);
    return next(
      new ApiError("Something went wrong while getting user details...!", 500)
    );
  }
});

//update user profile
const updateProfile = AsyncHandler(async (req, res, next) => {
  // console.log(req.body.oldAvatarId);
  try {
    //Data which will update
    const userNewData = {
      name: req.body.name,
      email: req.body.email,
      phone: req.body.phone,
    };
    //destroy old image
    if (req.body.oldAvatarId) {
      await cloudinary.v2.uploader.destroy(req.body.oldAvatarId);
      //upload image to coludinary
      const myCloud = await cloudinary.v2.uploader.upload(req.body.avatar, {
        folder: "avatars",
        width: 150,
        crop: "scale",
      });
      userNewData.avatar = {
        public_id: myCloud.public_id,
        url: myCloud.secure_url,
      };
    }

    const updatedUser = await User.findByIdAndUpdate(
      req.user._id,
      userNewData,
      {
        new: true,
        runValidators: true,
        useFindAndModify: false,
      }
    );

    //creating cookie to send
    const { accessToken } = await createAccessToken(updatedUser._id);

    //options for cookie of accessToken
    const options = {
      expireIn: new Date(
        Date.now() + process.env.ACCESS_TOKEN_EXPIRY * 24 * 60 * 60 * 1000
      ),
      httpOnly: true,
      secure: true,
    };

    res
      .status(200)
      .cookie("accessToken", accessToken, options)
      .json(new ApiResponse(200, updatedUser, `User updated successfully...!`));
  } catch (error) {
    return next(
      new ApiError("Something went wrong while updatinging profile...!", 500)
    );
  }
});

//update user password
const updatePassword = AsyncHandler(async (req, res, next) => {
  const { oldPassword, newPassword, confirmPassword } = req.body;
  // console.log(oldPassword, newPassword, confirmPassword);

  //if any field is empty
  if (!oldPassword || !newPassword || !confirmPassword) {
    return next(new ApiError(`Please fill all fields...!`, 400));
  }

  try {
    //getting user who want to update password by using req.user._id from middleware
    const user = await User.findById(req.user._id).select("+password");
    // console.log("user", user);

    //comparing oldPassword with already exist password
    const isOldPasswordCorrect = await user.comparePassword(oldPassword);
    // console.log("isOldPasswordCorrect", isOldPasswordCorrect);

    //if oldPAssword is not matched
    if (!isOldPasswordCorrect) {
      return next(new ApiError(`Incorrect OldPassword...!`, 400));
    }

    //checking newPassword and confirmPassword are same
    if (newPassword !== confirmPassword) {
      return next(
        new ApiError(`NewPassword and ConfirmPassword must be same...!`, 400)
      );
    }

    user.password = newPassword;
    //saving new password
    await user.save();
    // console.log(user);

    return res
      .status(200)
      .json(
        new ApiResponse(200, user, "User password updated successfully...!")
      );
  } catch (error) {
    // console.log("error", error);

    return next(
      new ApiError("Something went wrong while updatinging password...!", 500)
    );
  }
});

//user delete
const deleteAccount = AsyncHandler(async (req, res, next) => {
  //getting user who want to delete account by using req.user._id from middleware
  const user = await User.findByIdAndDelete(req.user._id);
  // console.log(user);
  if (!user) {
    return next(new ApiError(`User not found...!`, 404));
  }
  console.log(req.body);

  //destroy old image
  if (req.body.oldAvatarId) {
    await cloudinary.v2.uploader.destroy(req.body.oldAvatarId);
  }

  res.cookie("accessToken", null, {
    httpOnly: true,
    expires: new Date(Date.now()),
  });

  return res
    .status(200)
    .json(new ApiResponse(200, user, "User deleted successfully...!"));
});

//for forgot password
const forgotPassword = AsyncHandler(async (req, res, next) => {
  const { email } = req.body;
  // console.log(req.protocol);

  try {
    //checking user exist or not
    const user = await User.findOne({
      email,
    });

    //if user not found
    if (!user) {
      return next(new ApiError(`User not found with this email...!`, 404));
    }

    //generating reset token
    const resetPasswordToken = await user.generateResetPasswordToken();
    user.resetPasswordToken = resetPasswordToken;
    user.resetPasswordExpiry = Date.now() + 10 * 60 * 1000; //10 minutes
    await user.save({ validateBeforeSave: false });

    //making url on which we send email
    const resetPasswordUrl = `${req.protocol}://${req.get(
      "host"
    )}/user/password/reset/${resetPasswordToken}`;
    // console.log(resetPasswordUrl);

    //calling sendEmail function to send email with resetPassworUrl
    await sendEmail({
      email,
      subject: "RESET PASSWORD",
      message: `<p>Click <a href="${resetPasswordUrl}">Reset Password</a> to reset your password. This link expires in 10 minutes.\n\nIf you have not requested this email then, please ignore it.</p>`,
    });

    return res
      .status(200)
      .json(new ApiResponse(200, "Reset password link sent to your email...!"));
  } catch (error) {
    console.log(error);
    return next(
      new ApiError("Something went wrong while reseting password...!")
    );
  }
});

//for reset password
const resetPassword = AsyncHandler(async (req, res, next) => {
  const { token } = req.params;
  // console.log(token);

  const { newPassword, confirmPassword } = req.body;
  // console.log(newPassword, confirmPassword);

  try {
    //first of all check tokenis come or not
    if (!token) {
      return next(new ApiError(`Token required...!`, 400));
    }

    //getting user by token
    const user = await User.findOne({
      resetPasswordToken: token,
      resetPasswordExpiry: { $gt: Date.now() }, //if token expiry date available then check it
    });

    //now check user exist or not
    if (!user) {
      return next(new ApiError(`Invalid or Expired Token...!`, 400));
    }

    //now check passwords given or not
    if (!newPassword || !confirmPassword) {
      return next(new ApiError(`Please fill all fields...!`, 400));
    }

    //checking password length
    if (newPassword?.length < 8) {
      return next(
        new ApiError(`Password must be at least 8 characters long`, 400)
      );
    }

    //now check passwords are matched or not
    if (newPassword !== confirmPassword) {
      return next(
        new ApiError(`NewPassword and ConfirmPassword must be same...!`, 400)
      );
    }

    //now update password
    user.password = newPassword;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpiry = undefined;
    await user.save({ validateBeforeSave: false });

    return res
      .status(200)
      .json(new ApiResponse(200, user, "Password reset successfully...!"));
  } catch (error) {
    console.log(error);
    return next(
      new ApiError("Something went wrong while reseting password...!")
    );
  }
});
//get all users --->Admin
const getAllUsers = AsyncHandler(async (req, res, next) => {
  const users = await User.find();
  res.status(200).json(new ApiResponse(200, users, `All Users...!`));
});

//getting single user --->Admin
const getSingleUser = AsyncHandler(async (req, res, next) => {
  // getting single user by req.params.id
  const singleUser = await User.findById(req.params.id);
  if (!singleUser) {
    return next(new ApiError("User not found with this id...!", 401));
  }
  res.status(200).json(new ApiResponse(200, singleUser, `Single User...!`));
});

//update user's role --->Admin
const updateUser = AsyncHandler(async (req, res, next) => {
  //getting data from admin but in frontend admin will only able to change role not name and email
  const newData = {
    name: req.body.name,
    email: req.body.email,
    role: req.body.role,
  };

  //update user's role --->Admin
  const updatedUser = await User.findByIdAndUpdate(req.params.id, newData, {
    new: true,
    runValidators: true,
    useFindAndModify: false,
  });

  return res
    .status(200)
    .json(new ApiResponse(200, updatedUser, `Updated Role Successfully...!`));
});

//Delete User --->Admin
const deleteUser = AsyncHandler(async (req, res, next) => {
  await User.findByIdAndDelete(req.params.id);
  res
    .status(200)
    .json(new ApiResponse(200, deleteUser, `User Deleted Successfully...!`));
});
export {
  userRegistration,
  userLogin,
  userLogout,
  updateProfile,
  userDetails,
  updatePassword,
  deleteAccount,
  getAllUsers,
  getSingleUser,
  updateUser,
  deleteUser,
  forgotPassword,
  resetPassword,
};
