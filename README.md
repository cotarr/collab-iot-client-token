# collab-iot-client-token

IOT device client credentials grant for collab-auth learning project.

## Description

The project [collab-auth](https://github.com/cotarr/collab-auth) was a learning project 
with documentation [here](https://cotarr.github.io/collab-auth/).
Collab-auth is a custom Oauth 2.0 server that was coded using 
[oauth2orize](https://github.com/jaredhanson/oauth2orize).
The scope of the project was aimed at authentication for a home network or personal server.

The GitHub repository [collab-iot-device](https://github.com/cotarr/collab-iot-device) 
is a mock IOT device that will emulate data collection from a physical device on a home network
and subsequent submission to a mock REST API.

This npm package **collab-iot-client-token** is used by collab-iot-device to request an 
IOT device Oauth 2.0 access token using client credentials grant. 

This module has zero npm dependencies.

The implementation of address path names, user, client, and token meta-data is unique to the collab-auth implementation 
of Oauth 2.0, so it is unlikely this repository could serve as a generic oauth2 module. 
However, you may find it interesting.

## Token types

A note of clarification, Oauth 2.0 supports different types of tokens.
This module is intended to obtain an access token using 
**client credentials** code grant. This is sometimes referred to as 
a device token or machine token. In the case of a raspberry pi using 
a temperature sensor on a refrigerator, this grant type would 
provide database permissions that are limited to the data submission.

On the other hand, an end user who would later view the data in a web browser 
would typically use **authorization code** grant to obtain a user token,
with permission specific to a individual username and password.
The use of authorization code grant using passport middleware is demonstrated in the 
collab-frontend repository.

## Security Note

* No automated tests are included.
* No formal code review has been performed.
* This was intended as a learning project.

## Requirements

- Requires Node Version 18 or greater
- Format of JWT access tokens compatible with [collab-auth](https://github.com/cotarr/collab-auth)
- Developed using Debian 11, Node 18, Express 4.18.2
- Other environments not tested (This was a learning project)

# Installation

Require Node version 18 or greater

```bash
npm install --save @cotarr/collab-iot-client-token
```

Alternately, this npm module can be installed as a dependency in the context of it's parent mock IOT device
by cloning the GitHub repository [collab-iot-device](https://github.com/cotarr/collab-iot-device).

# Module functions

## authInit(options)

The authInit() function is required to be run during module load to set module configuration variables.
The URL and client credentials are required to contact the authentication server.
Care should be taken to avoid disclosure of the client credentials.

AuthInit options properties:

| Property      | Type                       | Example                  | Need     | Comments                   |
| ------------- | -------------------------- | ------------------------ | -------- | -------------------------- |
| authURL       | string                     | "http://127.0.0.1:3500"  | required | Authorization Server URL   |
| clientId      | string                     | "abc123"                 | required | Client account credentials |
| clientSecret  | string                     | "ssh-secret"             | required | Client account credentials |
| requestScope  | string OR array of strings | ["api.read, "api.write"] | required | Scopes for token request   |

Example

```js
const { getClientToken, authInit } = require('@cotarr/collab-iot-client-token');

authInit({
  authURL: 'http://127.0.0.1:3500',
  clientId: 'abc123',
  clientSecret: 'ssh-secret',
  requestScope: ['api.read', 'api.write']
});
```

## getClientToken(chain);

The getClientToken function will asynchronously fetch a new access token 
from the collab-auth Oauth 2.0 authorization server using client credentials code grant.
The function will return a promise that will resolve to a javascript object
containing the access token. Access tokens are cached for future use 
until the token expires or the program is restarted.

There are two ways to use this function. The simple approach is to call 
the function without arguments and directly use the access token that is returned
when the promise resolves. The second method involves a chain of sequential promises that will allow 
multiple retries. In this case, all the state information is passed from 
promise to promise inside a common chain object as explained further on below.

### Simple Approach

The simple approach is to call `getClientToken()` without any arguments.
This returns a promise that can be passed to a `.then()` function and 
do something using the access token within the scope of the .then function.
After fetching a new token, the  module will save the access 
token for used with future requests. If a cached token that is 
not expired is available, the cached token will be returned in the resolved promise.

Example code:

```js
getClientToken()
  .then((chain) => {
    const token = chain.token.accessToken;
    // Do something with the access token
    console.log('Access token', token);
  })
```

The promise would resolve to the following object.

```json
{
  options: {},
  token: {
    accessToken: 'xxxxxx.xxxxxx.xxxxx',
    expires: 1688662586,
    cached: false
  }
}
```

### Try, Fail, Retry Approach

After fetching a new access token, this module will store the token locally
for future use. The cached token may be used for future requests until 
either the token expires or the IOT device is restarted.
For various reasons, it is possible the stored token could 
become revoked or otherwise invalidated at the authorization server. 
This could result in an issue where an unexpired token 
would fail authorization, and continue to fail until the token expires.

This module supports use of a javascript object that can be used within 
a chain of Promises such that the object is an argument of each function,
subsequently, the chain object is returned in resolved promise,
in turn to become the next argument. One chain object can keep all 
the state involved in multiple network requests local within 
the chain of promise functions. The sequence would run as follows:

1. An initial function would read the hardware device sensors. It would create an empty object and add a data property to the object.

```json
chain {
  data: { ... }
}
```

2. The function `getClientToken(chain)` is called with the chain object as an argument. In this case a cached token is retrieved from the cache and added to the chain object.

```json
chain {
  data: { ... },
  token: {
    accessToken: 'xxxxxx.xxxxxx.xxxxx',
    expires: 1631808644,
    cached: true
  }
}
```

3. A REST API submission function is called with the chain object as an argument to perform the HTTP submission request using the cached token. The HTTP request fails with 401 Unauthorized. Since the token is cached and failed with 401, it is eligible for a retry. The forceNewToken options property is added to the chain object and set to true. The promise resolves to the chain object.

```json
chain {
  data: { ... },
  token: { ... },
  options {
    forceNewToken: true;
  }
}
```

4. The `getClientToken(chain)` is called a second time with the chain object as an argument. The getClientToken detects the forceNewToken flag, ignores the previously cached token. A new access token fetched from the authorization server. 

```json
chain {
  data: { ... },
  options: { ... },
  token: {
    accessToken: 'xxxxxx.xxxxxx.xxxxx',
    expires: 1631808644,
    cached: false
  }
}

```
5. The REST API submission function is retried a second time and succeeds.

Alternately, in the case were the first access token was valid, the first 
REST API submission request succeeds, an ignoreTokenRequest flag is set to true.
As the promise chain executes through the second retry steps, the 
getClientToken(chain) function returns immediately without any actions.
Similarly, the function to submit data to the REST API will run twice, so 
it should have similar inhibit flags to abort the second REST API submission.

```json
chain {
  data: { ... },
  token: { ... },
  options {
    ignoreTokenRequest: true;
  }
}
```

An example of such a Try, Fail, Retry promise chain would look something like this.
There is a working example in the collab-iot-device repository that calls this module.

```js
readHardwareSensor() // Read sensor, create empty chain object, attach data to chain object
  .then((chain) => getClientToken(chain))    // Get cached token, attach to chain object
  .then((chain) => pushDataToSqlApi(chain))  // Submit REST API request using token
  .then((chain) => getClientToken(chain))    // If needed, get another replacement token
  .then((chain) => pushDataToSqlApi(chain))  // If needed, repeat REST API submission
  .catch((err) => console.log(err));
```
