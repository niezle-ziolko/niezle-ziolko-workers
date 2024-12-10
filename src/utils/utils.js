export const VALID_CHARSETS = [
	'utf-8',
	'utf8',
	'iso-8859-1',
	'us-ascii'
];

const PROXY_HEADERS = [
  'Accept',
  'Accept-Encoding',
  'Accept-Language',
  'Referer',
  'User-Agent'
];

const RESPONSE_HEADERS = [
  'Content-Type',
  'Cache-Control',
  'Expires',
  'Accept-Ranges',
  'Date',
  'Last-Modified',
  'ETag'
];

export const userAgent = request.headers.get('user-agent');
export const clientAddr = request.headers.get('cf-connecting-ip');

export async function proxyUrl(url, request) {
	let originUrl = 'https:/' + url.pathname + url.search;
	let hashOffset = originUrl.indexOf('cf_hash=');

	if (hashOffset >= 2) {
		originUrl = originUrl.substring(0, hashOffset - 1);
	};

	let init = {
		method: request.method,
		headers: {}
	};

  const clientAddr = request.headers.get('cf-connecting-ip');

	for (let name of PROXY_HEADERS) {
		let value = request.headers.get(name);
		if (value) {
			init.headers[name] = value;
		};
	};

	if (clientAddr) {
		init.headers['X-Forwarded-For'] = clientAddr;
	};

	const response = await fetch(originUrl, init);

	if (response) {
		let responseInit = {
			status: response.status,
			statusText: response.statusText,
			headers: {}
		};

		for (let name of RESPONSE_HEADERS) {
			let value = response.headers.get(name);
			
			if (value) {
				responseInit.headers[name] = value;
			};
		};

		if (response.status === 200) {
			responseInit.headers['Cache-Control'] = 'private; max-age=315360000';
		};

		responseInit.headers['X-Content-Type-Options'] = 'nosniff';

		const newResponse = new Response(response.body, responseInit);

		return newResponse;
	};

	return response;
};