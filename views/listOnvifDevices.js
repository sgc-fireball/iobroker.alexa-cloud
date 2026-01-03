let fnc = function(doc) {
    if (doc._id.match(/^alexa-cloud\.[0-9]+\.onvif\.[^\.]+]$/)) {
        emit(doc._id, doc);
    }
};
