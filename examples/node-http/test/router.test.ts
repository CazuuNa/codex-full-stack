import { describe, expect, it } from 'vitest';

import { routeRequest } from '../src/router.js';

describe('routeRequest', () => {
    it('should return status ok for GET /health', () => {
        const result = routeRequest('GET', '/health');
        expect(result).toEqual({
            statusCode: 200,
            body: {
                status: 'ok',
            },
        });
    });
    it('returns 404 for unknown route', () => {
        const result = routeRequest('GET', '/unknown');
        expect(result).toEqual({
            statusCode: 404,
            body: {
                code: 'Not Found',
                message: 'The resource you requested was not found on this server.',
            },
        });
    });
    it('returns 404 when method does not match', () => {
        const result = routeRequest('POST', '/health');

        expect(result).toEqual({
            statusCode: 404,
            body: {
                code: 'Not Found',
                message: 'The resource you requested was not found on this server.',
            },
        });
    });
});
