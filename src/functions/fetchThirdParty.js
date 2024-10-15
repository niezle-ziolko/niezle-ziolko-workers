const SCRIPT_URLS = [
  '/static.cloudflareinsights.com/',
  '/cdn-cgi/zaraz/s.js',
  '/cdn-cgi/scripts/7d0fa10a/cloudflare-static/rocket-loader.min.js',
  '/sibautomation.com/',
  '/api.pushowl.com/',
  '/cdn.pushowl.com/',
  '/in-automate.brevo.com/',
  '/furgonetka.pl/'
];

const SCRIPT_PRE = '<\\s*script[^>]+src\\s*=\\s*[\'"]\\s*((https?:)?/';
const PATTERN_POST = '[^\'" ]+)\\s*["\'][^>]*>';
const VALID_CHARSETS = ['utf-8', 'utf8', 'iso-8859-1', 'us-ascii'];

export function isProxyRequest(url) {
	let found_prefix = false;
	const path = url.pathname + url.search;
	for (let prefix of SCRIPT_URLS) {
		if (path.startsWith(prefix) && path.indexOf('cf_hash=') >= 0) {
			found_prefix = true;
			break;
		};
	};

	return found_prefix;
};

export async function proxyUrl(url, request) {
	let originUrl = 'https:/' + url.pathname + url.search;
	let hashOffset = originUrl.indexOf('cf_hash=');

	if (hashOffset >= 2) {
		originUrl = originUrl.substring(0, hashOffset - 1);
	};

	let init = {
		method: request.method,
		headers: {},
	};

	const proxy_headers = ['Accept', 'Accept-Encoding', 'Accept-Language', 'Referer', 'User-Agent'];
  const clientAddr = request.headers.get('cf-connecting-ip');

	for (let name of proxy_headers) {
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
		const responseHeaders = [
			'Content-Type',
			'Cache-Control',
			'Expires',
			'Accept-Ranges',
			'Date',
			'Last-Modified',
			'ETag',
		];

		let responseInit = {
			status: response.status,
			statusText: response.statusText,
			headers: {},
		};

		for (let name of responseHeaders) {
			let value = response.headers.get(name);
			if (value) {
				responseInit.headers[name] = value;
			};
		};

		if (response.status === 200) {
			responseInit.headers['Cache-Control'] = 'private; max-age=315360000';
		};

		const newResponse = new Response(response.body, responseInit);

		return newResponse;
	};

	return response;
};

export async function processHtmlRequest(request) {
	const response = await fetch(request);
	let contentType = response.headers.get('content-type');

	if (contentType && contentType.indexOf('text/html') !== -1) {
		const charsetRegex = /charset\s*=\s*([^\s;]+)/gim;
		const match = charsetRegex.exec(contentType);

		if (match !== null) {
			let charset = match[1].toLowerCase();
			if (!VALID_CHARSETS.includes(charset)) {
				return response;
			};
		};

		const { readable, writable } = new TransformStream();
		const newResponse = new Response(readable, response);

		modifyHtmlStream(response.body, writable, request);

		return newResponse;
	} else {
		return response;
	};
};

