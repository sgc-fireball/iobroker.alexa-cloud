const BaseDevice = require('./BaseDevice');

class BaseHomeMaticDevice extends BaseDevice {

    constructor(adapter, object) {
        super(adapter, object);
        this.endpointId = object.endpointId || this.id;
        this.name = object.name;
        this.type = object.type;
        this.address = object.address;
    }

    update(id, state) {
        return super.update(id, state);
    }

}

module.exports = BaseHomeMaticDevice;
