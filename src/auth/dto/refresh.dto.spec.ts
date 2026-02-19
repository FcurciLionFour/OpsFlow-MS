import { RefreshDto } from './refresh.dto';

describe('RefreshDto', () => {
  it('holds refresh token payload', () => {
    const dto = new RefreshDto();
    dto.refreshToken = 'token';

    expect(dto.refreshToken).toBe('token');
  });
});
