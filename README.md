# iobroker.alexa-cloud

## Roadmap
### Mailstone One
The first milestone is to develop a standalone adapter that does not
require another cloud system. However, iobroker is to be released for
the Internet so that Amazon's servers can reach your instances.

ATTENTION: It is strongly recommended not to release ioBroker with the
complete ioBroker with all adapters. If this should be done anyway,
please provide all other security relevant content with an
Auth Basic password protection or even release it exclusively to
certain IP addresses!

### Mailstone Two
The second milestone is to develop an Amazon Lambda function with
IoT Core Cloud and an Authication Adapter that acts as a reverse proxy
to your iobroker instances, like the "iobroker.iot" adapter.

This will also allow those who do not have the ability or means
to build their own reverse proxy to use this adapter.


## Sources
- https://developer.amazon.com/de-DE/docs/alexa/smarthome/steps-to-build-a-smart-home-skill.html
