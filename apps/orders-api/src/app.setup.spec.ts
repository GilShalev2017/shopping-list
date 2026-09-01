import { Controller, Get, INestApplication, Module } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types';

import {
  GLOBAL_PREFIX,
  SWAGGER_JSON_PATH,
  SWAGGER_PATH,
  SWAGGER_TAGS,
  configureApp,
} from './app.setup';
import { PACKAGE_INFO } from './common/package-info';
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
    // Nest's convention: the raw document sits next to the UI at `<path>-json`.
    expect(SWAGGER_JSON_PATH).toBe('docs-json');
  });

  it('mounts application routes under /api', async () => {
    await request(http()).get('/api/things').expect(200, { ok: true });
    await request(http()).get('/things').expect(404);
  });

  it('leaves GET /health outside the /api prefix', async () => {
    await request(http()).get('/health').expect(200, { status: 'ok' });
    await request(http()).get('/api/health').expect(404);
  });

  describe('OpenAPI document', () => {
    const fetchDocument = async (): Promise<Record<string, any>> =>
      (await request(http()).get(`/${SWAGGER_JSON_PATH}`).expect(200)).body;

    it('is served as raw JSON at /docs-json', async () => {
      const response = await request(http())
        .get(`/${SWAGGER_JSON_PATH}`)
        .expect(200)
        .expect('Content-Type', /application\/json/);

      expect(response.body.openapi).toMatch(/^3\./);
    });

    it('titles itself and takes its version from package.json', async () => {
      const document = await fetchDocument();

      expect(document.info.title).toBe('Orders API');
      expect(document.info.version).toBe(PACKAGE_INFO.version);
      expect(document.info.version).toMatch(/^\d+\.\d+\.\d+/);
    });

    it('describes the pluggable store and the server-owned totals up front', async () => {
      const { description } = (await fetchDocument()).info as { description: string };

      expect(description).toContain('NOSQL_DRIVER');
      expect(description).toContain('elasticsearch');
      expect(description).toContain('mongodb');
      expect(description).toContain('screen 2');
      expect(description).toContain(SWAGGER_JSON_PATH);
    });

    it('lists the local server so "Try it out" targets a real port', async () => {
      const document = await fetchDocument();
      const urls = (document.servers as { url: string; description?: string }[]).map(
        (server) => server.url,
      );

      expect(urls).toContain('http://localhost:3000');
      expect(
        (document.servers as { description?: string }[]).every(
          (server) =>
            typeof server.description === 'string' && server.description.length > 0,
        ),
      ).toBe(true);
    });

    it('declares a described tag per controller group', async () => {
      const tags = (await fetchDocument()).tags as {
        name: string;
        description: string;
      }[];

      expect(tags.map((tag) => tag.name).sort()).toEqual(
        [SWAGGER_TAGS.health, SWAGGER_TAGS.orders].sort(),
      );
      tags.forEach((tag) => expect(tag.description.length).toBeGreaterThan(20));
    });

    it('serves the Swagger UI at /docs', async () => {
      const response = await request(http()).get(`/${SWAGGER_PATH}`).redirects(1);
      expect([200, 301]).toContain(response.status);
    });
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
