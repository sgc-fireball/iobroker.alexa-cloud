let fnc = function(doc) {
    if (doc._id.match(/^onvif\.[0-9]+\.[^\.]+]$/)) {
        emit(doc._id, doc);
    }
};