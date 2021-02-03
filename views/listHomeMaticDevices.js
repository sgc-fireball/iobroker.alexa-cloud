let fnc = function(doc) {
    if (doc._id.match(/^hm-rpc\.[0-9]+\.[A-Za-z0-9_-]+$/)) {
        if (!!doc && !!doc.common && !!doc.native) {
            if (!!doc.common.name && !!doc.native.TYPE && !!doc.native.ADDRESS) {
                emit(doc._id, {
                    id: doc._id,
                    name: doc.common.name,
                    type: doc.native.TYPE,
                    address: doc.native.ADDRESS
                });
            }
        }
    }
};