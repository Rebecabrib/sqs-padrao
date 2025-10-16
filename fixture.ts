import { test as base } from '@playwright/test';
import { RequestHandler } from '../utils/request-handler';
import { APILogger } from '../utils/logger';
import { createToken } from '../helpers/createToken';
import config from '../api-test.config';
import { SqsHelper, SqsOptions } from '../utils/sqs';

export type TestOptions = {
  api: RequestHandler;
  config: typeof config;
  sqs: SqsHelper;                                 // default (.env)
  makeSqs: (opts: SqsOptions & { contentBasedDedup?: boolean }) => SqsHelper;
};

export type WorkerFixture = { authToken: string };

export const test = base.extend<TestOptions, WorkerFixture>({
  authToken: [async ({}, use) => {
    const token = await createToken(config.username, config.password);
    await use(token);
  }, { scope: 'worker' }],

  api: async ({ request }, use) => {
    const logger = new APILogger();
    const requestHandler = new RequestHandler(request, config.apiUrl, logger);
    await use(requestHandler);
  },

  config: async ({}, use) => { await use(config); },

  sqs: async ({}, use) => {
    const sqs = new SqsHelper({
      region: process.env.AWS_REGION!,
      queueUrl: process.env.SQS_QUEUE_URL ?? process.env.SQS_QUEUE_URL_FIFO ?? '',
      contentBasedDedup: process.env.AWS_SQS_CONTENT_BASED_DEDUP === 'true',
    });
    await use(sqs);
  },

  makeSqs: async ({}, use) => {
    const factory = (opts: SqsOptions & { contentBasedDedup?: boolean }) =>
      new SqsHelper(opts);
    await use(factory);
  },
});

export { expect } from '@playwright/test';


env
AWS_REGION=us-east-1
SQS_QUEUE_URL=https://sqs.us-east-1.amazonaws.com/123456789012/minha-fila.fifo
SQS_DEFAULT_GROUP_ID=pagamentos
SQS_CONTENT_BASED_DEDUP=true


# Se a fila tiver "Content-based deduplication" HABILITADA no console, deixa true e não precisa mandar dedupId


