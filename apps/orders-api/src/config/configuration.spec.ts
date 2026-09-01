import {
  CONFIG_DEFAULTS,
  buildConfig,
  configuration,
  parseCorsOrigins,
  validationSchema,
} from './configuration';

describe('configuration', () => {
  describe('buildConfig defaults (docs/CONTRACT.md §4)', () => {
    const config = buildConfig({});

    it('applies every documented default', () => {
      expect(config).toEqual({
        port: 3000,
        nosqlDriver: 'elasticsearch',
        corsOrigins: ['http://localhost:5173'],
        elasticsearch: {
          node: 'http://localhost:9200',
          index: 'orders',
          username: undefined,
          password: undefined,
        },
        mongodb: {
          uri: 'mongodb://localhost:27018',
          database: 'orders',
          collection: 'orders',
          maxPoolSize: 10,
        },
      });
    });
  });

  describe('buildConfig overrides', () => {
    it('reads every documented variable', () => {
      const config = buildConfig({
        PORT: '4100',
        NOSQL_DRIVER: 'mongodb',
        ELASTICSEARCH_NODE: 'http://es:9200',
        ELASTICSEARCH_INDEX: 'orders-v2',
        ELASTICSEARCH_USERNAME: 'elastic',
        ELASTICSEARCH_PASSWORD: 'secret',
        MONGODB_URI: 'mongodb://mongo:27017',
        MONGODB_DATABASE: 'shop',
        MONGODB_COLLECTION: 'confirmed',
        MONGODB_MAX_POOL_SIZE: '25',
        CORS_ORIGINS: 'http://a.test, http://b.test',
      });

      expect(config.port).toBe(4100);
      expect(config.nosqlDriver).toBe('mongodb');
      expect(config.elasticsearch).toEqual({
        node: 'http://es:9200',
        index: 'orders-v2',
        username: 'elastic',
        password: 'secret',
      });
      expect(config.mongodb).toEqual({
        uri: 'mongodb://mongo:27017',
        database: 'shop',
        collection: 'confirmed',
        maxPoolSize: 25,
      });
      expect(config.corsOrigins).toEqual(['http://a.test', 'http://b.test']);
    });

    it('treats blank optional credentials as absent', () => {
      const config = buildConfig({
        ELASTICSEARCH_USERNAME: '   ',
        ELASTICSEARCH_PASSWORD: '',
      });
      expect(config.elasticsearch.username).toBeUndefined();
      expect(config.elasticsearch.password).toBeUndefined();
    });

    it.each([
      ['not-a-number', CONFIG_DEFAULTS.PORT],
      ['', CONFIG_DEFAULTS.PORT],
      ['8081', 8081],
    ])('parses PORT=%p as %p', (raw, expected) => {
      expect(buildConfig({ PORT: raw }).port).toBe(expected);
    });

    it('rejects an unknown NOSQL_DRIVER', () => {
      expect(() => buildConfig({ NOSQL_DRIVER: 'cassandra' })).toThrow(
        /Invalid NOSQL_DRIVER "cassandra"/,
      );
      expect(() => buildConfig({ NOSQL_DRIVER: 'elastic' })).toThrow(
        /elasticsearch, mongodb/,
      );
    });

    it('accepts both supported drivers', () => {
      expect(buildConfig({ NOSQL_DRIVER: 'elasticsearch' }).nosqlDriver).toBe(
        'elasticsearch',
      );
      expect(buildConfig({ NOSQL_DRIVER: 'mongodb' }).nosqlDriver).toBe('mongodb');
    });
  });

  describe('parseCorsOrigins', () => {
    it.each([
      [undefined, ['http://localhost:5173']],
      ['', ['http://localhost:5173']],
      ['http://a.test', ['http://a.test']],
      ['http://a.test,http://b.test', ['http://a.test', 'http://b.test']],
      ['  http://a.test ,, http://b.test  ', ['http://a.test', 'http://b.test']],
      ['http://a.test,http://a.test', ['http://a.test']],
    ])('%p -> %p', (raw, expected) => {
      expect(parseCorsOrigins(raw)).toEqual(expected);
    });

    it('yields an empty list for a comma-only value', () => {
      expect(parseCorsOrigins(',,,')).toEqual([]);
    });
  });

  describe('validationSchema (fail-fast guard for ConfigModule)', () => {
    it('rejects an unknown NOSQL_DRIVER', () => {
      const { error } = validationSchema.validate({ NOSQL_DRIVER: 'cassandra' });
      expect(error).toBeDefined();
      expect(error?.message).toMatch(/NOSQL_DRIVER/);
    });

    it('rejects a non-numeric PORT', () => {
      const { error } = validationSchema.validate({ PORT: 'abc' });
      expect(error?.message).toMatch(/PORT/);
    });

    it('rejects a malformed ELASTICSEARCH_NODE', () => {
      const { error } = validationSchema.validate({
        ELASTICSEARCH_NODE: 'not a uri',
      });
      expect(error?.message).toMatch(/ELASTICSEARCH_NODE/);
    });

    it('fills defaults for an empty environment', () => {
      const { error, value } = validationSchema.validate({});
      expect(error).toBeUndefined();
      expect(value).toMatchObject({
        NODE_ENV: 'development',
        PORT: 3000,
        NOSQL_DRIVER: 'elasticsearch',
        ELASTICSEARCH_NODE: 'http://localhost:9200',
        ELASTICSEARCH_INDEX: 'orders',
        MONGODB_URI: 'mongodb://localhost:27018',
        MONGODB_DATABASE: 'orders',
        MONGODB_COLLECTION: 'orders',
        CORS_ORIGINS: 'http://localhost:5173',
      });
    });

    it('tolerates unrelated environment variables', () => {
      const { error } = validationSchema.validate({ HOME: '/root', PATH: '/bin' });
      expect(error).toBeUndefined();
    });
  });

  describe('configuration() factory', () => {
    const original = { ...process.env };

    afterEach(() => {
      process.env = { ...original };
    });

    it('namespaces the config under "app" and reads process.env', () => {
      process.env.NOSQL_DRIVER = 'mongodb';
      process.env.MONGODB_DATABASE = 'from-env';
      expect(configuration()).toEqual({
        app: expect.objectContaining({
          nosqlDriver: 'mongodb',
          mongodb: expect.objectContaining({ database: 'from-env' }),
        }),
      });
    });
  });
});
