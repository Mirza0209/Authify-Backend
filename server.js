import dotenv from "dotenv";
import { dbConnection } from "./Config/database.js";
import cloudinary from "cloudinary";
import cors from "cors";
import app from "./api/index.js";

// cors options means who can access our backend from frontend
const corsOptions = {
  origin: process.env.ORIGIN,
  methods: "GET, POST, PUT, DELETE, PATCH, HEAD",
  credentials: true,
};

// const _dirname = path.resolve();
app.use(cors(corsOptions));
// Handling Uncaught Exception(error) it happen when an variable is used without declaration
process.on("uncaughtException", (err) => {
  console.log(`Error: ${err.message}`);
  console.log(`Shutting down the server due to Uncaught Exception`);
  process.exit(1);
});

//Providing env data
dotenv.config({
  path: ".env",
});

//Calling database connection method
dbConnection();

// Configuration of Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUD_NAME,
  api_key: process.env.CLOUD_API_KEY,
  api_secret: process.env.CLOUD_API_SECRET,
});

//Listing app on specific port

const PORT = process.env.PORT || 4000;
const server = app.listen(PORT, () => {
  console.log(`Server is working on http://localhost:${process.env.PORT}`);
});

// Unhandled Promise Rejection(handle if mongodb occur error)
process.on("unhandledRejection", (err) => {
  console.log(`Error: ${err.message}`);
  console.log(`Shutting down the server due to Unhandled Promise Rejection`);

  server.close(() => {
    process.exit(1);
  });
});
