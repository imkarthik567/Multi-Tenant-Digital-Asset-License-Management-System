import app from '../backend/src/app';

export default function handler(req: any, res: any) {
  if (
    req.url &&
    !req.url.startsWith('/api') &&
    !req.url.startsWith('/health') &&
    !req.url.startsWith('/ready') &&
    !req.url.startsWith('/metrics')
  ) {
    req.url = `/api${req.url.startsWith('/') ? '' : '/'}${req.url}`;
  }
  return app(req, res);
}
