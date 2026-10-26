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
  profilePictureUrl: {
    type: String,
    default: null,
  },
  password: {
    type: String,
    required: [true, "Password is required"],
  },
  termsAcceptedAt: {
    type: Date,
    required: [true, "Terms acceptance is required"],
  },
  termsVersion: {
    type: String,
    required: [true, "Terms version is required"],
  },
  role: {
    type: String,
    enum: ["student", "staff", "admin"],
    required: [true, "Role is required"],
  },
});

studentSchema.index({ username: 1, _id: 1 });

const studentModel = mongoose.model("student", studentSchema);

module.exports = studentModel;
