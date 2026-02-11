const multer = require("multer");
const path = require("path");
const fs = require("fs");
const appRoot = require("app-root-path");

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const user = req.user.id;
    const dirPath = path.join(appRoot.path, `public/kyc/${user}`);
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }
    cb(null, dirPath);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(
      null,
      file.fieldname + "-" + uniqueSuffix + path.extname(file.originalname)
    );
  },
});

const fileFilter = (req, file, cb) => {
  if (!file.originalname.match(/\.(jpg|jpeg|png)$/)) {
    return cb(new Error("Only .jpg, .jpeg and .png files are allowed!"), false);
  }
  cb(null, true);
};

const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024,
  },
});

module.exports = upload;
