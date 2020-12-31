let fnc = function (doc) {
    if (doc._id.match(/^hm-rpc\.[0-9]+\.[A-Za-z0-9_-]+$/)) {
        emit(doc._id, doc);
        /*if (!!doc.value && !!doc.value.common && !!doc.value.native) {
            if (!!doc.value.common.name && !!doc.value.native.TYPE && !!doc.value.native.ADDRESS) {
                emit(doc._id, {
                    id: doc._id,
                    name: doc.value.common.name,
                    type: doc.value.native.TYPE,
                    address: doc.value.native.ADDRESS,
                });
            }
        }*/
    }
}