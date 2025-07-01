// This function will use when we write async code
const AsyncHandler = (fn) => (req, res, next) => {
  //   console.log("✅ Inside AsyncHandler"); // Debugging log
  //   console.log("👉 Type of next in AsyncHandler:", typeof next);
  Promise.resolve(fn(req, res, next)).catch((error) => {
    console.error("❌ AsyncHandler caught an error:", error);
    next(error);
  });
};

export { AsyncHandler };
