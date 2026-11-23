import { CheckoutService } from '../src/services/CheckoutService.js';
import { Item } from '../src/domain/Item.js';
import { UserMother } from './builders/UserMother.js';
import { CarrinhoBuilder } from './builders/CarrinhoBuilder.js';

const CARTAO = '4111 1111 1111 1111';

describe('CheckoutService', () => {
  describe('quando o pagamento falha', () => {
    let gatewayStub;
    let repositoryDummy;
    let emailDummy;
    let checkoutService;
    let carrinho;

    beforeEach(() => {
      // Arrange
      carrinho = CarrinhoBuilder.umCarrinho().build();

      // stub: so devolve a resposta de falha
      gatewayStub = { cobrar: jest.fn().mockResolvedValue({ success: false }) };

      // dummies: estao ai so pra satisfazer o construtor
      repositoryDummy = { salvar: jest.fn() };
      emailDummy = { enviarEmail: jest.fn() };

      checkoutService = new CheckoutService(gatewayStub, repositoryDummy, emailDummy);
    });

    it('deve retornar null', async () => {
      // Act
      const pedido = await checkoutService.processarPedido(carrinho, CARTAO);

      // Assert
      expect(pedido).toBeNull();
    });

    it('nao deve salvar o pedido nem enviar e-mail', async () => {
      // Act
      await checkoutService.processarPedido(carrinho, CARTAO);

      // Assert
      expect(repositoryDummy.salvar).not.toHaveBeenCalled();
      expect(emailDummy.enviarEmail).not.toHaveBeenCalled();
    });
  });

  describe('quando um cliente Padrao finaliza a compra', () => {
    it('deve retornar o pedido salvo com o total sem desconto', async () => {
      // Arrange
      const carrinho = CarrinhoBuilder.umCarrinho()
        .comUser(UserMother.umUsuarioPadrao())
        .comItens([new Item('Teclado', 150), new Item('Mouse', 50)])
        .build();

      const gatewayStub = { cobrar: jest.fn().mockResolvedValue({ success: true }) };
      const repositoryStub = {
        salvar: jest.fn().mockImplementation(async (pedido) => ({ ...pedido, id: 10 })),
      };
      const emailStub = { enviarEmail: jest.fn().mockResolvedValue(undefined) };

      const checkoutService = new CheckoutService(gatewayStub, repositoryStub, emailStub);

      // Act
      const pedido = await checkoutService.processarPedido(carrinho, CARTAO);

      // Assert
      expect(pedido.id).toBe(10);
      expect(pedido.totalFinal).toBe(200);
      expect(pedido.status).toBe('PROCESSADO');
    });
  });

  describe('quando um cliente Premium finaliza a compra', () => {
    let gatewayStub;
    let repositoryStub;
    let emailMock;
    let checkoutService;
    let carrinho;

    beforeEach(() => {
      // Arrange
      const usuarioPremium = UserMother.umUsuarioPremium();
      carrinho = CarrinhoBuilder.umCarrinho()
        .comUser(usuarioPremium)
        .comItens([new Item('Teclado', 150), new Item('Mouse', 50)]) // R$ 200,00
        .build();

      gatewayStub = { cobrar: jest.fn().mockResolvedValue({ success: true }) };
      repositoryStub = {
        salvar: jest.fn().mockImplementation(async (pedido) => ({ ...pedido, id: 42 })),
      };
      emailMock = { enviarEmail: jest.fn().mockResolvedValue(undefined) };

      checkoutService = new CheckoutService(gatewayStub, repositoryStub, emailMock);
    });

    it('deve cobrar no gateway o valor com 10% de desconto', async () => {
      // Act
      await checkoutService.processarPedido(carrinho, CARTAO);

      // Assert
      expect(gatewayStub.cobrar).toHaveBeenCalledWith(180, CARTAO);
    });

    it('deve enviar um e-mail de confirmacao para o cliente', async () => {
      // Act
      await checkoutService.processarPedido(carrinho, CARTAO);

      // Assert
      expect(emailMock.enviarEmail).toHaveBeenCalledTimes(1);
      expect(emailMock.enviarEmail).toHaveBeenCalledWith(
        'premium@email.com',
        'Seu Pedido foi Aprovado!',
        'Pedido 42 no valor de R$180'
      );
    });

    it('deve retornar o pedido salvo com o total ja descontado', async () => {
      // Act
      const pedido = await checkoutService.processarPedido(carrinho, CARTAO);

      // Assert
      expect(pedido.id).toBe(42);
      expect(pedido.totalFinal).toBe(180);
    });
  });

  describe('quando o envio de e-mail falha', () => {
    it('nao deve quebrar o checkout', async () => {
      // Arrange
      const carrinho = CarrinhoBuilder.umCarrinho().build();
      const gatewayStub = { cobrar: jest.fn().mockResolvedValue({ success: true }) };
      const repositoryStub = { salvar: jest.fn().mockResolvedValue({ id: 7, totalFinal: 100 }) };
      const emailStub = { enviarEmail: jest.fn().mockRejectedValue(new Error('SMTP fora do ar')) };
      jest.spyOn(console, 'error').mockImplementation(() => {});

      const checkoutService = new CheckoutService(gatewayStub, repositoryStub, emailStub);

      // Act
      const pedido = await checkoutService.processarPedido(carrinho, CARTAO);

      // Assert
      expect(pedido).toEqual({ id: 7, totalFinal: 100 });

      console.error.mockRestore();
    });
  });
});
