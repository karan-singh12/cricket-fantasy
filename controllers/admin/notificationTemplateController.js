const NotificationTemplate = require('../../models/NotificationTemplate');
const Notification = require('../../models/Notification');
const apiResponse = require('../../utils/apiResponse');
const { slugGenrator } = require('../../utils/functions');
const { NOTIFICATIONTEMPLATE, ERROR, SUCCESS, TEMPLATE } = require('../../utils/responseMsg');

const notificationTemplateController = {
    // Create sample notification data for testing
    async createSampleNotification(req, res) {
        try {
            const userId = req.user.id;

            const sampleTemplate = {
                title: 'Welcome to MyBest11!',
                content: 'Hello {username}, welcome to MyBest11! Your account has been created successfully. Start playing and win exciting prizes!',
                notification_type: 'welcome',
                status: 1
            };

            let template = await NotificationTemplate.findOne({
                title: sampleTemplate.title,
                notification_type: sampleTemplate.notification_type
            });

            if (!template) {
                const slug = await slugGenrator(sampleTemplate.title);
                template = await NotificationTemplate.create({
                    ...sampleTemplate,
                    slug,
                    created_by: userId
                });
            }

            // In Mongoose, we'll just create a Notification entry for the user
            const notification = await Notification.create({
                title: template.title,
                content: template.content.replace('{username}', 'Test User'),
                user: userId,
                is_read: false,
                type: template.notification_type,
            });

            return apiResponse.successResponseWithData(res, NOTIFICATIONTEMPLATE.templateCreated, {
                template: { ...template.toObject(), id: template._id },
                notification: { ...notification.toObject(), id: notification._id }
            });

        } catch (error) {
            console.error('Error creating sample notification:', error);
            return apiResponse.ErrorResponse(res, error.message || NOTIFICATIONTEMPLATE.failedtemplateCreated);
        }
    },

    async addNotificationTemplate(req, res) {
        try {
            const { title, content, notification_type } = req.body;
            const slug = await slugGenrator(notification_type);
            const createdBy = req.user.id;

            const existingTemp = await NotificationTemplate.findOne({
                notification_type,
                status: { $ne: 2 }
            });

            if (existingTemp) {
                return apiResponse.ErrorResponse(res, "already exists.");
            }

            const newTemplate = await NotificationTemplate.create({
                title,
                content,
                notification_type,
                slug,
                status: 1,
                created_by: createdBy
            });

            return apiResponse.successResponseWithData(res, NOTIFICATIONTEMPLATE.templateAdded, {
                ...newTemplate.toObject(),
                id: newTemplate._id
            });
        } catch (error) {
            console.error(error);
            return apiResponse.ErrorResponse(res, ERROR.somethingWrong);
        }
    },

    async getAllTemplates(req, res) {
        try {
            let { pageSize = 10, pageNumber = 1, searchItem = "", sortBy = "created_at", sortOrder = "desc", status = [] } = req.body;

            const limit = parseInt(pageSize) || 10;
            const skip = (Math.max(1, parseInt(pageNumber)) - 1) * limit;

            const filter = { status: { $ne: 2 } };

            if (status.length > 0) {
                filter.status = { $in: status.map(Number) };
            }

            if (searchItem) {
                filter.$or = [
                    { title: { $regex: searchItem, $options: "i" } },
                    { content: { $regex: searchItem, $options: "i" } }
                ];
            }

            const totalRecords = await NotificationTemplate.countDocuments(filter);
            const result = await NotificationTemplate.find(filter)
                .sort({ [sortBy]: sortOrder === 'desc' ? -1 : 1 })
                .skip(skip)
                .limit(limit)
                .lean();

            const mappedResult = result.map(template => ({
                ...template,
                id: template._id,
                createdAt: template.created_at
            }));

            return apiResponse.successResponseWithData(res, SUCCESS.dataFound, {
                result: mappedResult,
                totalRecords,
                pageNumber: parseInt(pageNumber),
                pageSize: limit,
            });
        } catch (error) {
            console.log(error.message);
            return apiResponse.ErrorResponse(res, ERROR.somethingWrong);
        }
    },

    async getOneTemplate(req, res) {
        try {
            const { id } = req.params;

            const template = await NotificationTemplate.findById(id).lean();

            if (!template) {
                return apiResponse.ErrorResponse(res, TEMPLATE.templateNotFound);
            }

            return apiResponse.successResponseWithData(res, SUCCESS.dataFound, {
                ...template,
                id: template._id
            });
        } catch (error) {
            console.log(error.message);
            return apiResponse.ErrorResponse(res, ERROR.somethingWrong);
        }
    },

    async updateTemplate(req, res) {
        try {
            const { id, title, content, status } = req.body;

            const updated = await NotificationTemplate.findByIdAndUpdate(id, {
                title,
                content,
                status,
            }, { new: true }).lean();

            if (!updated) {
                return apiResponse.ErrorResponse(res, TEMPLATE.templateNotFound);
            }

            return apiResponse.successResponseWithData(res, NOTIFICATIONTEMPLATE.templateUpdated, {
                ...updated,
                id: updated._id
            });
        } catch (error) {
            console.log(error.message);
            return apiResponse.ErrorResponse(res, ERROR.somethingWrong);
        }
    },

    async changeStatus(req, res) {
        try {
            const { id, status } = req.body;

            if (![0, 1].includes(status)) {
                return apiResponse.ErrorResponse(res, NOTIFICATIONTEMPLATE.invalidStatus);
            }

            const updated = await NotificationTemplate.findByIdAndUpdate(id, { status }, { new: true }).lean();

            if (!updated) {
                return apiResponse.ErrorResponse(res, NOTIFICATIONTEMPLATE.templateNotFound);
            }

            const msg = status === 1 ? NOTIFICATIONTEMPLATE.templateActivated : NOTIFICATIONTEMPLATE.templateDeactivated;
            return apiResponse.successResponseWithData(res, msg, {
                ...updated,
                id: updated._id
            });
        } catch (error) {
            console.log(error.message);
            return apiResponse.ErrorResponse(res, ERROR.somethingWrong);
        }
    },

    async deleteTemplate(req, res) {
        try {
            const { id } = req.body;

            const deleted = await NotificationTemplate.findByIdAndUpdate(id, { status: 2 }, { new: true }).lean();

            if (!deleted) {
                return apiResponse.ErrorResponse(res, NOTIFICATIONTEMPLATE.templateNotFound);
            }

            return apiResponse.successResponseWithData(res, NOTIFICATIONTEMPLATE.templateDeleted, {
                ...deleted,
                id: deleted._id
            });
        } catch (error) {
            console.log(error.message);
            return apiResponse.ErrorResponse(res, ERROR.somethingWrong);
        }
    }
};

module.exports = notificationTemplateController;
