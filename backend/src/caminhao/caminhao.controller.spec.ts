import { Test, TestingModule } from '@nestjs/testing';
import { CaminhaoController } from './caminhao.controller';
import { CaminhaoService } from './caminhao.service';
import { LogService } from '../log/log.service';

describe('CaminhaoController', () => {
  let controller: CaminhaoController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [CaminhaoController],
      providers: [
        { provide: CaminhaoService, useValue: {} },
        { provide: LogService, useValue: {} },
      ],
    }).compile();

    controller = module.get<CaminhaoController>(CaminhaoController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
