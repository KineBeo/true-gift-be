// Don't forget to use the class-validator decorators in the DTO properties.
// import { Allow } from 'class-validator';

import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsOptional } from 'class-validator';

export class UpdateFriendsDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  isAccepted?: boolean;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  isBlocked?: boolean;
}
