import { User } from '../../src/domain/User.js';

// Object Mother: usuarios "prontos" que se repetem em varios testes.
// Como User tem poucos campos e quase nunca muda entre cenarios,
// nao vale a pena um builder aqui.
export class UserMother {
  static umUsuarioPadrao() {
    return new User(1, 'Joao Padrao', 'padrao@email.com', 'PADRAO');
  }

  static umUsuarioPremium() {
    return new User(2, 'Maria Premium', 'premium@email.com', 'PREMIUM');
  }
}
