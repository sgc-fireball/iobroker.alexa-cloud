let fnc = function(doc) {
    if (doc._id.match(/^hue-extended\.[0-9]+\.lights\.[0-9]{3}[^\.]+$/)) {
        if (!!doc && !!doc.common && !!doc.common.name) {
            emit(doc._id, {
                id: doc._id,
                _type: 'hue-extended',
                name: doc.common.name
            });
        }
    }
};
