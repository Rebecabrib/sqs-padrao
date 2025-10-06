import {
    SQSClient,
    SendMessageCommand,
    ReceiveMessageCommand,
    DeleteMessageCommand,
  } from '@aws-sdk/client-sqs';
  
  export type SqsOptions = {
    region: string;
    queueUrl: string;
  };
  
  export class SqsHelper {
    private client: SQSClient;
    private queueUrl: string;
  
    constructor(opts: SqsOptions) {
      this.client = new SQSClient({ region: opts.region });
      this.queueUrl = opts.queueUrl;
    }
  
    async send(body: any, attrs: Record<string, string> = {}) {
      const MessageAttributes = Object.fromEntries(
        Object.entries(attrs).map(([k, v]) => [
          k,
          { DataType: 'String', StringValue: v },
        ])
      );
  
      const cmd = new SendMessageCommand({
        QueueUrl: this.queueUrl,
        MessageBody: typeof body === 'string' ? body : JSON.stringify(body),
        MessageAttributes,
      });
      return this.client.send(cmd);
    }
  
    /** Faz polling até achar uma msg cujo atributo = valor. */
    async waitAndConsumeByAttribute(
      attributeName: string,
      expectedValue: string,
      opts?: { timeoutMs?: number; visibilityTimeout?: number; waitTimeSeconds?: number }
    ) {
      const timeoutMs = opts?.timeoutMs ?? 30_000;
      const waitTimeSeconds = opts?.waitTimeSeconds ?? 10; // long polling
      const visibilityTimeout = opts?.visibilityTimeout;   // opcional
  
      const end = Date.now() + timeoutMs;
  
      while (Date.now() < end) {
        const receive = new ReceiveMessageCommand({
          QueueUrl: this.queueUrl,
          MaxNumberOfMessages: 10,
          WaitTimeSeconds: waitTimeSeconds,
          MessageAttributeNames: ['All'],
          ...(visibilityTimeout ? { VisibilityTimeout: visibilityTimeout } : {}),
        });
  
        const res = await this.client.send(receive);
  
        if (res.Messages && res.Messages.length) {
          // tenta achar a msg alvo
          const target = res.Messages.find(
            (m) => m.MessageAttributes?.[attributeName]?.StringValue === expectedValue
          );
  
          // apaga todas as que você NÃO quer reprocessar? Normalmente deletamos só a target.
          if (target) {
            // Delete somente a que interessou
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
          // Se quiser, pode re-enfileirar/ignorar as demais. Sem delete, elas voltam quando expirar o visibility timeout.
        }
        // pequeno backoff
        await sleep(300);
      }
  
      throw new Error(
        `Timeout aguardando mensagem com atributo ${attributeName}=${expectedValue}`
      );
    }
  }
  
  function sleep(ms: number) {
    return new Promise((r) => setTimeout(r, ms));
  }
  function safeJsonParse(s: string) {
    try { return JSON.parse(s); } catch { return s; }
  }
  