import { model, Schema } from "mongoose";
import validator from "validator";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";

const userSchema = new Schema(
  {
    name: {
      type: String,
      required: true,
    },
    email: {
      type: String,
      required: true,
    },
    password: {
      type: String,
      minLength: [8, "Password must be at least 8 characters long"],
      maxLength: [100, "Password must be at most 100 characters long"],
      select: false,
    },

    avatar: {
      public_id: {
        type: String,
        required: [true, "public_id is required...!"],
        default: "atdysdyfutduyf",
      },
      url: {
        type: String,
        required: [true, "URL is required...!"],
        default: "cytsrtxcfydtfytd",
      },
    },
    role: {
      type: String,
      default: "user",
    },
    phone: {
      type: String,
      required: true,
    },
    accountVerified: {
      type: Boolean,
      default: false,
    },
    registrationAttempts: { type: Number, default: 0 },
    verificationCode: Number,
    verificationCodeExpiry: Date,
    resetPasswordToken: String,
    resetPasswordExpiry: Date,
  },
  { timestamps: true }
);

//Hashing user password
userSchema.pre("save", async function (next) {
  if (!this.isModified("password")) {
    return next();
  }
  try {
    //if password modified(update) then this code will execute
    const genSaltRound = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(this.password, genSaltRound);
    this.password = hashedPassword;
  } catch (error) {
    return next(error);
  }
});

//Comparing password when login
userSchema.methods.comparePassword = async function (password) {
  const isPassword = await bcrypt.compare(password, this.password);
  // console.log("is hashed password compare..", isPassword);
  return isPassword;
};

//Creating jsonWebToken for user
userSchema.methods.generateAccessToken = async function () {
  try {
    const accessToken = jwt.sign(
      {
        _id: this._id,
        email: this.email,
        name: this.name,
      },
      process.env.ACCESS_TOKEN_SECRET_KEY,
      {
        expiresIn: process.env.ACCESS_TOKEN_EXPIRY,
      }
    );
    return accessToken;
  } catch (error) {
    console.log(`Error while generating accessToken : ${error}`);
  }
};

//Creating jsonWebToken for user
userSchema.methods.generateResetPasswordToken = async function () {
  try {
    const resetPasswordToken = jwt.sign(
      {
        _id: this._id,
      },
      process.env.RESET_PASSWORD_TOKEN_SECRET_KEY,
      {
        expiresIn: process.env.RESET_PASSWORD_TOKEN_EXPIRY,
      }
    );
    return resetPasswordToken;
  } catch (error) {
    console.log(`Error while generating reset token : ${error}`);
  }
};

//code for generating verification code
userSchema.methods.generateVerificationCode = function () {
  function generateFiveDigits() {
    //this line will generate a random number between 1 and 9
    const firstDigit = Math.floor(Math.random() * 9) + 1;
    //this line will generate a random number between 1000 and 9999 mean 4 digits
    const remainingDigits = Math.floor(Math.random() * 10000)
      .toString() //convert number to string
      .padStart(4, "0"); //if number is less than 4 digits then add 0 at the start
    return parseInt(firstDigit + remainingDigits); //return 5 digits number
  }
  const verificationCode = generateFiveDigits();
  // console.log(verificationCode);

  this.verificationCode = verificationCode;
  this.verificationCodeExpiry = new Date(Date.now() + 10 * 60 * 1000); //10 minutes
  return verificationCode;
};

export const User = model("User", userSchema);
