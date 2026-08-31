import { Controller, Get, INestApplication, Module } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types';

import { GLOBAL_PREFIX, SWAGGER_PATH, configureApp } from './app.setup';
import { buildConfig } from './config/configuration';

@Controller('things')
class ThingsController {
  @Get()
  find(): { ok: boolean } {
    return { ok: true };
  }
}

@Controller('health')
class FakeHealthController {
  @Get()
  check(): { status: string } {
    return { status: 'ok' };
  }
}

@Module({ controllers: [ThingsController, FakeHealthController] })
class ProbeModule {}

describe('configureApp', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [ProbeModule],
    }).compile();

    app = configureApp(
      moduleRef.createNestApplication(),
      buildConfig({ CORS_ORIGINS: 'http://localhost:5173,http://localhost:4173' }),
    );
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  const http = (): App => app.getHttpServer() as App;

  it('returns the application instance so calls can be chained', () => {
    expect(GLOBAL_PREFIX).toBe('api');
    expect(SWAGGER_PATH).toBe('docs');
  });

  it('mounts application routes under /api', async () => {
    await request(http()).get('/api/things').expect(200, { ok: true });
    await request(http()).get('/things').expect(404);
  });

  it('leaves GET /health outside the /api prefix', async () => {
    await request(http()).get('/health').expect(200, { status: 'ok' });
    await request(http()).get('/api/health').expect(404);
  });

  it('serves the OpenAPI document at /docs', async () => {
    const response = await request(http()).get('/docs-json').expect(200);
    expect(response.body).toMatchObject({
      info: { title: 'Orders API', version: '1.0' },
    });
  });

  it('serves the Swagger UI at /docs', async () => {
    const response = await request(http()).get('/docs').redirects(1);
    expect([200, 301]).toContain(response.status);
  });

  it('echoes an allowed CORS origin', async () => {
    const response = await request(http())
      .get('/api/things')
      .set('Origin', 'http://localhost:5173')
      .expect(200);

    expect(response.headers['access-control-allow-origin']).toBe('http://localhost:5173');
  });

  it('does not echo an origin that is not configured', async () => {
    const response = await request(http())
      .get('/api/things')
      .set('Origin', 'http://evil.test')
      .expect(200);

    expect(response.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('answers a CORS preflight with the allowed methods', async () => {
    const response = await request(http())
      .options('/api/things')
      .set('Origin', 'http://localhost:4173')
      .set('Access-Control-Request-Method', 'POST');

    expect(response.headers['access-control-allow-methods']).toBe('GET,POST,OPTIONS');
  });
});
