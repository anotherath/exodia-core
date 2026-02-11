import { Module, Global } from '@nestjs/common';
import { OkxWs } from './okx.ws';
import { OkxRest } from './okx.rest';

@Global() // Make it global so we don't need to import it everywhere, or keep it local
@Module({
  providers: [OkxWs, OkxRest],
  exports: [OkxWs, OkxRest],
})
export class OkxInfraModule {}
