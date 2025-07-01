import mongoose from "mongoose";

const dbConnection = async () => {
  await mongoose
    .connect(`${process.env.MONGODB_URL}`)
    .then((data) => {
      console.log(`Mongodb connected with server: ${data.connection.host}`);
    })
    .catch((err) => {
      console.log(`Database connection error: ${err.message}`);
    });
};
export { dbConnection };
