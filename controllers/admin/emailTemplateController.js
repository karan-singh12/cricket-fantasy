const { knex:db } = require('../../config/database');
const config = require('../../config/config');
const apiResponse = require('../../utils/apiResponse');
const { slugGenrator } = require('../../utils/functions');
const { EMAILTEMPLATE, ERROR, SUCCESS, USER } = require('../../utils/responseMsg');


const emailTemplateController = {
    
    async addEmailTemplate(req, res) {
    
        try {
            const { title, subject, content } = req.body;
            const slug = await slugGenrator(title);
            const createdBy = req.user.id;

            const [newTemplate] = await db('emailtemplates')
                .insert({
                    title,
                    subject,
                    content,
                    slug,
                    createdBy: createdBy,
                    status: 1,
                    created_at: db.fn.now(),
                    updated_at: db.fn.now(),
                })
                .returning('*');

            return apiResponse.successResponseWithData(res, EMAILTEMPLATE.templateAdded, newTemplate);
        } catch (error) {
            console.error(error);
            return apiResponse.ErrorResponse(res, ERROR.somethingWrong);
        }
    },

    async getAllTemplate(req, res) {
        try {
            let { pageSize, pageNumber, searchItem = "", sortBy = "created_at", sortOrder = "desc", status = [] } = req.body;

            pageNumber = Math.max(0, pageNumber - 1);
            let query = db('emailtemplates').whereNot('status', 2);

            if (status.length > 0) {
                query.andWhere(qb => qb.whereIn('status', status));
            }

            if (searchItem) {
                query.andWhere(builder =>
                    builder
                        .whereILike('title', `%${searchItem}%`)
                        .orWhereILike('subject', `%${searchItem}%`)
                );
            }

            const totalRecords = await query.clone().count().first();

            const result = await query
                .select('id', 'title', 'subject', 'status', 'createdBy', 'created_at')
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

            const template = await db('emailtemplates')
                .where({ id })
                .select('*')
                .first();

            if (!template) {
                return apiResponse.ErrorResponse(res, EMAILTEMPLATE.templateNotFound);
            }

            return apiResponse.successResponseWithData(res, SUCCESS.dataFound, template);
        } catch (error) {
            console.log(error.message);
            return apiResponse.ErrorResponse(res, ERROR.somethingWrong);
        }
    },

    async updateTemplate(req, res) {
        try {
            const { id, title, subject, content, status } = req.body;
       

            const [updated] = await db('emailtemplates')
                .where({ id })
                .update({
                    title,
                    subject,
                    content,
                    status,
                    updated_at: db.fn.now(),
                })
                .returning('*');

            return apiResponse.successResponseWithData(res, EMAILTEMPLATE.templateUpdated, updated);
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
                return apiResponse.ErrorResponse(res, USER.invalidStatusValue);
            }

            const [updated] = await db('emailtemplates')
                .where({ id })
                .update({ status, updated_at: db.fn.now() })
                .returning('*');

            if (!updated) {
                return apiResponse.ErrorResponse(res, EMAILTEMPLATE.templateNotUpdated);
            }

            const msg = status === 1 ? EMAILTEMPLATE.templateActived : EMAILTEMPLATE.templateInactived;
            return apiResponse.successResponseWithData(res, msg, updated);
        } catch (error) {
            console.log(error.message);
            return apiResponse.ErrorResponse(res, ERROR.somethingWrong);
        }
    },

    async deleteTemplate(req, res) {
        try {
            const { id } = req.body;

            const [deleted] = await db('emailtemplates')
                .where({ id })
                .update({ status: 2, updated_at: db.fn.now() })
                .returning('*');

            if (!deleted) {
                return apiResponse.ErrorResponse(res, EMAILTEMPLATE.templateNotUpdated);
            }

            return apiResponse.successResponseWithData(res, EMAILTEMPLATE.templateDeleted, deleted);
        } catch (error) {
            console.log(error.message);
            return apiResponse.ErrorResponse(res, ERROR.somethingWrong);
        }
    }
};

module.exports = emailTemplateController; 