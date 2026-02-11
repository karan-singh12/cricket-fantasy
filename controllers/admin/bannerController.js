const Banner = require('../../models/Banner');
const apiResponse = require("../../utils/apiResponse");
const { ERROR, BANNER, SUCCESS } = require("../../utils/responseMsg");
const mongoose = require('mongoose');

const BannerController = {
    // Add Banner
    async addBanner(req, res) {
        try {
            const { name, description, tournamentId, startDate, endDate, status = 1 } = req.body;

            const existing = await Banner.findOne({ name });
            if (existing) {
                return apiResponse.ErrorResponse(res, BANNER.nameAlreadyExists);
            }

            if (!req.file) {
                return apiResponse.ErrorResponse(res, BANNER.uploadImage);
            }

            const imagePath = req.file.path.replace(/\\/g, "/");

            const banner = await Banner.create({
                name,
                description,
                tournament: mongoose.isValidObjectId(tournamentId) ? tournamentId : null,
                status,
                start_date: new Date(startDate),
                end_date: new Date(endDate),
                image_url: imagePath,
            });

            return apiResponse.successResponseWithData(res, BANNER.bannerAdded, {
                ...banner.toObject(),
                id: banner._id
            });
        } catch (error) {
            console.error(error.message);
            return apiResponse.ErrorResponse(res, ERROR.somethingWrong);
        }
    },

    // Update Banner
    async updateBanner(req, res) {
        try {
            const { id, name, description, startDate, endDate } = req.body;

            const updateData = {};
            if (name) updateData.name = name;
            if (description) updateData.description = description;
            if (startDate) updateData.start_date = new Date(startDate);
            if (endDate) updateData.end_date = new Date(endDate);
            if (req.file) {
                updateData.image_url = req.file.path.replace(/\\/g, "/");
            }

            const data = await Banner.findByIdAndUpdate(id, updateData, { new: true }).lean();

            if (!data) {
                return apiResponse.ErrorResponse(res, BANNER.bannerNotFound);
            }

            return apiResponse.successResponseWithData(res, BANNER.bannerUpdated, {
                ...data,
                id: data._id
            });
        } catch (error) {
            console.error(error.message);
            return apiResponse.ErrorResponse(res, ERROR.somethingWrong);
        }
    },

    // Get One Banner
    async getOneBanner(req, res) {
        try {
            const result = await Banner.findById(req.params.id).lean();

            if (!result) {
                return apiResponse.ErrorResponse(res, BANNER.bannerNotFound);
            }

            return apiResponse.successResponseWithData(res, SUCCESS.dataFound, {
                ...result,
                id: result._id
            });
        } catch (error) {
            console.error(error.message);
            return apiResponse.ErrorResponse(res, ERROR.somethingWrong);
        }
    },

    // Get All Banners
    async getAllBanners(req, res) {
        try {
            const { pageSize = 10, pageNumber = 1, status = [], searchItem = "" } = req.body;

            const limit = parseInt(pageSize) || 10;
            const skip = (Math.max(1, parseInt(pageNumber)) - 1) * limit;

            const filter = { status: { $ne: 2 } };

            if (status.length > 0) {
                filter.status = { $in: status.map(Number) };
            }

            if (searchItem) {
                filter.name = { $regex: searchItem, $options: "i" };
            }

            const totalRecords = await Banner.countDocuments(filter);
            const result = await Banner.find(filter)
                .sort({ created_at: -1 })
                .skip(skip)
                .limit(limit)
                .lean();

            const mappedResult = result.map(banner => ({
                ...banner,
                id: banner._id
            }));

            return apiResponse.successResponseWithData(res, SUCCESS.dataFound, {
                result: mappedResult,
                totalRecords,
                pageNumber: parseInt(pageNumber),
                pageSize: limit,
            });
        } catch (error) {
            console.error(error.message);
            return apiResponse.ErrorResponse(res, ERROR.somethingWrong);
        }
    },

    // Delete Banner (soft delete)
    async deleteBanner(req, res) {
        try {
            const { id } = req.body;
            const updated = await Banner.findByIdAndUpdate(id, {
                status: 2,
            }, { new: true });

            if (!updated) {
                return apiResponse.ErrorResponse(res, BANNER.bannerNotFound);
            }

            return apiResponse.successResponse(res, BANNER.bannerDeleted);
        } catch (error) {
            console.error(error.message);
            return apiResponse.ErrorResponse(res, ERROR.somethingWrong);
        }
    },

    // Change Status (active/inactive)
    async changeStatus(req, res) {
        try {
            const { id, status } = req.body;

            const result = await Banner.findByIdAndUpdate(id, { status }, { new: true }).lean();

            if (!result) {
                return apiResponse.ErrorResponse(res, BANNER.bannerNotFound);
            }

            const msg = status == 1 ? BANNER.bannerActivated : BANNER.bannerDeactivated;

            return apiResponse.successResponseWithData(res, msg, {
                ...result,
                id: result._id
            });
        } catch (error) {
            console.error(error.message);
            return apiResponse.ErrorResponse(res, ERROR.somethingWrong);
        }
    }
};

module.exports = BannerController;