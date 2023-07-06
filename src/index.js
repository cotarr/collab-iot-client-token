'use strict';
//
//  collab-iot-client-token
//
// --------------------------------------------

/**
 *  @type {Object} cachedToken - Module variable to hold cached access token.
 */
let cachedToken = null;
/**
 *  @type {Boolean} cachedTokenExists - Module variable, set true when cached token exists.
 */
let cachedTokenExists = false;

// ------------------------
// Module Configuration
// ------------------------
/** @type {string} authURL - Authorization server URL */
let authURL = null;
/** @type {string} clientId */
let clientId = null;
/** @type {string} clientSecret */
let clientSecret = null;
/** @type {array||string} Requested scope for token request */
let requestScope = null;

/**
 * Function to be run at program start to initialize module configuration
 * @example
 * authInit({
 *   authURL: 'http://127.0.0.1:3500',
 *   clientId: 'abc123',
 *   clientSecret: 'ssh-secret',
 *   requestScope: ['api.read', 'api.write']
 * });
 * @param {Object} options - Module configuration data
 * @param {string} options.authURL - Authorization server URL
 * @param {string} options.clientId - Client account credentials
 * @param {string} options.clientSecret - Client account credentials
 * @param {string|string[]} options.requestScope - Scopes used to request new access token.
 * @throws Will throw error for missing arguments
 */
exports.authInit = (options) => {
  if (options == null) {
    throw new Error('collab-iot-client-token, authInit() requires an options object.');
  }
  if ((Object.hasOwn(options, 'authURL')) &&
    (typeof options.authURL === 'string') &&
    (options.authURL.length > 0)) {
    authURL = options.authURL;
  } else {
    throw new Error('collab-iot-client-token, authInit(), invalid authURL in options');
  }
  if ((Object.hasOwn(options, 'clientId')) &&
    (typeof options.clientId === 'string') &&
    (options.clientId.length > 0)) {
    clientId = options.clientId;
  } else {
    throw new Error('collab-iot-client-token, authInit(), invalid clientId in options');
  }
  if ((Object.hasOwn(options, 'clientSecret')) &&
    (typeof options.clientSecret === 'string') &&
    (options.clientSecret.length > 0)) {
    clientSecret = options.clientSecret;
  } else {
    throw new Error('collab-iot-client-token, authInit(), invalid clientSecret in options');
  }
  requestScope = [];
  if (((Array.isArray(options.requestScope)) && (options.requestScope.length > 0)) ||
    ((typeof options.requestScope === 'string') && (options.requestScope.length > 0))) {
    requestScope = options.requestScope;
  } else {
    throw new Error('collab-iot-client-token, authInit(), invalid requestScope in options');
  }
};

// -------------------------
// Module Internal Functions
// -------------------------

/**
 * Convert array of strings to space separated list of scopes
 * This is used for the Oauth2 client credentials grant.
 * Example:  ['api.read', 'api.write'] --> "api.read api.write"
 * @param   {string|string[]} scopeArray - Array of scope strings
 * @returns {string} Returns string with separated scopes
 */
const _toScopeString = (scopeInput) => {
  if ((scopeInput == null) ||
    ((typeof scopeInput !== 'string') &&
    (!Array.isArray(scopeInput)))) {
    throw new Error('scope must be string or array');
  }
  if (typeof scopeInput === 'string') {
    scopeInput = [scopeInput];
  }
  let scopeString = '';
  scopeInput.forEach((scope, i) => {
    if (i > 0) scopeString += ' ';
    scopeString += scope.toString();
  });
  return scopeString;
};

// -----------------------
// Main export function
// -----------------------

/**
 * Get a new oauth2 access_token using client credentials grant
 *
 * This function accepts an optional "chain" object which can hold unrelated
 * custom properties, provided they do not use keys: "token" or "options".
 * When the optional options property is omitted, the chain object
 * will be created automatically.
 * An access token is obtained from token cache if available,
 * else a new access_token is fetched from the authorization server.
 * The function returns a promise which will resolves to the chain object.
 * Function accepts:
 *   chain = {
 *     options: {
 *       ignoreTokenRequest: false
 *       forceNewToken: false
 *     }
 *   }
 * Function returns:
 *   chain = {
 *     options: { ... },
 *     token: {
 *       accessToken: 'xxxxxxxxxxxxxxxxxxx',
 *       expires: 1631808644,
 *       cached: false
 *     }
 *   }
 * @param   {Object|undefined} chain (Optional) - chain object used to pass data between promises.
 * @param   {Boolean|undefined} chain.options.ignoreTokenRequest (Optional) - If true, no action
 * @param   {Boolean|undefined} chain.options.forceNewToken (Optional) - If true, always new token.
 * @returns {Promise} resolves to chain object containing new access token, or rejects error
 */
