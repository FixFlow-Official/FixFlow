const mongoose = require("mongoose");

const staffSchema = new mongoose.Schema({
  username: {
    type: String,
    required: [true, "Username is required"],
  },
  staffId: {
    type: Number,
    required: [true, "Staff Id is required"],
    unique: [true, "Staff Id must be unique"],
  },
  department: {
    type: String,
    required: [true, "Department name is required"],
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
  role: {
    type: String,
    enum: ["student", "staff", "admin"],
    required: [true, "Role is required"],
  },
});

const staffModel = mongoose.model("staff", staffSchema);

module.exports = staffModel;
