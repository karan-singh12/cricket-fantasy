const { knex: db } = require('../../config/database');
const config = require('../../config/config');
const apiResponse = require('../../utils/apiResponse');
const { slugGenrator } = require('../../utils/functions');
const { NOTIFICATIONTEMPLATE, ERROR, SUCCESS ,TEMPLATE} = require('../../utils/responseMsg');

const notificationTemplateController = {
    // Create sample notification data for testing
    async createSampleNotification(req, res) {
        try {
            const userId = req.user.id;

            // 1. Create a sample template if it doesn't exist
            const sampleTemplate = {
                title: 'Welcome to MyBest11!',
                content: 'Hello {username}, welcome to MyBest11! Your account has been created successfully. Start playing and win exciting prizes!',
                notification_type: 'welcome',
                status: 1
            };

            // Check if sample template already exists
            let template = await db('notification_templates')
                .where({
                    title: sampleTemplate.title,
                    notification_type: sampleTemplate.notification_type
                })
                .first();

            // Insert template if it doesn't exist
            if (!template) {
                const slug = await slugGenrator(sampleTemplate.title);
                [template] = await db('notification_templates')
                    .insert({
                        ...sampleTemplate,
                        slug,
                        created_by: userId,
                        created_at: db.fn.now(),
                        modified_at: db.fn.now()
                    })
                    .returning('*');
            }

            // 2. Create a sample notification using this template
            const notificationData = {
                title: template.title,
                content: template.content.replace('{username}', 'Test User'),
                template_id: template.id,
                created_by: userId,
                created_at: db.fn.now(),
                updated_at: db.fn.now()
            };

            const [notification] = await db('notifications')
                .insert(notificationData)
                .returning('*');

            // 3. Create user notification entry
            const userNotification = {
                notification_id: notification.id,
                user_id: userId,  // Sending to the admin who triggered this
                is_read: 0,
                created_at: db.fn.now()
            };

            await db('user_notifications').insert(userNotification);

            return apiResponse.successResponseWithData(res, NOTIFICATIONTEMPLATE.templateCreated, {
                template,
                notification: {
                    ...notification,
                    user_notification: userNotification
                }
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

            const existingTemp = await db('notification_templates')
                .where('notification_type', notification_type)
                .whereNot('status', 2)
                .first();

            if (existingTemp) {
                return apiResponse.ErrorResponse(res, "already exists.");
            }

            const [newTemplate] = await db('notification_templates')
                .insert({
                    title,
                    content,
                    notification_type,
                    slug,
                    status: 1,
                    created_at: db.fn.now(),
                    modified_at: db.fn.now(),
                })
                .returning('*');

            return apiResponse.successResponseWithData(res, NOTIFICATIONTEMPLATE.templateAdded, newTemplate);
        } catch (error) {
            console.error(error);
            return apiResponse.ErrorResponse(res, ERROR.somethingWrong);
        }
    },

    async getAllTemplates(req, res) {
        try {
            let { pageSize, pageNumber, searchItem = "", sortBy = "created_at", sortOrder = "desc", status = [] } = req.body;

            pageNumber = Math.max(0, pageNumber - 1);
            let query = db('notification_templates').whereNot('status', 2);

            if (status.length > 0) {
                query.andWhere(qb => qb.whereIn('status', status));
            }

            if (searchItem) {
                query.andWhere(builder =>
                    builder
                        .whereILike('title', `%${searchItem}%`)
                        .orWhereILike('content', `%${searchItem}%`)
                );
            }

            const totalRecords = await query.clone().count().first();

            const result = await query
                .select('id', 'title', 'content', 'status', 'created_at')
                .orderBy(sortBy, sortOrder)
                .limit(pageSize)
                .offset(pageSize * pageNumber);

            return apiResponse.successResponseWithData(res, SUCCESS.dataFound, {
                result,
                totalRecords: parseInt(totalRecords.count),
                pageNumber: pageNumber + 1,
                pageSize,
            });
        } catch (error) {
            console.log(error.message);
            return apiResponse.ErrorResponse(res, ERROR.somethingWrong);
        }
    },

    async getOneTemplate(req, res) {
        try {
            const { id } = req.params;

            const template = await db('notification_templates')
                .where({ id })
                .select('*')
                .first();

            if (!template) {
                return apiResponse.ErrorResponse(res, TEMPLATE.templateNotFound);
            }

            return apiResponse.successResponseWithData(res, SUCCESS.dataFound, template);
        } catch (error) {
            console.log(error.message);
            return apiResponse.ErrorResponse(res, ERROR.somethingWrong);
        }
    },

    async updateTemplate(req, res) {
        try {
            const { id, title, content, status } = req.body;

            

            const [updated] = await db('notification_templates')
                .where({ id })
                .update({
                    title,
                    content,
                    status,
                    modified_at: db.fn.now(),
                })
                .returning('*');

            return apiResponse.successResponseWithData(res, NOTIFICATIONTEMPLATE.templateUpdated, updated);
        } catch (error) {
            console.log(error.message);
            return apiResponse.ErrorResponse(res, ERROR.somethingWrong);
        }
    },

    async changeStatus(req, res) {
        try {
            const { id } = req.body;
            const { status } = req.body;

            if (![0, 1].includes(status)) {
                return apiResponse.ErrorResponse(res, NOTIFICATIONTEMPLATE.invalidStatus);
            }

            const [updated] = await db('notification_templates')
                .where({ id })
                .update({ status, modified_at: db.fn.now() })
                .returning('*');

            if (!updated) {
                return apiResponse.ErrorResponse(res, NOTIFICATIONTEMPLATE.templateNotUpdated);
            }

            const msg = status === 1 ? NOTIFICATIONTEMPLATE.templateActivated : NOTIFICATIONTEMPLATE.templateDeactivated;
            return apiResponse.successResponseWithData(res, msg, updated);
        } catch (error) {
            console.log(error.message);
            return apiResponse.ErrorResponse(res, ERROR.somethingWrong);
        }
    },

    async deleteTemplate(req, res) {
        try {
            const { id } = req.body;

            const [deleted] = await db('notification_templates')
                .where({ id })
                .update({ status: 2, modified_at: db.fn.now() })
                .returning('*');

            if (!deleted) {
                return apiResponse.ErrorResponse(res, NOTIFICATIONTEMPLATE.templateNotUpdated);
            }

            return apiResponse.successResponseWithData(res, NOTIFICATIONTEMPLATE.templateDeleted, deleted);
        } catch (error) {
            console.log(error.message);
            return apiResponse.ErrorResponse(res, ERROR.somethingWrong);
        }
    }
};

module.exports = notificationTemplateController;
