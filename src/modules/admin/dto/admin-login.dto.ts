import { ApiProperty } from '@nestjs/swagger';

export class AdminLoginDto {
  @ApiProperty({
    description: 'Tên đăng nhập admin',
    example: 'admin',
  })
  username: string;

  @ApiProperty({
    description: 'Mật khẩu',
    example: 'my_secure_password',
  })
  password: string;
}
