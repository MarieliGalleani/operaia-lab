import { createMockGateways } from "./adapters/mock-gateways";
import { CompositeOfficeService } from "./composite-office-service";

/**
 * Fachada do escritório ligada aos gateways mock.
 *
 * Mesma classe usada em produção (`CompositeOfficeService`), apenas com os
 * adapters mockados injetados — evidência de que a UI não distingue a origem
 * dos dados. Útil em testes e desenvolvimento offline.
 */
export class MockOfficeService extends CompositeOfficeService {
  constructor() {
    super(createMockGateways());
  }
}
