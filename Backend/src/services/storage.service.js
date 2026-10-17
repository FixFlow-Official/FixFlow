const { ImageKit } = require("@imagekit/nodejs");
const config = require("../config/config");

const imagekit = new ImageKit({
    privateKey:config.IMAGEKIT_PRIVATE_KEY
})

async function uploadFile(buffer,title){

    const result = imagekit.files.upload({
        file:buffer.toString("base64"),
        fileName:title,
        folder: "/complaints"
    })

    return result;
}

module.exports = uploadFile;