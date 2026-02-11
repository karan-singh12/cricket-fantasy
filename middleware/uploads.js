var multer = require("multer");
var appRoot = require("app-root-path");
var path = require("path");
var fs = require("fs");

var storage = multer.diskStorage({
  destination: function (req, file, cb) {
    if (req.path.includes("/upload")) {
      req.body.imagePath = "apk";   // 👈 force apk folder
    }
    if (req.path.includes("/how-to-play")) {
      req.body.imagePath = "howtoplay";
    }

    let dirPath = `/public/${req.body.imagePath}`;
    var dir = path.join(appRoot.path, dirPath);

    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    cb(null, "public/" + req.body.imagePath);
  },
  filename: (req, file, cb) => {
    return cb(null, Date.now() + "-" + file.originalname);
  },
});

const multerFilter = (req, file, cb) => {

  req.error = null;

  if (req.path.includes("/upload")) {
    req.body.imagePath = "apk";
    if (file.mimetype === "application/vnd.android.package-archive") {
      return cb(null, true);
    } else {
      req.error = "Only APK files allowed.";
      return cb(null, false);
    }
  }
  if (req.path.includes("/how-to-play")) {
    req.body.imagePath = "howtoplay";
  }

  if (req.path.includes("/addScreenshot")) {
    req.body.imagePath = "screenshots";
  }

  if (req.body.imagePath && req.body.imagePath == "team") {
    if (
      file.mimetype.split("/")[1] === "png" ||
      file.mimetype.split("/")[1] === "jpg" ||
      file.mimetype.split("/")[1] === "jpeg" ||
      file.mimetype.split("/")[1] === "webp"
    ) {
      return cb(null, true);
    } else {
      req.error = "Only png, jpg, jpeg , image/webp allowed.";
      return cb(null, false);
    }
  } else if (req.body.imagePath && req.body.imagePath == "cms") {
    if (
      file.mimetype.split("/")[1] === "png" ||
      file.mimetype.split("/")[1] === "jpg" ||
      file.mimetype.split("/")[1] === "jpeg" ||
      file.mimetype.split("/")[1] === "webp"
    ) {
      return cb(null, true);
    } else {
      req.error = "Only png, jpg, jpeg , image/webp allowed.";
      return cb(null, false);
    }
  } else if (req.body.imagePath && req.body.imagePath === "howtoplay") {
    if (
      file.mimetype.split("/")[1] === "png" ||
      file.mimetype.split("/")[1] === "jpg" ||
      file.mimetype.split("/")[1] === "jpeg" ||
      file.mimetype.split("/")[1] === "webp"
    ) {
      return cb(null, true);
    } else {
      req.error = "Only png, jpg, jpeg, webp allowed.";
      return cb(null, false);
    }
  } else if (req.body.imagePath && req.body.imagePath === "banner") {
    if (
      file.mimetype.split("/")[1] === "png" ||
      file.mimetype.split("/")[1] === "jpg" ||
      file.mimetype.split("/")[1] === "jpeg" ||
      file.mimetype.split("/")[1] === "webp"
    ) {
      return cb(null, true);
    } else {
      req.error = "Only png, jpg, jpeg, webp allowed.";
      return cb(null, false);
    }
  } else if (
    req.path === "/updatePersonalDetails" ||
    req.path === "/updateUser"
  ) {
    if (
      file.mimetype.split("/")[1] === "png" ||
      file.mimetype.split("/")[1] === "jpg" ||
      file.mimetype.split("/")[1] === "jpeg" ||
      file.mimetype.split("/")[1] === "webp"
    ) {
      req.body.imagePath = "user";
      return cb(null, true);
    } else {
      req.error = "Only png, jpg, jpeg, webp allowed.";
      return cb(null, false);
    }
  }

  // ------
  else if (req.body.imagePath && req.body.imagePath === "screenshots") {
  
  
    const allowedImage = ["image/png", "image/jpg", "image/jpeg", "image/webp"];
    const allowedVideo = [
      "video/mp4",
      "video/quicktime", // mov
      "video/x-msvideo", // avi
      "video/x-matroska" // mkv
    ];
  
    if (allowedImage.includes(file.mimetype)) {
      file.originalname = file.originalname.replace(/\s+/g, "_");
      file.fileType = "image";
      return cb(null, true);
    } else if (allowedVideo.includes(file.mimetype)) {
      file.originalname = file.originalname.replace(/\s+/g, "_");
      file.fileType = "video";
      return cb(null, true);
    } else {
      req.error =
        "Only png, jpg, jpeg, webp, mp4, mov, avi, mkv allowed.";
      return cb(null, false);
    }
  }
  
  
};

module.exports = multer({ storage: storage, fileFilter: multerFilter });
