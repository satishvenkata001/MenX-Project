import { AppError } from '../utils/appError.js';
import { env } from '../config/env.js';

export const parseMultipart = async (req, res, next) => {
  const contentType = req.headers['content-type'] || '';
  if (!contentType.startsWith('multipart/form-data')) {
    return next();
  }

  const boundaryMatch = contentType.match(/boundary=(.+)/);
  if (!boundaryMatch) {
    return next(AppError.badRequest('Invalid Content-Type: missing boundary'));
  }

  const boundaryStr = '--' + boundaryMatch[1];
  const boundaryBuffer = Buffer.from(boundaryStr);

  try {
    const chunks = [];
    let totalSize = 0;
    const maxSize = env.IMAGE_MAX_SIZE_BYTES || 2097152; // Defaults to 2MB

    // Read the request stream
    for await (const chunk of req) {
      totalSize += chunk.length;
      if (totalSize > maxSize) {
        return next(AppError.badRequest(`File size exceeds limit of ${maxSize / (1024 * 1024)}MB`));
      }
      chunks.push(chunk);
    }

    const bodyBuffer = Buffer.concat(chunks);
    req.body = {};
    req.file = undefined;

    let searchOffset = 0;
    const boundaryPositions = [];

    // Find all boundary positions
    while (true) {
      const pos = bodyBuffer.indexOf(boundaryBuffer, searchOffset);
      if (pos === -1) break;
      boundaryPositions.push(pos);
      searchOffset = pos + boundaryBuffer.length;
    }

    if (boundaryPositions.length < 2) {
      return next(AppError.badRequest('Malformed multipart data'));
    }

    // Process parts between boundaries
    for (let i = 0; i < boundaryPositions.length - 1; i++) {
      const start = boundaryPositions[i] + boundaryBuffer.length;
      const end = boundaryPositions[i + 1];
      
      let partBuffer = bodyBuffer.slice(start, end);
      
      // Trim leading CRLF
      if (partBuffer[0] === 13 && partBuffer[1] === 10) {
        partBuffer = partBuffer.slice(2);
      }
      // Trim trailing CRLF
      if (partBuffer[partBuffer.length - 2] === 13 && partBuffer[partBuffer.length - 1] === 10) {
        partBuffer = partBuffer.slice(0, -2);
      }

      // Find the headers end (double CRLF)
      const headerEndIndex = partBuffer.indexOf(Buffer.from('\r\n\r\n'));
      if (headerEndIndex === -1) continue;

      const headerBuffer = partBuffer.slice(0, headerEndIndex);
      const contentBuffer = partBuffer.slice(headerEndIndex + 4);

      const headerStr = headerBuffer.toString('utf8');
      const lines = headerStr.split('\r\n');
      
      let name = '';
      let filename = '';
      let partContentType = '';

      for (const line of lines) {
        if (line.toLowerCase().startsWith('content-disposition:')) {
          const nameMatch = line.match(/name="([^"]+)"/);
          if (nameMatch) name = nameMatch[1];
          
          const filenameMatch = line.match(/filename="([^"]+)"/);
          if (filenameMatch) filename = filenameMatch[1];
        } else if (line.toLowerCase().startsWith('content-type:')) {
          partContentType = line.split(':')[1].trim();
        }
      }

      if (name) {
        if (filename) {
          req.file = {
            buffer: contentBuffer,
            originalname: filename,
            mimetype: partContentType,
            size: contentBuffer.length
          };
        } else {
          req.body[name] = contentBuffer.toString('utf8');
        }
      }
    }

    next();
  } catch (err) {
    next(err);
  }
};
