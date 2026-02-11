const EmailTemplate = require('../../models/EmailTemplate');
const apiResponse = require('../../utils/apiResponse');
const { slugGenrator } = require('../../utils/functions');
const { EMAILTEMPLATE, ERROR, SUCCESS, USER } = require('../../utils/responseMsg');

const emailTemplateController = {

    async addEmailTemplate(req, res) {
        try {
            const { title, subject, content } = req.body;
            const slug = await slugGenrator(title);
            const createdBy = req.user.id;

            const newTemplate = await EmailTemplate.create({
                title,
                subject,
                content,
                slug,
                createdBy,
                status: 1,
            });

            return apiResponse.successResponseWithData(res, EMAILTEMPLATE.templateAdded, {
                ...newTemplate.toObject(),
                id: newTemplate._id
            });
        } catch (error) {
            console.error(error);
            return apiResponse.ErrorResponse(res, ERROR.somethingWrong);
        }
    },

    async getAllTemplate(req, res) {
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
                    { subject: { $regex: searchItem, $options: "i" } }
                ];
            }

            const totalRecords = await EmailTemplate.countDocuments(filter);
            const result = await EmailTemplate.find(filter)
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

            const template = await EmailTemplate.findById(id).lean();

            if (!template) {
                return apiResponse.ErrorResponse(res, EMAILTEMPLATE.templateNotFound);
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
            const { id, title, subject, content, status } = req.body;

            const updated = await EmailTemplate.findByIdAndUpdate(id, {
                title,
                subject,
                content,
                status,
            }, { new: true }).lean();

            if (!updated) {
                return apiResponse.ErrorResponse(res, EMAILTEMPLATE.templateNotFound);
            }

            return apiResponse.successResponseWithData(res, EMAILTEMPLATE.templateUpdated, {
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
                return apiResponse.ErrorResponse(res, USER.invalidStatusValue);
            }

            const updated = await EmailTemplate.findByIdAndUpdate(id, { status }, { new: true }).lean();

            if (!updated) {
                return apiResponse.ErrorResponse(res, EMAILTEMPLATE.templateNotFound);
            }

            const msg = status === 1 ? EMAILTEMPLATE.templateActived : EMAILTEMPLATE.templateInactived;
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

            const deleted = await EmailTemplate.findByIdAndUpdate(id, { status: 2 }, { new: true }).lean();

            if (!deleted) {
                return apiResponse.ErrorResponse(res, EMAILTEMPLATE.templateNotFound);
            }

            return apiResponse.successResponseWithData(res, EMAILTEMPLATE.templateDeleted, {
                ...deleted,
                id: deleted._id
            });
        } catch (error) {
            console.log(error.message);
            return apiResponse.ErrorResponse(res, ERROR.somethingWrong);
        }
    }
};

module.exports = emailTemplateController;