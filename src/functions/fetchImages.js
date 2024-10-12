export async function fetchFromImageEngine(request) {
  const url = new URL(request.url);
  url.host = 'niezleziolko.app';
  url.protocol = 'https:';
  
  try {
    const newRequest = new Request(url, request);
    const response = await fetch(newRequest, {
      cf: {
        cacheTtl: 31536000,
        polish: 'lossy',
        mirage: true
      }
    });
    return response;
  } catch (error) {
    console.log('Błąd podczas pobierania obrazu:', error);
		
    return new Response(null, { status: 404 });
  };
};