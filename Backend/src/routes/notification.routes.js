const express = require("express");
const { verifyAccessToken } = require("../middlewares/auth.middleware");
const controller = require("../controllers/notification.controller");
const pushController = require("../controllers/pushSubscription.controller");

const router = express.Router();

router.get("/", verifyAccessToken, controller.listNotifications);
router.get("/push-config", verifyAccessToken, pushController.getPushConfig);
router.post("/push-subscription", verifyAccessToken, pushController.savePushSubscription);
router.delete("/push-subscription", verifyAccessToken, pushController.removePushSubscription);
router.patch("/read-all", verifyAccessToken, controller.markAllNotificationsRead);
router.patch("/:notificationId/read", verifyAccessToken, controller.markNotificationRead);

module.exports = router;
