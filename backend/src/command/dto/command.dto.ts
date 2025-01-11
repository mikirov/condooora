// src/commands/dto/command.dto.ts
import { ApiProperty } from '@nestjs/swagger';

export class CommandDto {
  @ApiProperty({ description: 'The name of the command' })
  name: string;

  @ApiProperty({
    description: 'Optional payload for the command',
    required: false,
  })
  payload?: any;
}
