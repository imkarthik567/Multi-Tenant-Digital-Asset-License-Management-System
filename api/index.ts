import app from '../backend/src/app';

export default function handler(req: any, res: any) {
  return app(req, res);
}
