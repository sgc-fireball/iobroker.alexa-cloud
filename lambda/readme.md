# iobroker-alexa-cloud-lambda

## Setup
### Step 1: Update: lambda/serverless.yml
Open https://developer.amazon.com/alexa/console/ask/
and update the `custom` section with you values:
```yaml
custom:
  iobroker_endpoint: https://iobroker.rumeln.dyndns.hrdns.de
  smarthome_skill_id: amzn1.ask.skill.342d9e85-bcf8-4dfa-8f02-c04d3a186667
```

### Step 2: AWS Credentials
Run 
```bash
aws configure --profile iobroker
```
and open: https://console.aws.amazon.com/iam/home?#/security_credentials
to received your access id and key.

### Step 3: Deploy your Lambda functions
```
npm i -g sls
sls deploy
```

### Step 4: Update Alexa SmartHome Skill
Open your Skill under https://developer.amazon.com/alexa/console/ask/ and navigate to `Build / Smart Home`.
Update under `2. Smart Home service endpoint / AWS Lambda ARN / Default endpoint` with your Lambda ARN from:
https://eu-west-1.console.aws.amazon.com/lambda/home?region=eu-west-1#/functions
