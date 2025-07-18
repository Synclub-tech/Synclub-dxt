const axios = require('axios');
const FormData = require('form-data');

class SynclubAPIError extends Error {
  constructor(message, statusCode) {
    super(message);
    this.name = 'SynclubAPIError';
    this.statusCode = statusCode;
  }
}

class SynclubAuthError extends SynclubAPIError {
  constructor(message) {
    super(message, 1004);
    this.name = 'SynclubAuthError';
  }
}

class SynclubRequestError extends SynclubAPIError {
  constructor(message, statusCode) {
    super(message, statusCode || 500);
    this.name = 'SynclubRequestError';
  }
}

class SynclubAPIClient {
  constructor(apiKey, apiHost) {
    this.apiKey = apiKey;
    this.apiHost = apiHost;
    this.client = axios.create({
      baseURL: apiHost,
      headers: {
        Authorization: apiKey,
        'X-API-Key': apiKey,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
    });
  }

  async _makeRequest(method, endpoint, options = {}) {
    try {
      // 处理 headers / form-data
      if (!options.files) {
        options.headers = {
          ...options.headers,
          'Content-Type': 'application/json',
          Authorization: this.apiKey,
          'X-API-Key': this.apiKey,
          Accept: 'application/json',
        };
      } else {
        const formData = new FormData();
        Object.entries(options.files).forEach(([k, v]) => formData.append(k, v));
        options.data = formData;
        options.headers = {
          ...formData.getHeaders(),
          Authorization: this.apiKey,
          'X-API-Key': this.apiKey,
          Accept: 'application/json',
        };
      }

      const response = await this.client.request({ method, url: endpoint, ...options });
      const data = response.data;
      const baseResp = data.base_resp || {};
      if (baseResp.status_code === undefined) {
        return data;
      }

      if (baseResp.status_code !== 0) {
        const traceId = response.headers['trace-id'];
        switch (baseResp.status_code) {
          case 1004:
            throw new SynclubAuthError(`API Error: ${baseResp.status_msg}. Trace-Id: ${traceId}`);
          case 2038:
            throw new SynclubRequestError(
              `需要完成实名认证(https://synclub.baidu-int.com)。Trace-Id: ${traceId}`,
              baseResp.status_code,
            );
          default:
            throw new SynclubRequestError(
              `API Error: ${baseResp.status_code}-${baseResp.status_msg}. Trace-Id: ${traceId}`,
              baseResp.status_code,
            );
        }
      }
      return data;
    } catch (err) {
      if (err instanceof SynclubAPIError) throw err;
      throw new SynclubRequestError(`Request failed: ${err.message}`);
    }
  }

  get(endpoint, options = {}) {
    return this._makeRequest('GET', endpoint, options);
  }

  post(endpoint, options = {}) {
    return this._makeRequest('POST', endpoint, options);
  }
}

module.exports = {
  SynclubAPIClient,
  SynclubAuthError,
  SynclubRequestError,
  SynclubAPIError,
}; 