export class HttpError extends Error {
  constructor(statusCode, code, message) {
    super(message);
    this.name = 'HttpError';
    this.statusCode = statusCode;
    this.code = code;
  }
}
export const badRequest = (message) => new HttpError(400, 'INVALID_REQUEST', message);
export const notFound = () => new HttpError(404, 'NOT_FOUND', 'El recurso no existe.');
export const conflict = () => new HttpError(409, 'CONFLICT', 'La solicitud entra en conflicto con un resultado existente.');
