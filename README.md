# iobroker.alexa-cloud

## Todos
- add more HM / HmIP devices
- refactor io-package to only one view
- ONVIF
- HUE

## Setup
### Security Profile / Login with Amazon
- https://developer.amazon.com/settings/console/securityprofile/create-security-profile.html
- https://developer.amazon.com/settings/console/securityprofile/web-settings/update.html

### developer.amazon.com
Create an Smart Home Skill under https://developer.amazon.com/alexa/console/ask

#### Smart Home
- Payload version: v3
- Smart Home service endpoint
    - Default endpoint: `none`
- Account Linking
    - Security Provider Information
        - Auth Code Grant: `Yes`
            - Your Web Authorization URI: `https://iobroker.your.dyndns.com/iobroker/alexa-cloud/auth`
            - Access Token URI: `https://iobroker.your.dyndns.com/iobroker/alexa-cloud/token`
            - Your Client ID: `amzn1.ask.skill.XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX`
            - Your Secret: `secret`
            - Your Authentication Scheme: `Credentials in request body`
            - Scope: `iobroker`
            - Domain List: `iobroker.your.dyndns.com`
- Permissions
    - Send Alexa Events: `On`

Follow the next steps from [Lambda Readme.md](./lambda/readme.md)

## Uninstall
```bash
cd lambda
sls remove
```

## Tests
- https://www.jsonschemavalidator.net/
- https://raw.githubusercontent.com/alexa/alexa-smarthome/master/validation_schemas/alexa_smart_home_message_schema.json

## Sources
- https://developer.amazon.com/de-DE/docs/alexa/smarthome/steps-to-build-a-smart-home-skill.html
- https://developer.amazon.com/en-US/docs/alexa/smarthome/get-started-with-device-templates.html
- https://developer.amazon.com/de-DE/docs/alexa/account-linking/configure-authorization-code-grant.html
- https://developer.amazon.com/de-DE/docs/alexa/account-linking/requirements-account-linking.html#access-token-uri-requirements
- https://developer.amazon.com/en-US/docs/alexa/account-linking/skill-activation-api.html#get-status
- https://developer.amazon.com/en-US/docs/alexa/device-apis/alexa-authorization.html

## TODO
- https://developer.amazon.com/de-DE/docs/alexa/smarthome/steps-to-build-a-smart-home-skill.html
- https://github.com/AlCalzone/release-script
- https://developer.amazon.com/en-US/docs/alexa/alexa-skills-kit-sdk-for-nodejs/develop-your-first-skill.html
