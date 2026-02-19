import { UsersController } from './users.controller';

describe('UsersController', () => {
  const usersServiceMock: { findAll: jest.Mock } = {
    findAll: jest.fn(),
  };

  const controller = new UsersController(usersServiceMock as never);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('delegates findAll to service', async () => {
    usersServiceMock.findAll.mockResolvedValue([
      { id: '1', email: 'a@a.com', roles: ['USER'] },
    ]);

    const result = await controller.findAll();

    expect(usersServiceMock.findAll).toHaveBeenCalledTimes(1);
    expect(result).toHaveLength(1);
  });
});
