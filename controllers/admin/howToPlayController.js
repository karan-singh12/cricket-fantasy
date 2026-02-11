const HowToPlay = require("../../models/HowToPlay");
const apiResponse = require("../../utils/apiResponse");

const howToPlayController = {
  async add(req, res) {
    try {
      const { tab, data } = req.body;
      const sections = data?.sections;

      if (!tab || !Array.isArray(sections)) {
        return apiResponse.validationErrorWithData(
          res,
          "Tab and sections both are required"
        );
      }

      const exists = await HowToPlay.findOne({ tab });
      if (exists) {
        return apiResponse.ErrorResponse(res, "Tab already exists");
      }

      let bannerImagePath = null;
      if (req.file) {
        bannerImagePath = req.file.path.replace(/\\/g, "/");
      }

      const result = await HowToPlay.create({
        tab,
        data: { sections },
        banner_image: bannerImagePath,
      });

      return apiResponse.successResponseWithData(
        res,
        "Tab added successfully",
        { ...result.toObject(), id: result._id }
      );
    } catch (err) {
      console.error(err);
      return apiResponse.ErrorResponse(res, "Failed to add How to Play data");
    }
  },

  async list(req, res) {
    try {
      const { pageNumber = 1, pageSize = 10, search = "" } = req.body;
      const limit = parseInt(pageSize) || 10;
      const skip = (Math.max(1, parseInt(pageNumber)) - 1) * limit;

      const filter = {};
      if (search) {
        filter.tab = { $regex: search, $options: "i" };
      }

      const totalRecords = await HowToPlay.countDocuments(filter);
      const result = await HowToPlay.find(filter)
        .sort({ created_at: -1 })
        .skip(skip)
        .limit(limit)
        .lean();

      const mappedResult = result.map(item => ({
        ...item,
        id: item._id
      }));

      return apiResponse.successResponseWithData(
        res,
        "Tabs fetched successfully",
        {
          result: mappedResult,
          totalRecords,
          pageNumber: Number(pageNumber),
          pageSize: limit,
          totalPages: Math.ceil(totalRecords / limit),
        }
      );
    } catch (err) {
      console.error(err);
      return apiResponse.ErrorResponse(res, "Failed to fetch How to Play data");
    }
  },

  async getOne(req, res) {
    try {
      const { id } = req.params;

      const row = await HowToPlay.findById(id).lean();
      if (!row) {
        return apiResponse.ErrorResponse(res, "Tab not found");
      }

      return apiResponse.successResponseWithData(res, "Tab fetched", { ...row, id: row._id });
    } catch (err) {
      console.error(err);
      return apiResponse.ErrorResponse(res, "Error fetching tab");
    }
  },

  async update(req, res) {
    try {
      const { id, tab, sections } = req.body;

      const updatedData = {};
      if (tab) updatedData.tab = tab;
      if (sections) updatedData.data = { sections };

      if (req.file) {
        updatedData.banner_image = req.file.path.replace(/\\/g, "/");
      }

      const updated = await HowToPlay.findByIdAndUpdate(id, updatedData, { new: true }).lean();

      if (!updated) {
        return apiResponse.ErrorResponse(res, "Update failed");
      }

      return apiResponse.successResponseWithData(res, "Tab updated", { ...updated, id: updated._id });
    } catch (err) {
      console.error(err);
      return apiResponse.ErrorResponse(
        res,
        "Failed to update How to Play data"
      );
    }
  },

  async changeStatus(req, res) {
    try {
      const { id, status } = req.body;

      if (typeof status !== 'boolean') {
        return apiResponse.ErrorResponse(res, "Invalid status");
      }

      const updated = await HowToPlay.findByIdAndUpdate(id, { status }, { new: true }).lean();

      if (!updated) {
        return apiResponse.ErrorResponse(res, "Status change failed");
      }

      return apiResponse.successResponseWithData(
        res,
        "Status updated",
        { ...updated, id: updated._id }
      );
    } catch (err) {
      console.error(err);
      return apiResponse.ErrorResponse(res, "Failed to update status");
    }
  },

  async delete(req, res) {
    try {
      const { id } = req.params;

      const deleted = await HowToPlay.findByIdAndDelete(id);

      if (!deleted) {
        return apiResponse.ErrorResponse(
          res,
          "Tab not found or already deleted"
        );
      }

      return apiResponse.successResponse(res, "Tab deleted successfully");
    } catch (err) {
      console.error(err);
      return apiResponse.ErrorResponse(res, "Failed to delete tab");
    }
  },
};

module.exports = howToPlayController;
