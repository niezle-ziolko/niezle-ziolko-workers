import {
  proxyUrl,
  isProxyRequest,
  processHtmlRequest
} from './functions/fetchThirdParty';
import {
  proxyRequest,
  processRequest,
  proxyStylesheet
} from './functions/fetchFonts';

import { fetchFromImageEngine } from './functions/fetchImages';


export default {
  async fetch(request) {
    try {
      const url = new URL(request.url);

      if (
        url.pathname.match(/\.(gif|png|jpg|jpeg|webp|bmp|ico|svg)$/i)
      ) {
        return await fetchFromImageEngine(request);
      };

      return await fetch(request);
    } catch (e) {
      console.log('Wystąpił błąd:', e);

      return new Response('Wystąpił błąd podczas przetwarzania żądania.', { status: 500 });
    };
  }
};

addEventListener('fetch', event => {
  event.passThroughOnException();

  const url = new URL(event.request.url);
  const bypass = new URL(event.request.url).searchParams.get('cf-worker') === 'bypass';

  if (!bypass) {
    let accept = event.request.headers.get('accept');

    if (event.request.method === 'GET' && isProxyRequest(url)) {
      event.respondWith(proxyUrl(url, event.request));
    } else if (accept && accept.indexOf('text/html') >= 0) {
      event.respondWith(processHtmlRequest(event.request));
    };
  };

  if (event.request.method === 'GET') {
    const url = new URL(event.request.url);
    const accept = event.request.headers.get('Accept');
    
    if (url.pathname.startsWith('/niezleziolko.app/')) {
      event.respondWith(proxyRequest('https:/' + url.pathname + url.search, event.request));
    } else if (accept && (accept.indexOf('text/html') >= 0 || accept.indexOf('text/css') >= 0)) {
      if (url.pathname.startsWith('/niezleziolko.app/')) {
        event.respondWith(proxyStylesheet('https:/' + url.pathname + url.search, event.request));
      } else {
        event.respondWith(processRequest(event.request, event));
      };
    };
  };
});