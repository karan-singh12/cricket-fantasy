//Export success response
exports.successResponse = function (res, msg) {
    var data = {
        status: true,
        message: msg,
    };
    return res.status(200).json(data);
};

//Export success response with data
exports.successResponseWithData = function (res, msg, data) {
    var resData = {
        status: true,
        message: msg,
        data: data,
    };
    return res.status(200).json(resData);
};

//Export error response
exports.ErrorResponse = function (res, msg) {
    var data = {
        status: false,
        message: msg,
    };
    return res.status(400).json(data);
};

//Export error response
exports.ErrorResponseWithData = function (res, msg, data) {
    var resData = {
        status: false,
        message: msg,
        data: data,
    };
    return res.status(400).json(resData);
};

//Export not found response
exports.notFoundResponse = function (res, msg) {
    var data = {
        status: false,
        message: msg,
    };
    return res.status(400).json(data);
};

//Export validation error response
exports.validationError = function (res, msg) {
    var resData = {
        status: false,
        message: msg,
    };
    return res.status(400).json(resData);
};

//Export validation error with data response
exports.validationErrorWithData = function (res, msg, data) {
    var resData = {
        status: false,
        message: msg,
        data: data,
    };
    return res.status(400).json(resData);
};

//Export unauthorized response
exports.unauthorizedResponse = function (res, msg) {
    var data = {
        status: false,
        message: msg,
    };
    return res.status(400).json(data);
};