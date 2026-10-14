const mongoose = require("mongoose");

const blackListTokenSchema = new mongoose.Schema({
    user:{
        type:mongoose.Schema.Types.ObjectId,
        refPath: "userRef",
        required:[true, "User is required"]
    },
    userRef:{
        type:String,
        enum:["student","staff","admin"],
        required:[true, "User ref is required"]
    },
    accessTokenHash:{
        type:String,
        required:[true, "AccessTokenHash is required"],
        unique:true
    },
    expiresAt: {
      type: Date,
      required: [true, "Expiration date is required"],
      expires: 0, 
    },
},
{
    timestamps:true
})

const blackListTokenModel = mongoose.model("blacklistToken", blackListTokenSchema);

module.exports = blackListTokenModel;