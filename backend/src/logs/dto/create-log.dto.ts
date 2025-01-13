import { IsNumber, IsEnum, IsNumberString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

// Enum for authentication attempt types
export enum AuthAttempt {
  NOT_REGISTERED = 0,
  ENTRY_ALLOWED = 1,
  INTERMEDIARY_ACCESS = 2,
  ANTI_PASSBACK = 3,
  DEACTIVATED_CARD = 4,
}

export class CreateLogDto {
  @ApiProperty({ description: 'The ID of the card' })
  @IsNumberString()
  cardId: number;

  @ApiProperty({ description: 'The ID of the user' })
  @IsNumberString()
  userId: number;

  @ApiProperty({
    description: 'The entry type represented as an enum value',
    example: AuthAttempt.ENTRY_ALLOWED,
    enum: AuthAttempt,
  })
  @IsEnum(AuthAttempt, {
    message: 'Attempt must be one of the following values: 0, 1, 2, 3, 4',
  }) // Ensure this matches the enum
  attempt: AuthAttempt;

  @ApiProperty({
    description: 'Timestamp of the log entry',
    type: Number,
    example: 1673295600000,
  })
  @IsNumber()
  timestamp: number;
}
