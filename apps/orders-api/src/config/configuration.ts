import Joi from 'joi';

/** The NoSQL back-ends this service can be pointed at, selected by `NOSQL_DRIVER`. */
export const NOSQL_DRIVERS = ['elasticsearch', 'mongodb'] as const;
export type NosqlDriver = (typeof NOSQL_DRIVERS)[number];

export interface ElasticsearchConfig {
  readonly node: string;
  readonly index: string;
  readonly username?: string;
  readonly password?: string;
}

export interface MongoConfig {
  readonly uri: string;
  readonly database: string;
  readonly collection: string;
  readonly maxPoolSize: number;
}

export interface AppConfig {
  readonly port: number;
  readonly nosqlDriver: NosqlDriver;
  readonly corsOrigins: string[];
  readonly elasticsearch: ElasticsearchConfig;
  readonly mongodb: MongoConfig;
}

/** Defaults are the ones documented in `docs/CONTRACT.md` §4. */
export const CONFIG_DEFAULTS = {
  PORT: 3000,
  NOSQL_DRIVER: 'elasticsearch' as NosqlDriver,
  ELASTICSEARCH_NODE: 'http://localhost:9200',
  ELASTICSEARCH_INDEX: 'orders',
  MONGODB_URI: 'mongodb://localhost:27017',
  MONGODB_DATABASE: 'orders',
  MONGODB_COLLECTION: 'orders',
  MONGODB_MAX_POOL_SIZE: 10,
  CORS_ORIGINS: 'http://localhost:5173',
} as const;

/**
 * Joi schema handed to `ConfigModule.forRoot({ validationSchema })`.
 *
 * It only *guards* the environment (fail fast on a typo such as
 * `NOSQL_DRIVER=elastic`); the typed values themselves are produced by
 * {@link buildConfig} so that the shape is testable without Nest.
 */
export const validationSchema = Joi.object({
  NODE_ENV: Joi.string()
    .valid('development', 'production', 'test')
    .default('development'),
  PORT: Joi.number().port().default(CONFIG_DEFAULTS.PORT),
  NOSQL_DRIVER: Joi.string()
    .valid(...NOSQL_DRIVERS)
    .default(CONFIG_DEFAULTS.NOSQL_DRIVER),
  ELASTICSEARCH_NODE: Joi.string().uri().default(CONFIG_DEFAULTS.ELASTICSEARCH_NODE),
  ELASTICSEARCH_INDEX: Joi.string().min(1).default(CONFIG_DEFAULTS.ELASTICSEARCH_INDEX),
  ELASTICSEARCH_USERNAME: Joi.string().allow('').optional(),
  ELASTICSEARCH_PASSWORD: Joi.string().allow('').optional(),
  MONGODB_URI: Joi.string().default(CONFIG_DEFAULTS.MONGODB_URI),
  MONGODB_DATABASE: Joi.string().min(1).default(CONFIG_DEFAULTS.MONGODB_DATABASE),
  MONGODB_COLLECTION: Joi.string().min(1).default(CONFIG_DEFAULTS.MONGODB_COLLECTION),
  MONGODB_MAX_POOL_SIZE: Joi.number()
    .integer()
    .min(1)
    .default(CONFIG_DEFAULTS.MONGODB_MAX_POOL_SIZE),
  CORS_ORIGINS: Joi.string().allow('').default(CONFIG_DEFAULTS.CORS_ORIGINS),
}).unknown(true);

function toInt(raw: string | undefined, fallback: number): number {
  if (raw === undefined || raw.trim() === '') {
    return fallback;
  }
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? Math.trunc(parsed) : fallback;
}

function optional(raw: string | undefined): string | undefined {
  return raw !== undefined && raw.trim() !== '' ? raw : undefined;
}

/**
 * Splits `CORS_ORIGINS` ("a,b , c") into a trimmed, de-duplicated list.
 * An unset *or blank* value falls back to the documented default, consistent
 * with how the other optional variables are treated.
 */
export function parseCorsOrigins(raw: string | undefined): string[] {
  const source = optional(raw) ?? CONFIG_DEFAULTS.CORS_ORIGINS;
  return [
    ...new Set(
      source
        .split(',')
        .map((origin) => origin.trim())
        .filter((origin) => origin.length > 0),
    ),
  ];
}

/**
 * Pure env -> typed config mapping. Kept free of Nest so it can be unit tested
 * and so `PersistenceModule.forRoot()` can call it before the DI container exists.
 */
export function buildConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const driver = env.NOSQL_DRIVER ?? CONFIG_DEFAULTS.NOSQL_DRIVER;
  if (!(NOSQL_DRIVERS as readonly string[]).includes(driver)) {
    throw new Error(
      `Invalid NOSQL_DRIVER "${driver}". Expected one of: ${NOSQL_DRIVERS.join(', ')}.`,
    );
  }

  return {
    port: toInt(env.PORT, CONFIG_DEFAULTS.PORT),
    nosqlDriver: driver as NosqlDriver,
    corsOrigins: parseCorsOrigins(env.CORS_ORIGINS),
    elasticsearch: {
      node: env.ELASTICSEARCH_NODE ?? CONFIG_DEFAULTS.ELASTICSEARCH_NODE,
      index: env.ELASTICSEARCH_INDEX ?? CONFIG_DEFAULTS.ELASTICSEARCH_INDEX,
      username: optional(env.ELASTICSEARCH_USERNAME),
      password: optional(env.ELASTICSEARCH_PASSWORD),
    },
    mongodb: {
      uri: env.MONGODB_URI ?? CONFIG_DEFAULTS.MONGODB_URI,
      database: env.MONGODB_DATABASE ?? CONFIG_DEFAULTS.MONGODB_DATABASE,
      collection: env.MONGODB_COLLECTION ?? CONFIG_DEFAULTS.MONGODB_COLLECTION,
      maxPoolSize: toInt(
        env.MONGODB_MAX_POOL_SIZE,
        CONFIG_DEFAULTS.MONGODB_MAX_POOL_SIZE,
      ),
    },
  };
}

/** `ConfigModule` load factory — namespaced under the `app` key. */
export const configuration = (): { app: AppConfig } => ({ app: buildConfig() });

export default configuration;
