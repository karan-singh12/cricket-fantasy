const { knex: db } = require('../../config/database');
const apiResponse = require("../../utils/apiResponse");
const { listing } = require("../../utils/functions");
const { ERROR, BANNER, SUCCESS } = require("../../utils/responseMsg");

const TABLE = 'banner';

const BannerController = {
    // Add Banner
    async addBanner(req, res) {
        try {
            const { name, description, tournamentId, startDate, endDate ,status } = req.body;
         

            const existing = await db(TABLE).where({ name }).first();
            if (existing) {
                return apiResponse.ErrorResponse(res, BANNER.nameAlreadyExists);
            }

            if (!req.file) {
                return apiResponse.ErrorResponse(res, BANNER.uploadImage);
            }
    
            const imagePath = req.file.path.replace(/\\/g, "/");

            const [result] = await db(TABLE)
                .insert({
                    name,
                    description,
                    tournament_id: tournamentId,
                    status,
                    start_date: db.raw("TO_DATE(?, 'YYYY-MM-DD')", [startDate]),
                    end_date: db.raw("TO_DATE(?, 'YYYY-MM-DD')", [endDate]),
                    image_url: imagePath,
                    created_at: db.fn.now(),
                    updated_at: db.fn.now(),
                })
                .returning("*");

            return apiResponse.successResponseWithData(res, BANNER.bannerAdded, result);
        } catch (error) {
            console.error(error.message);
            return apiResponse.ErrorResponse(res, ERROR.somethingWrong);
        }
    },

    // Update Banner
    async updateBanner(req, res) {
        try {
            const { id, name, description, startDate, endDate} = req.body;

            // const existing = await db(TABLE).where({ name }).first();
            // if (existing) {
            //     return apiResponse.ErrorResponse(res, BANNER.nameAlreadyExists);
            // }

            const updateData = {
                updated_at: db.fn.now()
              };
              
              if (name) updateData.name = name;
              if (description) updateData.description = description;
              if (startDate) updateData.start_date = db.raw("TO_DATE(?, 'YYYY-MM-DD')", [startDate]);
              if (endDate) updateData.end_date = db.raw("TO_DATE(?, 'YYYY-MM-DD')", [endDate]);
              if (req.file) {
                updateData.image_url = req.file.path.replace(/\\/g, "/");
              }
              
              const [data] = await db(TABLE)
                .where({ id })
                .update(updateData)
                .returning("*");

            return apiResponse.successResponseWithData(res, BANNER.bannerUpdated, data);
        } catch (error) {
            console.error(error.message);
            return apiResponse.ErrorResponse(res, ERROR.somethingWrong);
        }
    },

    // Get One Banner
    async getOneBanner(req, res) {
        try {
            const result = await db(TABLE)
                .select("*")
                .where({ id: req.params.id })
                .first();

            return apiResponse.successResponseWithData(res, SUCCESS.dataFound, result);
        } catch (error) {
            console.error(error.message);
            return apiResponse.ErrorResponse(res, ERROR.somethingWrong);
        }
    },

    // Get All Banners
    async getAllBanners(req, res) {
        try {
            const { pageSize = 10, pageNumber = 1, status, searchItem = "" } = req.body;

            const offset = (Math.max(0, pageNumber - 1)) * pageSize;

            const searchQuery = db(TABLE).whereNot("status", 2);

            if (status?.length > 0) {
                searchQuery.andWhere(builder => {
                    builder.whereIn("status", status);
                });
            }

            if (searchItem) {
                searchQuery.andWhere("name", "ilike", `%${searchItem}%`);
            }

            const result = await searchQuery
                .select("id", "name", "status", "description", "start_date", "end_date", "image_url", "created_at")
                .orderBy("created_at", "desc")
                .limit(pageSize)
                .offset(offset);

            const total = await db(TABLE)
                .whereNot("status", 2)
                .count("id")
                .first();

            return apiResponse.successResponseWithData(res, SUCCESS.dataFound, {
                result,
                totalRecords: parseInt(total.count),
                pageNumber,
                pageSize,
            });
        } catch (error) {
            console.error(error.message);
            return apiResponse.ErrorResponse(res, ERROR.somethingWrong);
        }
    },

    // Delete Banner (soft delete)
    async deleteBanner(req, res) {
        try {
            await db(TABLE)
                .where({ id: req.body.id })
                .update({
                    status: 2,
                    updated_at: db.fn.now(),
                });

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

            const [result] = await db(TABLE)
                .where({ id })
                .update({ status, updated_at: db.fn.now() })
                .returning("*");

            const msg = status == 1 ? BANNER.bannerActivated : BANNER.bannerDeactivated;

            return apiResponse.successResponseWithData(res, msg, result);
        } catch (error) {
            console.error(error.message);
            return apiResponse.ErrorResponse(res, ERROR.somethingWrong);
        }
    }
};

module.exports = BannerController; 