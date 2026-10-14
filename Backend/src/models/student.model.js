const mongoose = require("mongoose");

const studentSchema = new mongoose.Schema({
  username: {
    type: String,
    required: [true, "Username is required"],
  },
  rollno: {
    type: Number,
    required: [true, "Roll no. is required"],
    unique: [true, "Roll no. should be unique"],
  },
  course: {
    type: String,
    required: [true, "Course name is required"],
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

const studentModel = mongoose.model("student", studentSchema);

module.exports = studentModel;
