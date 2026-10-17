const complaintModel = require("../models/complaint.model");
const config = require("../config/config");
const uploadFile = require("../services/storage.service");
const studentModel = require("../models/student.model");
const staffModel = require("../models/staff.model");
const adminModel = require("../models/admin.model");
const jwt = require("jsonwebtoken");

 /**
 *
 * @route createComplaint
 * @description accepts a Image,title,description to create a complaint
 * @access public
 */

async function createComplaint(req, res) {
  const accessToken = req.accessToken;

  if (!accessToken) {
    return res.status(401).json({
      message: "Unauthorized",
    });
  }

  try {
    const decoded = jwt.verify(accessToken, config.JWT_SECRET);

    const userModels = {
        student: studentModel,
        staff: staffModel,
        admin: adminModel,
      };

    const model = userModels[decoded.role];

    const user = await model.findById(decoded.id);

    if (!user) {
      return res.status(401).json({
        message: "User not found",
      });
    }

    const complaintPicture = req.file;
    const { title, description } = req.body;

    const result = await uploadFile(complaintPicture.buffer, title);

    if (!result) {
      return res.status(500).json({
        message: "something went wrong",
      });
    }

    const complaint = await complaintModel.create({
      user: user._id,
      userRef:user.role,
      complaintPictureUrl: result.url,
      complaintTitle: title,
      complaintDescription: description,
    });

    return res.status(201).json({
      message: "Complaint created successfully",
      complaint:{
        user:complaint.user,
        complaintImage:complaint.complaintPictureUrl,
        title:complaint.complaintTitle,
        description:complaint.complaintDescription,
        createdAt:complaint.createdAt
      }
    });
  } catch (err) {
    return res.status(401).json({
      message: "Unauthorized",
      error: err.message,
    });
  }
}

/**
 *
 * @route getComplaint
 * @description get all the complaint created by a user
 * @access public
 */

async function getComplaint(req,res){

    const accessToken = req.accessToken;

    if(!accessToken){
        return res.status(401).json({
            message:"Unauthorized"
        })
    }

    try{
        const decoded = jwt.verify(accessToken, config.JWT_SECRET);

        const complaints = await complaintModel.find({user:decoded.id, userRef:decoded.role});

        res.status(200).json({
            complaints
        })
    }
    catch(err){
        return res.status(401).json({
            message:"Unauthorized",
            error:err.message
        })
    }
}

module.exports = { createComplaint , getComplaint};