exports.getClientToken = (chain) => {
  if (chain == null) chain = Object.create(null);
  if (!Object.hasOwn(chain, 'options')) chain.options = Object.create(null);

  // Option to skip all actions, return chain object without any changes.
  // This functionality is intended for a chain of promises
  // where an access token may not be required conditionally.
  // The ignoreTokenRequest property is an optional.
  if (chain.options.ignoreTokenRequest) {
    return Promise.resolve(chain);
  }

  // When timestamp is expired, delete cached access token (10 second margin)
  const nowSeconds = Math.floor((new Date().getTime()) / 1000);
  if ((cachedToken == null) ||
    ((Object.hasOwn(cachedToken, 'expires')) && (cachedToken.expires < nowSeconds + 10))) {
    // Case of expired token, delete expired token
    cachedToken = null;
    cachedTokenExists = false;
  }

  // Option to Ignore cached access token and always request a new access token.
  // This functionality is intended for a chain of promises
  // where a previous use of the cached access token failed and
  // the operation is to be performed a second time with a new replacement
  // access token. The forceNewToken property is an optional.
  if ((cachedTokenExists) && (!chain.options.forceNewToken)) {
    chain.token = cachedToken;
    return Promise.resolve(chain);
  }

  //
  // Return promise resolving to chain object, else reject error.
  //
  return new Promise((resolve, reject) => {
    // Clear any previously cached token
    cachedToken = null;
    cachedTokenExists = false;
    delete chain.token;
    // Fetch supervisory timer
    const fetchController = new AbortController();
    // OAuth2 authorization server
    const fetchURL = authURL + '/oauth/token';
    // POST request
    const body = {
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: 'client_credentials',
      // scope is type string, multiple scope separated by ascii space characters
      scope: _toScopeString(requestScope)
    };
    const fetchOptions = {
      method: 'POST',
      redirect: 'error',
      cache: 'no-store',
      signal: fetchController.signal,
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json'
      },
      body: JSON.stringify(body)
    };
    const fetchTimerId = setTimeout(() => fetchController.abort(), 5000);
    fetch(fetchURL, fetchOptions)
      .then((response) => {
        if (response.status === 200) {
          return response.json();
        } else {
          // Retrieve error message from remote web server and pass to error handler
          return response.text()
            .then((remoteErrorText) => {
              const err = new Error('HTTP status error');
              err.status = response.status;
              err.statusText = response.statusText;
              err.remoteErrorText = remoteErrorText;
              if (response.headers.get('WWW-Authenticate')) {
                err.oauthHeaderText = response.headers.get('WWW-Authenticate');
              }
              throw err;
            });
        }
      })
      .then((tokenResponse) => {
        // console.log(tokenResponse);
        if (fetchTimerId) clearTimeout(fetchTimerId);
        //
        // Example response from collab-auth authorization server
        //
        //   tokenResponse {
        //     access_token: 'xxxxxxxxxxxxxxxxxx',
        //     expires_in: 3600,
        //     scope: [ 'api.write' ],
        //     grantType: 'client_credentials',
        //     auth_time: 1688560780,
        //     token_type: 'Bearer'
        //   }
        //
        const nowSeconds = Math.floor((new Date().getTime()) / 1000);
        cachedToken = Object.create(null);
        cachedToken.accessToken = tokenResponse.access_token;
        cachedToken.expires = nowSeconds + parseInt(tokenResponse.expires_in);
        cachedToken.cached = true;
        cachedTokenExists = true;
        chain.token = Object.create(null);
        chain.token.accessToken = tokenResponse.access_token;
        chain.token.expires = nowSeconds + parseInt(tokenResponse.expires_in);
        chain.token.cached = false;
        resolve(chain);
      })
      .catch((err) => {
        if (fetchTimerId) clearTimeout(fetchTimerId);
        // Build generic error message to catch network errors
        let message = ('Fetch error, ' + fetchOptions.method + ' ' + fetchURL + ', ' +
          (err.message || err.toString() || 'HTTP Error'));
        if (err.status) {
          // Case of HTTP status error, build descriptive error message
          message = 'HTTP status error, ' + err.status.toString() + ' ' +
            err.statusText + ', ' + fetchOptions.method + ' ' + fetchURL;
        }
        if (err.remoteErrorText) {
          message += ', ' + err.remoteErrorText;
        }
        if (err.oauthHeaderText) {
          message += ', ' + err.oauthHeaderText;
        }
        // limit error to 1 line.
        message = message.split('/n')[0];
        const error = new Error(message);
        reject(error);
      });
  }); // new Promise
}; // getToken()
