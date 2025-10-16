import { test, expect } from '../utils/fixtures';
import { faker } from '@faker-js/faker';

test('Publica e consome mensagem específica por atributo', async ({ sqs }) => {
  const idReferenciaPagamento = faker.string.numeric(10);
  const correlationId = faker.string.uuid();

  // 1) Envia mensagem com atributos que permitam filtrar depois
  const payload = {
    tipo: 'SOLICITACAO_PAGAMENTO',
    correlationId,
    dados: { /* ...seus campos... */ },
  };

  await sqs.send(payload, {
    idReferenciaPagamento,
    correlationId,
  });

  // 2) Faz polling até encontrar a mensagem com idReferenciaPagamento desejado
  const result = await sqs.waitAndConsumeByAttribute(
    'idReferenciaPagamento',
    idReferenciaPagamento,
    { timeoutMs: 45_000, waitTimeSeconds: 10 } // ajuste se necessário
  );

  // 3) Valida conteúdo
  expect(result.body).toBeTruthy();
  // se o produtor mandou JSON, `result.body` já estará objeto
  expect(result.body?.correlationId).toBe(correlationId);
});



import { test, expect } from './utils/fixtures';
import { faker } from '@faker-js/faker';

test('publica e consome em fila FIFO', async ({ makeSqs }) => {
  const sqsFifo = makeSqs({
    region: process.env.AWS_REGION || 'sa-east-1',
    queueUrl: process.env.SQS_QUEUE_URL_FIFO!,   // precisa terminar com .fifo
    contentBasedDedup: process.env.AWS_SQS_CONTENT_BASED_DEDUP === 'true',
  });

  const correlationId = faker.string.uuid();
  const idReferenciaPagamento = faker.string.numeric(10);

  // Em FIFO, SEMPRE mandar MessageGroupId.
  // Se NÃO tiver content-based dedup habilitado na fila, também mande dedupId.
  await sqsFifo.send(
    { tipo: 'PAGAMENTO', correlationId },
    { correlationId, idReferenciaPagamento },
    {
      groupId: `tenant-xyz`,                  // agrupa a ordenação
      dedupId: `${correlationId}`,            // opcional se content-based dedup=true
    }
  );

  const got = await sqsFifo.waitAndConsumeByAttribute('correlationId', correlationId, {
    timeoutMs: 45_000,
    waitTimeSeconds: 10,
  });

  expect(got.body?.correlationId).toBe(correlationId);
});

