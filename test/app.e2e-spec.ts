import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, Controller, Get, Module } from '@nestjs/common';
import request from 'supertest';

@Controller()
class TestController {
  @Get()
  getHello() {
    return 'ok';
  }
}

@Module({
  controllers: [TestController],
})
class TestAppModule {}

describe('AppController (e2e)', () => {
  let app: INestApplication;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [TestAppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('/ (GET)', () => {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    return request(app.getHttpServer()).get('/').expect(200).expect('ok');
  });
});
