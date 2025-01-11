// src/logs/dto/create-log.dto.ts
import { IsInt, IsString, IsNumber } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateLogDto {
  @ApiProperty({ description: 'The ID of the card' })
  @IsString()
  cardId: string;

  @ApiProperty({ description: 'The ID of the user' })
  @IsString()
  userId: string;

  @ApiProperty({
    description: 'The entry type represented as an integer',
    example: 0,
  })
  @IsInt() // Ensure this is an integer
  attempt: number;

  @ApiProperty({
    description: 'Timestamp of the log entry',
    type: String,
    format: 'date-time',
  })
  @IsNumber()
  timestamp: number;
}
