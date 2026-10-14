const mongoose = require("mongoose");

const adminSchema = new mongoose.Schema({
  username: {
    type: String,
    required: [true, "Username is required"],
  },
  email: {
    type: String,
    required: [true, "Email is required"],
    unique: [true, "Email should be unique"],
  },
  password: {
    type: String,
    required: [true, "Password is required"],
  },
  adminId: {
    type: String,
    required: [true, "Admin id is required"],
    unique: [true, "Admin id should be unique"],
  },
  designation: {
    type: String,
    required: [true, "Designation is required"],
  },
  role: {
    type: String,
    enum: ["student", "staff", "admin"],
    required: [true, "Role is required"],
  },
});

const adminModel = mongoose.model("admin", adminSchema);

module.exports = adminModel;
