let fnc = function (doc) {
    if (doc._id.match(/^alexa-cloud\.[0-9]+\.onvif\.[^\.]+/)) {
        emit(doc._id, { id: doc._id, type: 'onvif', ...doc });
    }
};
