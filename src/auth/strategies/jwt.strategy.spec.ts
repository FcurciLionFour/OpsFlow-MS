import { ConfigService } from '@nestjs/config';
import { JwtStrategy } from './jwt.strategy';

describe('JwtStrategy', () => {
  it('maps payload to request user shape', () => {
    const config = {
      getOrThrow: jest.fn().mockReturnValue('secret'),
    } as unknown as ConfigService;

    const strategy = new JwtStrategy(config);

    expect(strategy.validate({ sub: 'user-1' })).toEqual({
      sub: 'user-1',
    });
  });
});
