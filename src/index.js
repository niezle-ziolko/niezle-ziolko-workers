import { fetchFromImageEngine } from './functions/fetch-images';
import { proxyRequest, processRequest, proxyStylesheet } from './functions/fetch-fonts';
import { proxyUrl, isProxyRequest, processHtmlRequest } from './functions/fetch-third-party';


export default {
  async fetch(request) {
    try {
      const url = new URL(request.url);
      const bypass = url.searchParams.get('cf-worker') === 'bypass';
      const method = request.method === 'GET';

      if (method && url.pathname.match(/\.(woff)$/i)) {
        const accept = request.headers.get('Accept');

        if (url.pathname.startsWith('/niezleziolko.app/')) {
          return await proxyRequest('https:/' + url.pathname + url.search, request);
        } else if (accept && (accept.indexOf('text/html') >= 0 || accept.indexOf('text/css') >= 0)) {
          if (url.pathname.startsWith('/niezleziolko.app/')) {
            return await proxyStylesheet('https:/' + url.pathname + url.search, request);
          } else {
            const event = { request };

            return await processRequest(request, event);
          };
        };
      };

      if (method && url.pathname.match(/\.(gif|png|jpg|jpeg|webp|bmp|ico|svg)$/i)) {
        return await fetchFromImageEngine(request);
      };

      if (!bypass) {
        const accept = request.headers.get('accept');

        if (method && isProxyRequest(url)) {
          return await proxyUrl(url, request);
        } else if (accept && accept.indexOf('text/html') >= 0) {
          return await processHtmlRequest(request);
        };
      };

      return await fetch(request);
    } catch (e) {
      console.log('Fetch error:', e);
      
      return new Response('Fetch error.', { status: 500 });
    };
  }
};