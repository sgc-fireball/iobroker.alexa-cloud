let fnc = function(doc) {
    if (doc._id.match(/^hue-extended\.[0-9]+\.lights\.[^\.]+]$/)) {
        emit(doc._id, doc);
    }
}