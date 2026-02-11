const express = require("express");
const router = express.Router();
const upload = require("../../middleware/uploads");

const howToPlayController = require("../../controllers/admin/howToPlayController");
const adminAuth = require("../../middleware/adminAuth");

router.post(
  "/how-to-play/add",
  upload.single("image"),
  adminAuth,
  howToPlayController.add
);
router.post("/how-to-play/list", howToPlayController.list);
router.get("/how-to-play/:id", adminAuth, howToPlayController.getOne);
router.post(
  "/how-to-play/update",
  adminAuth,
  upload.single("image"),
  howToPlayController.update
);
router.post("/how-to-play/status", adminAuth, howToPlayController.changeStatus);
router.post("/how-to-play/delete/:id", adminAuth, howToPlayController.delete);

module.exports = router;
