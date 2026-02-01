import { Injectable } from '@nestjs/common';
import { PairRepository } from 'src/repositories/pair/pair.repository';

@Injectable()
export class PairService {
  constructor(private readonly pairRepo: PairRepository) {}

  getAllActive() {
    return this.pairRepo.findAllActive();
  }

  getByInstId(instId: string) {
    return this.pairRepo.findByInstId(instId);
  }
}
