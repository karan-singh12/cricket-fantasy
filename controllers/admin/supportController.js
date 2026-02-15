const { knex: db } = require('../../config/database');
const apiResponse = require("../../utils/apiResponse");
const { listing } = require("../../utils/functions");
const { ERROR,SUCCESS,SUPPORT } = require("../../utils/responseMsg");


const supportController = {
    // Get all support queries with pagination and search
    async getAllQueries(req, res) {
        try {
          let {
            pageSize = 10,
            pageNumber = 1,
            searchItem = "",
            sortBy = "created_at",
            sortOrder = "desc",
            status = [],
            type,
          } = req.body;
        
      
          const offsetPage = Math.max(0, pageNumber - 1);
      
          
      
          let query = db('support')
          .leftJoin('users', 'support.user_id', 'users.id'); 
        
        if (status.length > 0) {
          query.whereIn('support.status', status);
        }
        
        if (type) {
          query.where('support.type', type);
        }
      
    if (searchItem) {
      query.where(function () {
        this.where('users.email', 'ilike', `%${searchItem}%`)
            .orWhere('users.phone', 'ilike', `%${searchItem}%`)
            .orWhere('support.type', 'ilike', `%${searchItem}%`) 
            .orWhere('support.message', 'ilike', `%${searchItem}%`)
            .orWhere('support.response', 'ilike', `%${searchItem}%`);
      }
    )}

    const totalRecordsData = await query.clone().count().first();
    const totalRecords = Number(totalRecordsData.count) || 0;
      
    const result = await query
    .select(
      'support.*',
      'users.phone as user_phone'
    )
    .orderBy(`support.${sortBy}`, sortOrder)
    .limit(pageSize)
    .offset(pageSize * offsetPage);

  return apiResponse.successResponseWithData(res, SUCCESS.dataFound, {
    result,
    totalRecords,
    pageNumber,
    pageSize,
  });
        } catch (error) {
          console.error('Error getting support queries:', error);
          return apiResponse.ErrorResponse(res, ERROR.somethingWrong);
        }
      }
      ,

    // Get single support query by ID
    async getOneQuery(req, res) {
        try {
            const { id } = req.params;

            const query = await db('support')
                .select(
                    'support.*',
                    'users.phone as user_phone'
                )
                .leftJoin('users', 'support.user_id', 'users.id')
                .where('support.id', id)
                .first();

            if (!query) {
                return apiResponse.notFoundResponse(res, SUPPORT.queryNotFound);
            }

            return apiResponse.successResponseWithData(res, SUCCESS.dataFound, query);
        } catch (error) {
            console.error('Error getting support query:', error);
            return apiResponse.ErrorResponse(res, ERROR.somethingWrong);
        }
    },

    // Resolve support query and send email
    async resolveQuery(req, res) {
        try {
            const { id, responseMessage } = req.body;

            if(!id){
              return apiResponse.ErrorResponse(res,"id is required")
            }

            // Get the query first
            const supportQuery = await db('support')
                .select('support.*', 'users.email as user_email', 'users.name as user_name')
                .leftJoin('users', 'support.user_id', 'users.id')
                .where('support.id', id)
                .first();

            if (!supportQuery) {
                return apiResponse.notFoundResponse(res, SUPPORT.queryNotFound);
            }

            // Update the query status to resolved (status = 2)
            const [updatedQuery] = await db('support')
                .where('id', id)
                .update({
                    status: 2,
                    response:responseMessage,
                    updated_at: db.fn.now()
                })
                .returning('*');

            return apiResponse.successResponseWithData(res, SUPPORT.queryResolved, updatedQuery);
        } catch (error) {
            console.error('Error resolving support query:', error);
            return apiResponse.ErrorResponse(res, ERROR.somethingWrong);
        }
    }
};

module.exports = supportController; 