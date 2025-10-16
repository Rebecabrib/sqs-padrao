import {
  SQSClient,
  SendMessageCommand,
  ReceiveMessageCommand,
  DeleteMessageCommand,
} from '@aws-sdk/client-sqs';

export type SqsOptions = {
  region: string;
  queueUrl: string; // use .fifo quando for FIFO
};

type FifoOptions = {
  groupId: string;                // obrigatório em FIFO
  dedupId?: string;               // obrigatório se a fila NÃO tiver content-based dedup
};

export class SqsHelper {
  private client: SQSClient;
  private queueUrl: string;
  private contentBasedDedup: boolean;

  constructor(opts: SqsOptions & { contentBasedDedup?: boolean }) {
    this.client = new SQSClient({ region: opts.region });
    this.queueUrl = opts.queueUrl;
    this.contentBasedDedup = !!opts.contentBasedDedup;
  }

  async send(body: any, attrs: Record<string, string> = {}, fifo?: FifoOptions) {
    const MessageAttributes = Object.fromEntries(
      Object.entries(attrs).map(([k, v]) => [
        k,
        { DataType: 'String', StringValue: v },
      ])
    );

    const isFifo = this.queueUrl.endsWith('.fifo');

    const cmd = new SendMessageCommand({
      QueueUrl: this.queueUrl,
      MessageBody: typeof body === 'string' ? body : JSON.stringify(body),
      MessageAttributes,
      ...(isFifo && fifo
        ? {
            MessageGroupId: fifo.groupId,
            // somente inclui dedup se não estiver usando dedup por conteúdo
            ...(this.contentBasedDedup ? {} : fifo.dedupId ? { MessageDeduplicationId: fifo.dedupId } : {}),
          }
        : {}),
    });

    return this.client.send(cmd);
  }

  async waitAndConsumeByAttribute(
    attributeName: string,
    expectedValue: string,
    opts?: { timeoutMs?: number; visibilityTimeout?: number; waitTimeSeconds?: number }
  ) {
    const timeoutMs = opts?.timeoutMs ?? 30_000;
    const waitTimeSeconds = opts?.waitTimeSeconds ?? 10;
    const visibilityTimeout = opts?.visibilityTimeout;
    const end = Date.now() + timeoutMs;

    while (Date.now() < end) {
      const res = await this.client.send(
        new ReceiveMessageCommand({
          QueueUrl: this.queueUrl,
          MaxNumberOfMessages: 10,
          WaitTimeSeconds: waitTimeSeconds,
          MessageAttributeNames: ['All'],
          ...(visibilityTimeout ? { VisibilityTimeout: visibilityTimeout } : {}),
        })
      );

      if (res.Messages?.length) {
        const target = res.Messages.find(
          (m) => m.MessageAttributes?.[attributeName]?.StringValue === expectedValue
        );

        if (target) {
          await this.client.send(
            new DeleteMessageCommand({
              QueueUrl: this.queueUrl,
              ReceiptHandle: target.ReceiptHandle!,
            })
          );

          return {
            body: target.Body ? safeJsonParse(target.Body) : null,
            raw: target,
          };
        }
      }
      await sleep(250);
    }

    throw new Error(
      `Timeout aguardando mensagem com atributo ${attributeName}=${expectedValue}`
    );
  }
}

function sleep(ms: number) { return new Promise((r) => setTimeout(r, ms)); }
function safeJsonParse(s: string) { try { return JSON.parse(s); } catch { return s; } }
