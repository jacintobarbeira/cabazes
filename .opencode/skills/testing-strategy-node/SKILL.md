---
name: testing-strategy-node
description: Node.js/Express/NestJS testing conventions. Jest or Vitest, Supertest, dependency injection testing. Use when writing or reviewing Node.js tests.
user-invocable: false
metadata:
  mcpmarket-version: 1.0.0
---
Node.js testing conventions for Express, Fastify, and NestJS.

## Frameworks
- **Unit tests**: Jest or Vitest
- **HTTP tests**: Supertest
- **Mocking**: `jest.mock()` / `vi.mock()`, or dependency injection
- **E2E tests**: Supertest against running server

## Unit Tests (Services)

```ts
import { OrderService } from './order.service';

describe('OrderService', () => {
  let service: OrderService;
  let mockRepo: jest.Mocked<OrderRepository>;

  beforeEach(() => {
    mockRepo = {
      findById: jest.fn(),
      save: jest.fn(),
      findByStatus: jest.fn(),
    } as any;
    service = new OrderService(mockRepo);
  });

  it('should create order with PENDING status', async () => {
    mockRepo.save.mockResolvedValue({ id: 1, status: 'PENDING' });

    const result = await service.createOrder({ productId: 1, quantity: 2 });

    expect(result.status).toBe('PENDING');
    expect(mockRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'PENDING' })
    );
  });

  it('should throw when order not found', async () => {
    mockRepo.findById.mockResolvedValue(null);

    await expect(service.findById(999)).rejects.toThrow('Order not found');
  });
});
```

### Rules
- Inject mock dependencies via constructor (don't use `jest.mock` for internal modules when possible)
- Use `jest.fn()` / `vi.fn()` for mock functions
- Test both success and error paths
- Use `mockResolvedValue` / `mockRejectedValue` for async mocks

## API Tests (Supertest)

```ts
import request from 'supertest';
import { createApp } from '../app';

describe('GET /api/orders', () => {
  let app: Express;

  beforeAll(async () => {
    app = await createApp({ database: testDb });
  });

  it('should return orders list', async () => {
    const res = await request(app)
      .get('/api/orders')
      .set('Authorization', `Bearer ${testToken}`)
      .expect(200);

    expect(res.body).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 1, status: 'PENDING' })
      ])
    );
  });

  it('should return 401 without auth token', async () => {
    await request(app)
      .get('/api/orders')
      .expect(401);
  });

  it('should validate request body', async () => {
    const res = await request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${testToken}`)
      .send({ quantity: -1 })
      .expect(400);

    expect(res.body.errors).toBeDefined();
  });
});
```

### Rules
- Create a fresh app instance per test suite (not per test — too slow)
- Test status codes, response body, and headers
- Test auth/unauth scenarios
- Test validation errors with bad input

## NestJS Specifics

```ts
import { Test } from '@nestjs/testing';
import { OrderController } from './order.controller';
import { OrderService } from './order.service';

describe('OrderController', () => {
  let controller: OrderController;
  let service: jest.Mocked<OrderService>;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      controllers: [OrderController],
      providers: [{
        provide: OrderService,
        useValue: { findAll: jest.fn(), create: jest.fn() },
      }],
    }).compile();

    controller = module.get(OrderController);
    service = module.get(OrderService);
  });

  it('should return orders', async () => {
    service.findAll.mockResolvedValue([{ id: 1 }]);
    expect(await controller.findAll()).toHaveLength(1);
  });
});
```

## Middleware Tests

```ts
it('should call next when token is valid', () => {
  const req = { headers: { authorization: 'Bearer valid-token' } };
  const res = {};
  const next = jest.fn();

  authMiddleware(req as any, res as any, next);

  expect(next).toHaveBeenCalledWith();
});
```

## File Structure
```
src/
├── orders/
│   ├── order.service.ts
│   ├── order.service.test.ts
│   ├── order.controller.ts
│   └── order.controller.test.ts
├── __tests__/
│   └── orders.api.test.ts          Supertest integration
```

## Naming
- File: `module.test.ts` (co-located) or `__tests__/module.test.ts`
- Test: `should [expected behavior] when [condition]`
