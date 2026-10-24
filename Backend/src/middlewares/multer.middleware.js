const multer = require("multer");

const MAX_IMAGE_SIZE = 5 * 1024 * 1024;
const acceptedImageTypes = new Set(["image/jpeg", "image/png", "image/webp"]);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_IMAGE_SIZE,
    files: 1,
    fields: 8,
    fieldSize: 16 * 1024,
    parts: 10,
  },
  fileFilter(req, file, callback) {
    if (!acceptedImageTypes.has(file.mimetype)) {
      return callback(new Error("Upload a JPG, PNG, or WebP image."));
    }

    return callback(null, true);
  },
});

function uploadSingleImage(fieldName) {
  const parseSingleImage = upload.single(fieldName);

  return function parseImageRequest(req, res, next) {
    parseSingleImage(req, res, (error) => {
      if (!error) return next();

      if (error instanceof multer.MulterError && error.code === "LIMIT_FILE_SIZE") {
        return res.status(413).json({
          message: "Image must be 5 MB or smaller.",
        });
      }

      if (error instanceof multer.MulterError) {
        return res.status(400).json({
          message: "Upload one JPG, PNG, or WebP image.",
        });
      }

      return res.status(400).json({
        message: error.message || "Could not process the uploaded image.",
      });
    });
  };
}

function detectImageType(buffer) {
  if (
    buffer.length >= 8 &&
    buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
  ) {
    return "image/png";
  }

  if (
    buffer.length >= 3 &&
    buffer[0] === 0xff &&
    buffer[1] === 0xd8 &&
    buffer[2] === 0xff
  ) {
    return "image/jpeg";
  }

  if (
    buffer.length >= 12 &&
    buffer.toString("ascii", 0, 4) === "RIFF" &&
    buffer.toString("ascii", 8, 12) === "WEBP"
  ) {
    return "image/webp";
  }

  return null;
}

function validateImageSignature(req, res, next) {
  if (!req.file) return next();

  const detectedType = detectImageType(req.file.buffer);

  if (!detectedType || detectedType !== req.file.mimetype) {
    return res.status(400).json({
      message: "The uploaded file is not a valid JPG, PNG, or WebP image.",
    });
  }

  return next();
}

module.exports = {
  uploadSingleImage,
  validateImageSignature,
  MAX_IMAGE_SIZE,
};
