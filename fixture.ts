import { test as base } from '@playwright/test';
import { SqsHelper } from '../utils/sqs';

type Extra = {
  sqs: SqsHelper;
};

export const test = base.extend<Extra>({
  sqs: async ({}, use) => {
    const sqs = new SqsHelper({
      region: process.env.AWS_REGION!,
      queueUrl: process.env.SQS_QUEUE_URL!,
    });
    await use(sqs);
  },
});

export { expect } from '@playwright/test';
