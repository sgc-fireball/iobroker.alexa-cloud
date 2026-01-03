# iobroker-alexa-cloud-lambda

## Setup

### Step 1: Update: lambda/serverless.yml

Open https://developer.amazon.com/alexa/console/ask/
and update the `custom` section with you values:

```yaml
custom:
  IOBROKER_ENDPOINT: https://iobroker.rumeln.dyndns.hrdns.de
  SMARTHOME_SKILL_ID: amzn1.ask.skill.342d9e85-bcf8-4dfa-8f02-c04d3a186667
```

### Step 2: AWS Credentials

Run

```bash
aws configure --profile iobroker
# AWS Access Key ID [None]: ********************
# AWS Secret Access Key [None]: ****************************************
# Default region name [None]: eu-west-1
# Default output format [None]: 
```

1. open: https://eu-west-1.console.aws.amazon.com/iamv2/home#/users
2. create a user
3. open tab security informations
4. create a new security key

### Step 3: Deploy your Lambda functions

```
npm i
node_modules/.bin/serverless deploy
```

### Step 4: Update Alexa SmartHome Skill

Open your Skill under https://developer.amazon.com/alexa/console/ask/ and navigate to `Build / Smart Home`.
Update under `2. Smart Home service endpoint / AWS Lambda ARN / Default endpoint` with your Lambda ARN from:
https://eu-west-1.console.aws.amazon.com/lambda/home?region=eu-west-1#/functions
