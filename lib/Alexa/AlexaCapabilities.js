/**
 * @see https://developer.amazon.com/en-US/docs/alexa/device-apis/alexa-brightnesscontroller.html
 * @see https://developer.amazon.com/en-US/docs/alexa/smarthome/state-reporting-for-a-smart-home-skill.html
 */
const AlexaCapabilities = {

    findInterface(device, iface, type = 'AlexaInterface') {
        device.capabilities = device.capabilities || [];
        for (let i = 0; i < device.capabilities.length; i++) {
            if (device.capabilities[i].type !== type) {
                continue;
            }
            if (device.capabilities[i].interface !== iface) {
                continue;
            }
            return i;
        }
        return -1;
    },

    default(device) {
        if (this.findInterface(device, 'Alexa') !== -1) {
            return;
        }
        device.capabilities.push({
            type: 'AlexaInterface',
            interface: 'Alexa',
            version: '3'
        });
    },

    brightness(device) {
        if (this.findInterface(device, 'Alexa.BrightnessController') !== -1) {
            return;
        }
        device.capabilities.push({
            type: 'AlexaInterface',
            interface: 'Alexa.BrightnessController',
            version: '3',
            properties: {
                supported: [
                    {name: 'brightness'}
                ],
                proactivelyReported: true,
                retrievable: true
            }
        });
    },

    color(device) {
        if (this.findInterface(device, 'Alexa.ColorController') !== -1) {
            return;
        }
        device.capabilities.push({
            type: 'AlexaInterface',
            interface: 'Alexa.ColorController',
            version: '3',
            properties: {
                supported: [
                    {name: 'color'}
                ],
                proactivelyReported: true,
                retrievable: true
            }
        });
    },

    colorTemperature(device) {
        if (this.findInterface(device, 'Alexa.ColorTemperatureController') !== -1) {
            return;
        }
        device.capabilities.push({
            type: 'AlexaInterface',
            interface: 'Alexa.ColorTemperatureController',
            version: '3',
            properties: {
                supported: [
                    {name: 'colorTemperatureInKelvin'}
                ],
                proactivelyReported: true,
                retrievable: true
            }
        });
    },

    mode(device, options) {
        if (this.findInterface(device, 'Alexa.ModeController') !== -1) {
            return;
        }

        options.instance = options.instance || 'DeviceType.Attribute';
        options.assetId = options.assetId || 'Friendly.Name.Resource'; // @see https://developer.amazon.com/en-US/docs/alexa/device-apis/resources-and-assets.html
        options.supportedModes = {};

        let supportedModes = [];
        options.supportedModes.forEach((assetId, value) => {
            supportedModes.push({
                'value': value,
                'modeResources': {
                    'friendlyNames': [
                        {
                            '@type': 'asset',
                            'value': {
                                'assetId': assetId
                            }
                        }
                    ]
                }
            });
        });

        device.capabilities.push({
            type: 'AlexaInterface',
            interface: 'Alexa.ModeController',
            instance: options.instance,
            version: '3',
            properties: {
                supported: [
                    {name: 'mode'}
                ],
                proactivelyReported: true,
                retrievable: true,
                nonControllable: false
            },
            capabilityResources: {
                friendlyNames: [
                    {
                        '@type': 'asset',
                        value: {
                            assetId: options.assetId
                        }
                    }
                ]
            },
            configuration: {
                ordered: false,
                supportedModes: supportedModes
            }
        });
    },

    percentage(device) {
        if (this.findInterface(device, 'Alexa.PercentageController') !== -1) {
            return;
        }
        device.capabilities.push({
            type: 'AlexaInterface',
            interface: 'Alexa.PercentageController',
            version: '3',
            properties: {
                supported: [
                    {name: 'percentage'}
                ],
                proactivelyReported: true,
                retrievable: true
            }
        });
    },

    power(device) {
        if (this.findInterface(device, 'Alexa.PowerController') !== -1) {
            return;
        }
        device.capabilities.push({
            type: 'AlexaInterface',
            interface: 'Alexa.PowerController',
            version: '3',
            properties: {
                supported: [
                    {name: 'powerState'}
                ],
                proactivelyReported: true,
                retrievable: true
            }
        });
    },

    powerLevel(device) {
        if (this.findInterface(device, 'Alexa.PowerLevelController') !== -1) {
            return;
        }
        device.capabilities.push({
            type: 'AlexaInterface',
            interface: 'Alexa.PowerLevelController',
            version: '3',
            properties: {
                supported: [
                    {name: 'powerLevel'}
                ],
                proactivelyReported: true,
                retrievable: true
            }
        });
    },

    temperatureSensor(device) {
        if (this.findInterface(device, 'Alexa.TemperatureSensor') !== -1) {
            return;
        }
        device.capabilities.push({
            type: 'AlexaInterface',
            interface: 'Alexa.TemperatureSensor',
            version: '3',
            properties: {
                supported: [
                    {name: 'temperature'}
                ],
                proactivelyReported: true,
                retrievable: true
            }
        });
    },

    // @TODO thermostat(device)

    timeHold(device, start = true, end = true, resume = true) {
        if (this.findInterface(device, 'Alexa.TimeHoldController') !== -1) {
            return;
        }
        let capability = {
            type: 'AlexaInterface',
            interface: 'Alexa.TimeHoldController',
            version: '3',
            properties: {
                supported: [],
                proactivelyReported: true,
                retrievable: true
            },
            configuration: {
                allowRemoteResume: resume
            }
        };
        if (start) {
            capability.properties.supported.push({name: 'holdStartTime'});
        }
        if (end) {
            capability.properties.supported.push({name: 'holdEndTime'});
        }
        device.capabilities.push(capability);
    },

    cameraStream(device) {
        if (this.findInterface(device, 'Alexa.CameraStreamController') !== -1) {
            return;
        }
        device.capabilities.push({
            type: 'AlexaInterface',
            interface: 'Alexa.CameraStreamController',
            version: '3',
            cameraStreamConfigurations: [
                {
                    protocols: ['RTSP'],
                    resolutions: [
                        {width: 640, height: 480}
                    ],
                    authorizationTypes: ['NONE'],
                    videoCodecs: ['H264'],
                    audioCodecs: ['AAC']
                }
            ]
        });
    },

    contactSensor(device) {
        if (this.findInterface(device, 'Alexa.ContactSensor') !== -1) {
            return;
        }
        device.capabilities.push({
            type: 'AlexaInterface',
            interface: 'Alexa.ContactSensor',
            version: '3',
            properties: {
                supported: [
                    {name: 'detectionState'}
                ],
                proactivelyReported: true,
                retrievable: true
            }
        });
    },

    endpointHealth(device) {
        if (this.findInterface(device, 'Alexa.EndpointHealth') !== -1) {
            return;
        }
        device.capabilities.push({
            type: 'AlexaInterface',
            interface: 'Alexa.EndpointHealth',
            version: '3',
            properties: {
                supported: [
                    {name: 'connectivity'}
                ],
                proactivelyReported: true,
                retrievable: true
            }
        });
    },

    doorbellEventSource(device) {
        if (this.findInterface(device, 'Alexa.DoorbellEventSource') !== -1) {
            return;
        }
        device.capabilities.push({
            type: 'AlexaInterface',
            interface: 'Alexa.DoorbellEventSource',
            version: '3',
            proactivelyReported: true,
        });
    },

    lock(device) {
        if (this.findInterface(device, 'Alexa.LockController') !== -1) {
            return;
        }
        device.capabilities.push({
            type: 'AlexaInterface',
            interface: 'Alexa.LockController',
            version: '3',
            properties: {
                supported: [
                    {name: 'lockState'}
                ],
                proactivelyReported: true,
                retrievable: true
            }
        });
    },

    motionSensor(device) {
        if (this.findInterface(device, 'Alexa.MotionSensor') !== -1) {
            return;
        }
        device.capabilities.push({
            type: 'AlexaInterface',
            interface: 'Alexa.MotionSensor',
            version: '3',
            properties: {
                supported: [
                    {name: 'detectionState'}
                ],
                proactivelyReported: true,
                retrievable: true
            }
        });
    }

    // @TODO rtcSession(device)

    // @TODO securityPanel(device)

};

module.exports = AlexaCapabilities;
