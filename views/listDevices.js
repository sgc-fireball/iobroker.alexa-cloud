let fnc = function (doc) {
    if (doc._id.match(/^hm-rpc\.[0-9]+\.[A-Za-z0-9_-]+$/)) {
        if (!!doc && !!doc.common && !!doc.native) {
            if (!!doc.common.name && !!doc.native.TYPE && !!doc.native.ADDRESS) {
                emit(doc._id, {
                    id: doc._id,
                    _type: 'hm-rpc',
                    name: doc.common.name,
                    type: doc.native.TYPE,
                    address: doc.native.ADDRESS
                });
            }
        }
    } else if (doc._id.match(/^hue-extended\.[0-9]+\.lights\.[0-9]{3}[^\.]+$/)) {
        if (!!doc && !!doc.common && !!doc.common.name) {
            emit(doc._id, {
                id: doc._id,
                _type: 'hue-extended',
                name: doc.common.name
            });
        }
    } else if (doc._id.match(/^alexa-cloud\.[0-9]+\.onvif\.[^\.]+$/)) {
        emit(doc._id, {
            id: doc._id,
            _type: 'onvif'
        });
    }
};