function chunkContainsInvalidCharset(chunk) {
	let invalid = false;
	const charsetRegex = /<\s*meta[^>]+charset\s*=\s*['"]([^'"]*)['"][^>]*>/gim;
	const charsetMatch = charsetRegex.exec(chunk);

	if (charsetMatch) {
		const docCharset = charsetMatch[1].toLowerCase();

		if (!VALID_CHARSETS.includes(docCharset)) {
			invalid = true;
		};
	};

	const contentTypeRegex = /<\s*meta[^>]+http-equiv\s*=\s*['"]\s*content-type[^>]*>/gim;
	const contentTypeMatch = contentTypeRegex.exec(chunk);

	if (contentTypeMatch) {
		const metaTag = contentTypeMatch[0];
		const metaRegex = /charset\s*=\s*([^\s"]*)/gim;
		const metaMatch = metaRegex.exec(metaTag);

		if (metaMatch) {
			const charset = metaMatch[1].toLowerCase();

			if (!VALID_CHARSETS.includes(charset)) {
				invalid = true;
			};
		};
	};

	return invalid;
};

async function modifyHtmlStream(readable, writable, request) {
	const reader = readable.getReader();
	const writer = writable.getWriter();
	const encoder = new TextEncoder();
	let decoder = new TextDecoder('utf-8', { fatal: true });

	let firstChunk = true;
	let unsupportedCharset = false;
	let patterns = [];

	for (let scriptUrl of SCRIPT_URLS) {
		let regex = new RegExp(SCRIPT_PRE + scriptUrl + PATTERN_POST, 'gi');
		patterns.push(regex);
	};

	let partial = '';
	let content = '';

	for (;;) {
		const { done, value } = await reader.read();
		if (done) {
			if (partial.length) {
				partial = await modifyHtmlChunk(partial, patterns, request);
				await writer.write(encoder.encode(partial));
			};

			partial = '';
			break;
		};

		let chunk = null;

		if (unsupportedCharset) {
			await writer.write(value);
			continue;
		} else {
			try {
				chunk = decoder.decode(value, { stream: true });
			} catch (e) {
				unsupportedCharset = true;
				if (partial.length) {
					await writer.write(encoder.encode(partial));
					partial = '';
				};

				await writer.write(value);
				continue;
			};
		};

		try {
			if (firstChunk) {
				firstChunk = false;
				if (chunkContainsInvalidCharset(chunk)) {
					unsupportedCharset = true;

					if (partial.length) {
						await writer.write(encoder.encode(partial));
						partial = '';
					};

					await writer.write(value);
					continue;
				};
			};

			content = partial + chunk;
			partial = '';

			const scriptPos = content.lastIndexOf('<script');

			if (scriptPos >= 0) {
				const scriptClose = content.indexOf('>', scriptPos);
				if (scriptClose === -1) {
					partial = content.slice(scriptPos);
					content = content.slice(0, scriptPos);
				};
			};

			if (content.length) {
				content = await modifyHtmlChunk(content, patterns, request);
			};
		} catch (e) {

		};

		if (content.length) {
			await writer.write(encoder.encode(content));
			content = '';
		};
	};

	await writer.close();
};

async function modifyHtmlChunk(content, patterns, request) {
	const pageUrl = new URL(request.url);

	for (let pattern of patterns) {
		let match = pattern.exec(content);
    
		while (match !== null) {
			const originalUrl = match[1];
			let fetchUrl = originalUrl;

			if (fetchUrl.startsWith('//')) {
				fetchUrl = pageUrl.protocol + fetchUrl;
			};

			const proxyUrl = await hashContent(originalUrl, fetchUrl, request);

			if (proxyUrl) {
				content = content.split(originalUrl).join(proxyUrl);
				pattern.lastIndex -= originalUrl.length - proxyUrl.length;
			};

			match = pattern.exec(content);
		};
	};

	return content;
};

async function hashContent(originalUrl, url, request) {
	let proxyUrl = null;
	let hash = null;
	const userAgent = request.headers.get('user-agent');
	const clientAddr = request.headers.get('cf-connecting-ip');
	const hashCacheKey = new Request(url + 'cf-hash-key');
	let cache = null;
	let foundInCache = false;

	try {
		cache = caches.default;
		let response = await cache.match(hashCacheKey);

		if (response) {
			hash = await response.text();
			proxyUrl = constructProxyUrl(originalUrl, hash);
			foundInCache = true;
		};
	} catch (e) {

	};

	if (!foundInCache) {
		try {
			let headers = { 'Referer': request.url, 'User-Agent': userAgent };

			if (clientAddr) {
				headers['X-Forwarded-For'] = clientAddr;
			};

			const response = await fetch(url, { headers: headers });
			let content = await response.arrayBuffer();

			if (content) {
				const hashBuffer = await crypto.subtle.digest('SHA-1', content);
				hash = hex(hashBuffer);
				proxyUrl = constructProxyUrl(originalUrl, hash);

				try {
					if (cache) {
						let ttl = 60;
						const cacheControl = response.headers.get('cache-control');
						const maxAgeRegex = /max-age\s*=\s*(\d+)/i;
						const match = maxAgeRegex.exec(cacheControl);

						if (match) {
							ttl = parseInt(match[1], 10);
						};

						const hashCacheResponse = new Response(hash, { ttl: ttl });
						cache.put(hashCacheKey, hashCacheResponse);
					};
				} catch (e) {

				};
			};
		} catch (e) {

		};
	};

	return proxyUrl;
};

function constructProxyUrl(originalUrl, hash) {
	let proxyUrl = null;
	let pathStart = originalUrl.indexOf('//');

	if (pathStart >= 0) {
		proxyUrl = originalUrl.substring(pathStart + 1);

		if (proxyUrl.indexOf('?') >= 0) {
			proxyUrl += '&';
		} else {
			proxyUrl += '?';
		};

		proxyUrl += 'cf_hash=' + hash;
	};

	return proxyUrl;
};

function hex(buffer) {
	var hexCodes = [];
	var view = new DataView(buffer);

	for (var i = 0; i < view.byteLength; i += 4) {
		var value = view.getUint32(i);
		var stringValue = value.toString(16);
		var padding = '00000000';
		var paddedValue = (padding + stringValue).slice(-padding.length);
		hexCodes.push(paddedValue);
	};

	return hexCodes.join('');
};