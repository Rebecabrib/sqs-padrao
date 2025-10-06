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
